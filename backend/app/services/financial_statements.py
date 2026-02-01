"""
Financial Statements Service

Generates:
- Income Statement (Estado de Resultados)
- Balance Sheet (Balance General)

Uses same cost estimation logic as PatrimonyService:
- If Product.cost exists: use actual cost
- If Product.cost is NULL: estimate as unit_price * 0.80
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from sqlalchemy import select, func, case, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.product import Product, GlobalProduct, Inventory, GlobalInventory
from app.models.school import School
from app.models.accounting import (
    Expense,
    ExpenseCategory,
    ExpenseCategoryModel,
    BalanceAccount,
    AccountType,
    AccountsReceivable,
    AccountsPayable,
    Transaction,
    TransactionType
)
from app.services.balance_integration import BalanceIntegrationService

# Same margin used in PatrimonyService
DEFAULT_COST_MARGIN = Decimal("0.80")

# Expense categories mapping for Income Statement (using string codes)
OPERATING_EXPENSE_CODES = {
    "rent", "utilities", "payroll", "supplies",
    "transport", "maintenance", "marketing",
}

OTHER_EXPENSE_CODES = {
    "taxes", "bank_fees", "other",
}

# Excluded from P&L (already counted in COGS via Product.cost)
# Production expenses are reflected in COGS when products are sold,
# so including them as operating expenses would be double-counting.
EXCLUDED_EXPENSE_CODES = {
    "inventory",        # Producción: General
    "confeccion",       # Confección (categoría custom legacy)
    "prod_fabric",      # Producción: Tela
    "prod_tailoring",   # Producción: Confección
    "prod_embroidery",  # Producción: Bordado
    "prod_accessories",  # Producción: Accesorios
    "prod_other",       # Producción: Otros
    "discounts",        # Descuentos a clientes (deducción de ingresos, no gasto operativo)
    "sale_changes",     # Reembolsos por cambios de ventas (se tratan como devoluciones)
    "order_changes",    # Reembolsos por cambios de pedidos (se tratan como devoluciones)
}

# Fallback labels when dynamic categories are not available
EXPENSE_CATEGORY_LABELS_FALLBACK = {
    "rent": "Arriendo",
    "utilities": "Servicios Publicos",
    "payroll": "Nomina",
    "supplies": "Insumos de Oficina",
    "transport": "Transporte",
    "maintenance": "Mantenimiento",
    "marketing": "Marketing",
    "taxes": "Impuestos",
    "bank_fees": "Comisiones Bancarias",
    "other": "Otros",
    "inventory": "Produccion: General",
    "prod_fabric": "Produccion: Tela",
    "prod_tailoring": "Produccion: Confeccion",
    "prod_embroidery": "Produccion: Bordado",
    "prod_accessories": "Produccion: Accesorios",
    "prod_other": "Produccion: Otros",
    "discounts": "Descuentos",
}


class FinancialStatementsService:
    """Service for generating Financial Statements"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # Income Statement (Estado de Resultados)
    # ============================================

    async def get_income_statement(
        self,
        start_date: date,
        end_date: date,
        compare_previous: bool = False
    ) -> dict:
        """
        Generate Income Statement for a period.

        Structure:
        - Gross Revenue (Sales)
        - COGS (Cost of Goods Sold)
        - Gross Profit
        - Operating Expenses
        - Operating Income
        - Other Expenses
        - Net Income
        """
        # Convert dates to datetime for query
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        # 1. Get Revenue from completed sales
        revenue_data = await self._calculate_revenue(start_datetime, end_datetime)

        # 2. Calculate COGS
        cogs_data = await self._calculate_cogs(start_datetime, end_datetime)

        # 3. Get Expenses by category
        expenses_data = await self._get_expenses_by_period(start_date, end_date)

        # 4. Load dynamic category labels from DB
        category_labels = await self._get_category_labels()

        # 4.5 Calculate discounts (expenses with category 'discounts')
        discounts_data = await self._calculate_discounts(start_date, end_date)

        # 4.6 Calculate sale returns (refunds from sale/order changes)
        sale_returns_data = await self._calculate_sale_returns(start_date, end_date)

        # 4.7 Calculate revenue breakdown by school + global products
        revenue_breakdown = await self._calculate_revenue_breakdown(
            start_datetime, end_datetime
        )

        # 4.8 Get detailed breakdown of 'other' expenses
        other_expenses_details = await self._get_other_expenses_details(
            start_date, end_date
        )

        # 5. Calculate metrics
        gross_revenue = Decimal(str(revenue_data["total"]))
        discounts_total = Decimal(str(discounts_data["total"]))
        sale_returns_total = Decimal(str(sale_returns_data["total"]))
        returns_discounts = discounts_total + sale_returns_total
        net_revenue = gross_revenue - returns_discounts

        cost_of_goods_sold = Decimal(str(cogs_data["total"]))

        gross_profit = net_revenue - cost_of_goods_sold
        gross_margin_percent = (
            (gross_profit / net_revenue * 100) if net_revenue > 0 else Decimal("0")
        )

        # Operating expenses
        operating_expenses = expenses_data["operating"]
        total_operating_expenses = sum(
            Decimal(str(v)) for v in operating_expenses.values()
        )

        operating_income = gross_profit - total_operating_expenses
        operating_margin_percent = (
            (operating_income / net_revenue * 100) if net_revenue > 0 else Decimal("0")
        )

        # Other expenses
        other_expenses = expenses_data["other"]
        financial_expenses = Decimal(str(other_expenses.get("bank_fees", 0)))
        total_other_expenses = sum(
            Decimal(str(v)) for v in other_expenses.values()
        )

        net_income = operating_income - total_other_expenses
        net_margin_percent = (
            (net_income / net_revenue * 100) if net_revenue > 0 else Decimal("0")
        )

        # COGS coverage indicator
        total_items = cogs_data["items_with_actual_cost"] + cogs_data["items_with_estimated_cost"]
        cogs_coverage_percent = (
            Decimal(str(cogs_data["items_with_actual_cost"])) / Decimal(str(total_items)) * 100
            if total_items > 0 else Decimal("100")
        )

        # Build expense category totals for detailed view (all categories with dynamic labels)
        operating_expenses_by_category = []
        for cat_code, amount_val in sorted(operating_expenses.items()):
            amount = Decimal(str(amount_val))
            if amount > 0:
                operating_expenses_by_category.append({
                    "category": cat_code,
                    "category_label": category_labels.get(cat_code, cat_code),
                    "total": float(amount),
                    "percentage_of_revenue": float(
                        (amount / net_revenue * 100) if net_revenue > 0 else 0
                    )
                })

        other_expenses_by_category = []
        for cat_code, amount_val in sorted(other_expenses.items()):
            amount = Decimal(str(amount_val))
            if amount > 0:
                other_expenses_by_category.append({
                    "category": cat_code,
                    "category_label": category_labels.get(cat_code, cat_code),
                    "total": float(amount),
                    "percentage_of_revenue": float(
                        (amount / net_revenue * 100) if net_revenue > 0 else 0
                    )
                })

        # Disclaimer if COGS coverage is low
        disclaimer = None
        if cogs_coverage_percent < 100:
            disclaimer = (
                f"Nota: {100 - float(cogs_coverage_percent):.1f}% del costo de ventas "
                f"es estimado (margen {float(DEFAULT_COST_MARGIN) * 100:.0f}%)"
            )

        result = {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            # Revenue
            "gross_revenue": float(gross_revenue),
            "returns_discounts": float(returns_discounts),
            "returns_discounts_breakdown": {
                "discounts": float(discounts_total),
                "discounts_count": discounts_data["count"],
                "sale_returns": float(sale_returns_total),
                "sale_returns_count": sale_returns_data["count"]
            },
            "net_revenue": float(net_revenue),
            "sales_count": revenue_data["count"],
            "revenue_breakdown": revenue_breakdown,
            # COGS
            "cost_of_goods_sold": float(cost_of_goods_sold),
            "cogs_details": {
                "total": float(cost_of_goods_sold),
                "from_actual_cost": float(cogs_data["from_actual_cost"]),
                "from_estimated_cost": float(cogs_data["from_estimated_cost"]),
                "items_with_actual_cost": cogs_data["items_with_actual_cost"],
                "items_with_estimated_cost": cogs_data["items_with_estimated_cost"],
                "estimation_margin_used": float(DEFAULT_COST_MARGIN)
            },
            # Gross Profit
            "gross_profit": float(gross_profit),
            "gross_margin_percent": float(gross_margin_percent),
            # Operating Expenses (legacy hardcoded keys + total for backwards compat)
            "operating_expenses": {
                "rent": float(operating_expenses.get("rent", 0)),
                "utilities": float(operating_expenses.get("utilities", 0)),
                "payroll": float(operating_expenses.get("payroll", 0)),
                "supplies": float(operating_expenses.get("supplies", 0)),
                "transport": float(operating_expenses.get("transport", 0)),
                "maintenance": float(operating_expenses.get("maintenance", 0)),
                "marketing": float(operating_expenses.get("marketing", 0)),
                "total": float(total_operating_expenses)
            },
            "operating_expenses_by_category": operating_expenses_by_category,
            "total_operating_expenses": float(total_operating_expenses),
            # Operating Income
            "operating_income": float(operating_income),
            "operating_margin_percent": float(operating_margin_percent),
            # Other Expenses (legacy hardcoded keys + total for backwards compat)
            "other_expenses": {
                "taxes": float(other_expenses.get("taxes", 0)),
                "bank_fees": float(other_expenses.get("bank_fees", 0)),
                "other": float(other_expenses.get("other", 0)),
                "total": float(total_other_expenses)
            },
            "other_expenses_by_category": other_expenses_by_category,
            "other_expenses_details": other_expenses_details,
            "financial_expenses": float(financial_expenses),
            # Net Income
            "net_income": float(net_income),
            "net_margin_percent": float(net_margin_percent),
            # Data Quality
            "cogs_coverage_percent": float(cogs_coverage_percent),
            "disclaimer": disclaimer,
            # Comparison placeholder
            "previous_period": None,
            "period_comparison": None
        }

        # Optional: compare with previous period
        if compare_previous:
            period_length = (end_date - start_date).days + 1
            prev_end = start_date - timedelta(days=1)
            prev_start = prev_end - timedelta(days=period_length - 1)
            prev_result = await self.get_income_statement(prev_start, prev_end, False)
            result["previous_period"] = prev_result
            result["period_comparison"] = self._calculate_period_comparison(
                result, prev_result
            )

        return result

    async def _calculate_revenue(
        self,
        start_datetime: datetime,
        end_datetime: datetime
    ) -> dict:
        """Calculate total revenue from completed sales"""
        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Sale.total), 0).label("total"),
                func.count(Sale.id).label("count")
            )
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime
            )
        )
        row = result.one()
        return {
            "total": float(row.total or 0),
            "count": row.count or 0
        }

    async def _calculate_cogs(
        self,
        start_datetime: datetime,
        end_datetime: datetime
    ) -> dict:
        """
        Calculate Cost of Goods Sold from SaleItems.

        Logic:
        - If Product.cost exists: use actual cost
        - If Product.cost is NULL: estimate as unit_price * 0.80
        """
        # For school products (product_id is not null)
        school_query = select(
            func.sum(
                case(
                    (Product.cost.isnot(None), SaleItem.quantity * Product.cost),
                    else_=SaleItem.quantity * SaleItem.unit_price * float(DEFAULT_COST_MARGIN)
                )
            ).label('total_cogs'),
            func.sum(
                case(
                    (Product.cost.isnot(None), SaleItem.quantity * Product.cost),
                    else_=0
                )
            ).label('actual_cogs'),
            func.sum(
                case(
                    (Product.cost.is_(None), SaleItem.quantity * SaleItem.unit_price * float(DEFAULT_COST_MARGIN)),
                    else_=0
                )
            ).label('estimated_cogs'),
            func.sum(
                case(
                    (Product.cost.isnot(None), SaleItem.quantity),
                    else_=0
                )
            ).label('items_with_cost'),
            func.sum(
                case(
                    (Product.cost.is_(None), SaleItem.quantity),
                    else_=0
                )
            ).label('items_estimated')
        ).select_from(SaleItem).join(
            Sale, Sale.id == SaleItem.sale_id
        ).join(
            Product, Product.id == SaleItem.product_id
        ).where(
            Sale.status == SaleStatus.COMPLETED,
            Sale.sale_date >= start_datetime,
            Sale.sale_date <= end_datetime,
            SaleItem.product_id.isnot(None)
        )

        school_result = await self.db.execute(school_query)
        school_row = school_result.one()

        # For global products (global_product_id is not null)
        global_query = select(
            func.sum(
                case(
                    (GlobalProduct.cost.isnot(None), SaleItem.quantity * GlobalProduct.cost),
                    else_=SaleItem.quantity * SaleItem.unit_price * float(DEFAULT_COST_MARGIN)
                )
            ).label('total_cogs'),
            func.sum(
                case(
                    (GlobalProduct.cost.isnot(None), SaleItem.quantity * GlobalProduct.cost),
                    else_=0
                )
            ).label('actual_cogs'),
            func.sum(
                case(
                    (GlobalProduct.cost.is_(None), SaleItem.quantity * SaleItem.unit_price * float(DEFAULT_COST_MARGIN)),
                    else_=0
                )
            ).label('estimated_cogs'),
            func.sum(
                case(
                    (GlobalProduct.cost.isnot(None), SaleItem.quantity),
                    else_=0
                )
            ).label('items_with_cost'),
            func.sum(
                case(
                    (GlobalProduct.cost.is_(None), SaleItem.quantity),
                    else_=0
                )
            ).label('items_estimated')
        ).select_from(SaleItem).join(
            Sale, Sale.id == SaleItem.sale_id
        ).join(
            GlobalProduct, GlobalProduct.id == SaleItem.global_product_id
        ).where(
            Sale.status == SaleStatus.COMPLETED,
            Sale.sale_date >= start_datetime,
            Sale.sale_date <= end_datetime,
            SaleItem.global_product_id.isnot(None)
        )

        global_result = await self.db.execute(global_query)
        global_row = global_result.one()

        # Combine results
        total_cogs = (school_row.total_cogs or 0) + (global_row.total_cogs or 0)
        actual_cogs = (school_row.actual_cogs or 0) + (global_row.actual_cogs or 0)
        estimated_cogs = (school_row.estimated_cogs or 0) + (global_row.estimated_cogs or 0)
        items_with_cost = (school_row.items_with_cost or 0) + (global_row.items_with_cost or 0)
        items_estimated = (school_row.items_estimated or 0) + (global_row.items_estimated or 0)

        return {
            "total": float(total_cogs),
            "from_actual_cost": float(actual_cogs),
            "from_estimated_cost": float(estimated_cogs),
            "items_with_actual_cost": int(items_with_cost),
            "items_with_estimated_cost": int(items_estimated)
        }

    async def _get_category_labels(self) -> dict[str, str]:
        """Load dynamic category labels from the database."""
        result = await self.db.execute(
            select(ExpenseCategoryModel.code, ExpenseCategoryModel.name)
            .where(ExpenseCategoryModel.is_active == True)
        )
        rows = result.all()
        labels = {row.code: row.name for row in rows}
        # Merge with fallback (DB takes priority)
        return {**EXPENSE_CATEGORY_LABELS_FALLBACK, **labels}

    async def _get_expenses_by_period(
        self,
        start_date: date,
        end_date: date
    ) -> dict:
        """
        Get expenses grouped by category for a period.

        Custom/unrecognized categories are classified as operating expenses
        to avoid silently losing them from the income statement.
        """
        result = await self.db.execute(
            select(
                Expense.category,
                func.sum(Expense.amount).label("total")
            )
            .where(
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
                Expense.is_active == True
            )
            .group_by(Expense.category)
        )
        rows = result.all()

        operating = {}
        other = {}

        for row in rows:
            cat_code = row.category.value if hasattr(row.category, 'value') else row.category
            amount = float(row.total or 0)

            # Skip production categories (excluded from P&L to avoid double-counting with COGS)
            if cat_code in EXCLUDED_EXPENSE_CODES or cat_code.startswith("prod_"):
                continue

            if cat_code in OTHER_EXPENSE_CODES:
                other[cat_code] = amount
            else:
                # Known operating + custom categories -> operating
                operating[cat_code] = amount

        return {
            "operating": operating,
            "other": other
        }

    async def _calculate_discounts(
        self,
        start_date: date,
        end_date: date
    ) -> dict:
        """
        Calculate total discounts given to customers in a period.

        Discounts are recorded as expenses with category='discounts'
        and are treated as revenue deductions in the Income Statement.
        """
        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Expense.amount), 0).label("total"),
                func.count(Expense.id).label("count")
            )
            .where(
                Expense.category == "discounts",
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
                Expense.is_active == True
            )
        )
        row = result.one()
        return {
            "total": float(row.total or 0),
            "count": row.count or 0
        }

    async def _calculate_sale_returns(
        self,
        start_date: date,
        end_date: date
    ) -> dict:
        """
        Calculate total refunds from sale changes in a period.

        Sale returns are recorded as Transaction with:
        - category = 'sale_changes' or 'order_changes'
        - type = EXPENSE (refunds to customers)

        These are treated as revenue deductions (returns) in the Income Statement,
        not as operating expenses.
        """
        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Transaction.amount), 0).label("total"),
                func.count(Transaction.id).label("count")
            )
            .where(
                Transaction.category.in_(["sale_changes", "order_changes"]),
                Transaction.type == TransactionType.EXPENSE,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            )
        )
        row = result.one()
        return {
            "total": float(row.total or 0),
            "count": row.count or 0
        }

    async def _get_other_expenses_details(
        self,
        start_date: date,
        end_date: date,
        limit: int = 50
    ) -> list[dict]:
        """
        Get detailed list of expenses with category 'other'.

        This helps users understand what specific expenses are grouped
        under the 'Otros' category in the Income Statement.
        """
        result = await self.db.execute(
            select(
                Expense.id,
                Expense.description,
                Expense.amount,
                Expense.expense_date,
                Expense.vendor
            )
            .where(
                Expense.category == "other",
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
                Expense.is_active == True
            )
            .order_by(Expense.amount.desc())
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "id": str(row.id),
                "description": row.description or "",
                "amount": float(row.amount),
                "date": row.expense_date.isoformat(),
                "vendor": row.vendor or ""
            }
            for row in rows
        ]

    async def _calculate_revenue_breakdown(
        self,
        start_datetime: datetime,
        end_datetime: datetime
    ) -> dict:
        """
        Calculate revenue breakdown by school and global products.

        Returns:
        {
            "by_school": [{"school_id": ..., "school_name": ..., "total": ..., "count": ...}],
            "global_products": {"total": ..., "count": ...}
        }
        """
        # Revenue by school
        school_result = await self.db.execute(
            select(
                Sale.school_id,
                School.name.label("school_name"),
                func.coalesce(func.sum(Sale.total), 0).label("total"),
                func.count(Sale.id).label("count")
            )
            .join(School, Sale.school_id == School.id)
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime
            )
            .group_by(Sale.school_id, School.name)
            .order_by(func.sum(Sale.total).desc())
        )
        school_rows = school_result.all()

        by_school = [
            {
                "school_id": str(row.school_id),
                "school_name": row.school_name,
                "total": float(row.total),
                "count": row.count
            }
            for row in school_rows
        ]

        # Global products revenue (SaleItems with global_product_id)
        global_result = await self.db.execute(
            select(
                func.coalesce(func.sum(SaleItem.subtotal), 0).label("total"),
                func.count(SaleItem.id).label("count")
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.sale_date >= start_datetime,
                Sale.sale_date <= end_datetime,
                SaleItem.global_product_id.isnot(None)
            )
        )
        global_row = global_result.one()

        return {
            "by_school": by_school,
            "global_products": {
                "total": float(global_row.total or 0),
                "count": global_row.count or 0
            }
        }

    def _calculate_period_comparison(
        self,
        current: dict,
        previous: dict
    ) -> dict:
        """Calculate comparison metrics between two periods"""
        def calc_change(curr, prev):
            if prev == 0:
                return None
            return ((curr - prev) / prev) * 100

        return {
            "revenue_change_percent": calc_change(
                current["gross_revenue"], previous["gross_revenue"]
            ),
            "gross_profit_change_percent": calc_change(
                current["gross_profit"], previous["gross_profit"]
            ),
            "operating_income_change_percent": calc_change(
                current["operating_income"], previous["operating_income"]
            ),
            "net_income_change_percent": calc_change(
                current["net_income"], previous["net_income"]
            )
        }

    # ============================================
    # Balance Sheet (Balance General)
    # ============================================

    async def get_balance_sheet(self, as_of_date: date | None = None) -> dict:
        """
        Generate Balance Sheet as of a specific date.

        Structure:
        - Assets (Current, Fixed, Other)
        - Liabilities (Current, Long-term)
        - Equity
        """
        if as_of_date is None:
            as_of_date = get_colombia_date()

        # Check if this is a historical query
        today = get_colombia_date()
        is_historical = as_of_date != today
        as_of_datetime = datetime.combine(as_of_date, datetime.max.time())

        # Get balance integration service for cash accounts
        balance_service = BalanceIntegrationService(self.db)

        # 1. CURRENT ASSETS
        # Cash accounts
        cash_data = await self._get_cash_accounts()

        # Accounts Receivable (filtered by as_of_date)
        ar_data = await self._get_accounts_receivable(as_of_datetime)

        # Inventory
        inventory_data = await self._get_inventory_valuation()

        # Other current assets
        other_current_assets = await self._get_balance_accounts_by_type(
            [AccountType.ASSET_CURRENT]
        )
        # Exclude cash accounts from other current
        cash_ids = {acc["id"] for acc in cash_data["accounts"]}
        other_current_assets = [
            acc for acc in other_current_assets if acc["id"] not in cash_ids
        ]

        total_current_assets = (
            Decimal(str(cash_data["total"])) +
            Decimal(str(ar_data["total"])) +
            Decimal(str(inventory_data["total_value"])) +
            sum(Decimal(str(acc["balance"])) for acc in other_current_assets)
        )

        # 2. FIXED ASSETS
        fixed_assets = await self._get_balance_accounts_by_type(
            [AccountType.ASSET_FIXED]
        )
        total_fixed_assets = sum(
            Decimal(str(acc["net_value"])) for acc in fixed_assets
        )

        # 3. OTHER ASSETS
        other_assets = await self._get_balance_accounts_by_type(
            [AccountType.ASSET_OTHER]
        )
        total_other_assets = sum(
            Decimal(str(acc["balance"])) for acc in other_assets
        )

        total_assets = total_current_assets + total_fixed_assets + total_other_assets

        # 4. CURRENT LIABILITIES
        # Accounts Payable (filtered by as_of_date)
        ap_data = await self._get_accounts_payable(as_of_datetime)

        # Pending Expenses (filtered by as_of_date)
        pending_expenses = await self._get_pending_expenses(as_of_date)

        # Short-term debt
        current_liabilities = await self._get_balance_accounts_by_type(
            [AccountType.LIABILITY_CURRENT]
        )

        # Other current liabilities
        other_current_liabilities = await self._get_balance_accounts_by_type(
            [AccountType.LIABILITY_OTHER]
        )

        total_current_liabilities = (
            Decimal(str(ap_data["total"])) +
            Decimal(str(pending_expenses["total"])) +
            sum(Decimal(str(acc["balance"])) for acc in current_liabilities) +
            sum(Decimal(str(acc["balance"])) for acc in other_current_liabilities)
        )

        # 5. LONG-TERM LIABILITIES
        long_term_liabilities = await self._get_balance_accounts_by_type(
            [AccountType.LIABILITY_LONG]
        )
        total_long_term_liabilities = sum(
            Decimal(str(acc["balance"])) for acc in long_term_liabilities
        )

        total_liabilities = total_current_liabilities + total_long_term_liabilities

        # 6. EQUITY
        equity_data = await self._get_equity()

        # 7. Calculate current period earnings (Utilidad del Ejercicio)
        # From Jan 1 of the current fiscal year to as_of_date
        fiscal_year_start = as_of_date.replace(month=1, day=1)
        current_period_earnings = await self._calculate_current_period_earnings(
            fiscal_year_start, as_of_date
        )

        total_equity = (
            Decimal(str(equity_data["total"])) +
            Decimal(str(current_period_earnings))
        )

        # Validation
        is_balanced = abs(total_assets - (total_liabilities + total_equity)) < Decimal("0.01")
        balance_difference = total_assets - (total_liabilities + total_equity)
        net_worth = total_assets - total_liabilities

        # Inventory coverage
        inventory_coverage = (
            Decimal(str(inventory_data["coverage_percent"]))
            if inventory_data["total_units"] > 0 else Decimal("100")
        )

        disclaimer = None
        if inventory_coverage < 100:
            disclaimer = (
                f"Nota: {100 - float(inventory_coverage):.1f}% del inventario "
                f"esta valorado con costo estimado (margen {float(DEFAULT_COST_MARGIN) * 100:.0f}%)"
            )

        return {
            "as_of_date": as_of_date.isoformat(),
            # Current Assets
            "current_assets": {
                "cash_accounts": cash_data["accounts"],
                "total_cash": float(cash_data["total"]),
                "accounts_receivable": float(ar_data["total"]),
                "accounts_receivable_count": ar_data["count"],
                "inventory": {
                    "total_value": float(inventory_data["total_value"]),
                    "total_units": inventory_data["total_units"],
                    "from_actual_cost": float(inventory_data["from_actual_cost"]),
                    "from_estimated_cost": float(inventory_data["from_estimated_cost"]),
                    "coverage_percent": float(inventory_data["coverage_percent"])
                },
                "total_inventory": float(inventory_data["total_value"]),
                "other_current": [
                    {
                        "id": acc["id"],
                        "name": acc["name"],
                        "code": acc.get("code"),
                        "balance": float(acc["balance"]),
                        "net_value": float(acc["balance"])
                    }
                    for acc in other_current_assets
                ],
                "total_other_current": float(sum(
                    Decimal(str(acc["balance"])) for acc in other_current_assets
                ))
            },
            "total_current_assets": float(total_current_assets),
            # Fixed Assets
            "fixed_assets": [
                {
                    "id": acc["id"],
                    "name": acc["name"],
                    "code": acc.get("code"),
                    "balance": float(acc["balance"]),
                    "net_value": float(acc["net_value"])
                }
                for acc in fixed_assets
            ],
            "total_fixed_assets": float(total_fixed_assets),
            # Other Assets
            "other_assets": [
                {
                    "id": acc["id"],
                    "name": acc["name"],
                    "code": acc.get("code"),
                    "balance": float(acc["balance"]),
                    "net_value": float(acc["balance"])
                }
                for acc in other_assets
            ],
            "total_other_assets": float(total_other_assets),
            "total_assets": float(total_assets),
            # Current Liabilities
            "current_liabilities": {
                "accounts_payable": float(ap_data["total"]),
                "accounts_payable_count": ap_data["count"],
                "pending_expenses": float(pending_expenses["total"]),
                "pending_expenses_count": pending_expenses["count"],
                "short_term_debt": [
                    {
                        "id": acc["id"],
                        "name": acc["name"],
                        "code": acc.get("code"),
                        "balance": float(acc["balance"]),
                        "net_value": float(acc["balance"])
                    }
                    for acc in current_liabilities
                ],
                "total_short_term_debt": float(sum(
                    Decimal(str(acc["balance"])) for acc in current_liabilities
                )),
                "other_current": [
                    {
                        "id": acc["id"],
                        "name": acc["name"],
                        "code": acc.get("code"),
                        "balance": float(acc["balance"]),
                        "net_value": float(acc["balance"])
                    }
                    for acc in other_current_liabilities
                ],
                "total_other_current": float(sum(
                    Decimal(str(acc["balance"])) for acc in other_current_liabilities
                ))
            },
            "total_current_liabilities": float(total_current_liabilities),
            # Long-term Liabilities
            "long_term_liabilities": [
                {
                    "id": acc["id"],
                    "name": acc["name"],
                    "code": acc.get("code"),
                    "balance": float(acc["balance"]),
                    "net_value": float(acc["balance"])
                }
                for acc in long_term_liabilities
            ],
            "total_long_term_liabilities": float(total_long_term_liabilities),
            # No other liabilities category needed - we use LIABILITY_OTHER
            "other_liabilities": [],
            "total_other_liabilities": 0,
            "total_liabilities": float(total_liabilities),
            # Equity
            "equity": {
                "capital": float(equity_data["capital"]),
                "retained_earnings": float(equity_data["retained_earnings"]),
                "current_period_earnings": float(current_period_earnings),
                "other_equity": float(equity_data["other"]),
                "accounts": [
                    {
                        "id": acc["id"],
                        "name": acc["name"],
                        "code": acc.get("code"),
                        "balance": float(acc["balance"]),
                        "net_value": float(acc["balance"])
                    }
                    for acc in equity_data["accounts"]
                ]
            },
            "total_equity": float(total_equity),
            # Validation
            "is_balanced": is_balanced,
            "balance_difference": float(balance_difference),
            "net_worth": float(net_worth),
            # Data quality
            "inventory_coverage_percent": float(inventory_coverage),
            "disclaimer": disclaimer,
            "historical_note": (
                "Nota: Los saldos de cuentas bancarias, caja, activos fijos, inventario "
                "y patrimonio reflejan valores actuales, no históricos. "
                "Las CxC, CxP y gastos pendientes sí están filtrados por fecha."
            ) if is_historical else None
        }

    async def _get_cash_accounts(self) -> dict:
        """Get all cash/bank accounts (global accounts)"""
        # Cash account codes: 1101=Caja Menor, 1102=Caja Mayor, 1103=Nequi, 1104=Banco
        CASH_ACCOUNT_CODES = ["1101", "1102", "1103", "1104"]
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.ASSET_CURRENT,
                BalanceAccount.code.in_(CASH_ACCOUNT_CODES),
                BalanceAccount.is_active == True
            )
            .order_by(BalanceAccount.code)
        )
        accounts = result.scalars().all()

        total = Decimal("0")
        account_list = []

        for acc in accounts:
            total += acc.balance
            account_list.append({
                "id": str(acc.id),
                "name": acc.name,
                "code": acc.code,
                "balance": float(acc.balance)
            })

        return {
            "accounts": account_list,
            "total": float(total)
        }

    async def _get_accounts_receivable(
        self, as_of_datetime: datetime | None = None
    ) -> dict:
        """Get total pending accounts receivable, optionally filtered by date"""
        query = (
            select(
                func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid),
                func.count(AccountsReceivable.id)
            )
            .where(
                AccountsReceivable.is_paid == False
            )
        )
        if as_of_datetime is not None:
            query = query.where(AccountsReceivable.created_at <= as_of_datetime)
        result = await self.db.execute(query)
        total, count = result.one()
        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def _get_accounts_payable(
        self, as_of_datetime: datetime | None = None
    ) -> dict:
        """Get total pending accounts payable, optionally filtered by date"""
        query = (
            select(
                func.sum(AccountsPayable.amount - AccountsPayable.amount_paid),
                func.count(AccountsPayable.id)
            )
            .where(
                AccountsPayable.is_paid == False
            )
        )
        if as_of_datetime is not None:
            query = query.where(AccountsPayable.created_at <= as_of_datetime)
        result = await self.db.execute(query)
        total, count = result.one()
        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def _get_pending_expenses(
        self, as_of_date: date | None = None
    ) -> dict:
        """Get total unpaid expenses, optionally filtered by date"""
        query = (
            select(
                func.sum(Expense.amount - Expense.amount_paid),
                func.count(Expense.id)
            )
            .where(
                Expense.is_paid == False,
                Expense.is_active == True
            )
        )
        if as_of_date is not None:
            query = query.where(Expense.expense_date <= as_of_date)
        result = await self.db.execute(query)
        total, count = result.one()
        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def _get_inventory_valuation(self) -> dict:
        """Get total inventory value across all schools and global products"""
        total_value = Decimal("0")
        total_units = 0
        from_actual_cost = Decimal("0")
        from_estimated_cost = Decimal("0")
        items_with_cost = 0
        items_estimated = 0

        # School products
        school_result = await self.db.execute(
            select(Product, Inventory)
            .join(Inventory, Product.id == Inventory.product_id)
            .where(
                Product.is_active == True,
                Inventory.quantity > 0
            )
        )
        school_rows = school_result.all()

        for product, inventory in school_rows:
            quantity = inventory.quantity
            total_units += quantity

            if product.cost is not None:
                cost = Decimal(str(product.cost))
                item_value = cost * quantity
                from_actual_cost += item_value
                items_with_cost += quantity
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                item_value = cost * quantity
                from_estimated_cost += item_value
                items_estimated += quantity

            total_value += item_value

        # Global products
        global_result = await self.db.execute(
            select(GlobalProduct, GlobalInventory)
            .join(GlobalInventory, GlobalProduct.id == GlobalInventory.product_id)
            .where(
                GlobalProduct.is_active == True,
                GlobalInventory.quantity > 0
            )
        )
        global_rows = global_result.all()

        for product, inventory in global_rows:
            quantity = inventory.quantity
            total_units += quantity

            if product.cost is not None:
                cost = Decimal(str(product.cost))
                item_value = cost * quantity
                from_actual_cost += item_value
                items_with_cost += quantity
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                item_value = cost * quantity
                from_estimated_cost += item_value
                items_estimated += quantity

            total_value += item_value

        coverage_percent = (
            Decimal(str(items_with_cost)) / Decimal(str(total_units)) * 100
            if total_units > 0 else Decimal("100")
        )

        return {
            "total_value": float(total_value),
            "total_units": total_units,
            "from_actual_cost": float(from_actual_cost),
            "from_estimated_cost": float(from_estimated_cost),
            "coverage_percent": float(coverage_percent)
        }

    async def _get_balance_accounts_by_type(
        self,
        account_types: list[AccountType]
    ) -> list[dict]:
        """Get balance accounts by account type"""
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type.in_(account_types),
                BalanceAccount.is_active == True
            )
            .order_by(BalanceAccount.name)
        )
        accounts = result.scalars().all()

        return [
            {
                "id": str(acc.id),
                "name": acc.name,
                "code": acc.code,
                "balance": float(acc.balance),
                "net_value": float(acc.net_value)
            }
            for acc in accounts
        ]

    async def _get_equity(self) -> dict:
        """Get equity breakdown"""
        # Get all equity accounts
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type.in_([
                    AccountType.EQUITY_CAPITAL,
                    AccountType.EQUITY_RETAINED,
                    AccountType.EQUITY_OTHER
                ]),
                BalanceAccount.is_active == True
            )
            .order_by(BalanceAccount.account_type, BalanceAccount.name)
        )
        accounts = result.scalars().all()

        capital = Decimal("0")
        retained = Decimal("0")
        other = Decimal("0")
        account_list = []

        for acc in accounts:
            account_list.append({
                "id": str(acc.id),
                "name": acc.name,
                "code": acc.code,
                "balance": float(acc.balance),
                "account_type": acc.account_type.value
            })

            if acc.account_type == AccountType.EQUITY_CAPITAL:
                capital += acc.balance
            elif acc.account_type == AccountType.EQUITY_RETAINED:
                retained += acc.balance
            else:
                other += acc.balance

        return {
            "capital": float(capital),
            "retained_earnings": float(retained),
            "other": float(other),
            "total": float(capital + retained + other),
            "accounts": account_list
        }

    async def _calculate_current_period_earnings(
        self,
        start_date: date,
        end_date: date
    ) -> float:
        """
        Calculate net income for the current fiscal period.

        This is needed for the Balance Sheet to balance:
        Assets = Liabilities + Equity + Current Period Earnings

        Uses a simplified calculation:
        Revenue - COGS - Operating Expenses - Other Expenses = Net Income
        """
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        # Revenue
        revenue_data = await self._calculate_revenue(start_datetime, end_datetime)
        revenue = Decimal(str(revenue_data["total"]))

        # Discounts (deducted from revenue)
        discounts_data = await self._calculate_discounts(start_date, end_date)
        discounts = Decimal(str(discounts_data["total"]))

        # COGS
        cogs_data = await self._calculate_cogs(start_datetime, end_datetime)
        cogs = Decimal(str(cogs_data["total"]))

        # All expenses (operating + other, excluding inventory)
        expenses_data = await self._get_expenses_by_period(start_date, end_date)
        total_expenses = sum(
            Decimal(str(v)) for v in expenses_data["operating"].values()
        ) + sum(
            Decimal(str(v)) for v in expenses_data["other"].values()
        )

        net_income = revenue - discounts - cogs - total_expenses
        return float(net_income)

    # ============================================
    # Period Presets
    # ============================================

    async def get_available_periods(self) -> dict:
        """Get predefined period options for financial statements"""
        today = get_colombia_date()

        # This month
        this_month_start = today.replace(day=1)
        if today.month == 12:
            this_month_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            this_month_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

        # Last month
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        # This quarter
        quarter = (today.month - 1) // 3
        this_quarter_start = today.replace(month=quarter * 3 + 1, day=1)
        if quarter == 3:
            this_quarter_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            this_quarter_end = today.replace(month=(quarter + 1) * 3 + 1, day=1) - timedelta(days=1)

        # Last quarter
        last_quarter = quarter - 1 if quarter > 0 else 3
        last_quarter_year = today.year if quarter > 0 else today.year - 1
        last_quarter_start = date(last_quarter_year, last_quarter * 3 + 1, 1)
        if last_quarter == 3:
            last_quarter_end = date(last_quarter_year + 1, 1, 1) - timedelta(days=1)
        else:
            last_quarter_end = date(last_quarter_year, (last_quarter + 1) * 3 + 1, 1) - timedelta(days=1)

        # This year
        this_year_start = today.replace(month=1, day=1)
        this_year_end = today.replace(month=12, day=31)

        # Last year
        last_year_start = date(today.year - 1, 1, 1)
        last_year_end = date(today.year - 1, 12, 31)

        # Find earliest sale date
        result = await self.db.execute(
            select(func.min(Sale.sale_date))
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        earliest = result.scalar()
        earliest_date = earliest.date() if earliest else None

        presets = [
            {
                "key": "this_month",
                "label": "Este mes",
                "start_date": this_month_start.isoformat(),
                "end_date": min(this_month_end, today).isoformat()
            },
            {
                "key": "last_month",
                "label": "Mes anterior",
                "start_date": last_month_start.isoformat(),
                "end_date": last_month_end.isoformat()
            },
            {
                "key": "this_quarter",
                "label": "Este trimestre",
                "start_date": this_quarter_start.isoformat(),
                "end_date": min(this_quarter_end, today).isoformat()
            },
            {
                "key": "last_quarter",
                "label": "Trimestre anterior",
                "start_date": last_quarter_start.isoformat(),
                "end_date": last_quarter_end.isoformat()
            },
            {
                "key": "this_year",
                "label": "Este ano",
                "start_date": this_year_start.isoformat(),
                "end_date": min(this_year_end, today).isoformat()
            },
            {
                "key": "last_year",
                "label": "Ano anterior",
                "start_date": last_year_start.isoformat(),
                "end_date": last_year_end.isoformat()
            }
        ]

        return {
            "presets": presets,
            "earliest_data_date": earliest_date.isoformat() if earliest_date else None
        }
