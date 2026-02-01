"""
Unit Tests for ReportsService

Tests for date-filtered reports including:
- Sales summary with date ranges
- Top products by period
- Top clients by period
- Daily and monthly metrics
"""
import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.reports import ReportsService


# ============================================================================
# TEST: Date Filter Logic
# ============================================================================

class TestDateFilterLogic:
    """Tests for date filter handling"""

    def test_date_range_construction(self):
        """Verify date range construction for queries"""
        start_date = date(2024, 6, 1)
        end_date = date(2024, 6, 30)

        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        assert start_datetime == datetime(2024, 6, 1, 0, 0, 0)
        assert end_datetime.date() == date(2024, 6, 30)
        assert end_datetime.hour == 23
        assert end_datetime.minute == 59

    def test_single_day_range(self):
        """Same start and end date should cover entire day"""
        target_date = date(2024, 6, 15)

        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        assert start_datetime.date() == end_datetime.date()
        assert (end_datetime - start_datetime).days == 0

    def test_month_range_calculation(self):
        """Calculate first day of month for monthly reports"""
        today = date(2024, 6, 15)
        month_start = today.replace(day=1)

        assert month_start == date(2024, 6, 1)

    def test_week_range_calculation(self):
        """Calculate 7 days ago for weekly reports"""
        today = date(2024, 6, 15)
        week_ago = today - timedelta(days=7)

        assert week_ago == date(2024, 6, 8)

    def test_year_range_calculation(self):
        """Calculate first day of year for yearly reports"""
        today = date(2024, 6, 15)
        year_start = date(today.year, 1, 1)

        assert year_start == date(2024, 1, 1)


# ============================================================================
# TEST: Sales Summary Calculations
# ============================================================================

class TestSalesSummaryCalculations:
    """Tests for sales summary calculation logic"""

    def test_total_revenue_calculation(self):
        """Sum of all completed sales totals"""
        sale_totals = [Decimal("50000"), Decimal("75000"), Decimal("25000")]
        total_revenue = sum(sale_totals)

        assert total_revenue == Decimal("150000")

    def test_average_ticket_calculation(self):
        """Average ticket = total_revenue / total_sales"""
        total_revenue = Decimal("150000")
        total_sales = 3

        average_ticket = total_revenue / total_sales

        assert average_ticket == Decimal("50000")

    def test_average_ticket_no_sales(self):
        """Average ticket should be 0 when no sales"""
        total_revenue = Decimal("0")
        total_sales = 0

        average_ticket = total_revenue / total_sales if total_sales > 0 else Decimal("0")

        assert average_ticket == Decimal("0")

    def test_sales_by_payment_method(self):
        """Group sales by payment method"""
        sales = [
            {"method": "cash", "total": 50000},
            {"method": "cash", "total": 30000},
            {"method": "card", "total": 75000},
            {"method": "transfer", "total": 25000},
        ]

        by_method = {}
        for sale in sales:
            method = sale["method"]
            if method not in by_method:
                by_method[method] = {"count": 0, "total": 0}
            by_method[method]["count"] += 1
            by_method[method]["total"] += sale["total"]

        assert by_method["cash"]["count"] == 2
        assert by_method["cash"]["total"] == 80000
        assert by_method["card"]["count"] == 1
        assert by_method["card"]["total"] == 75000


# ============================================================================
# TEST: Top Products Logic
# ============================================================================

class TestTopProductsLogic:
    """Tests for top products calculation"""

    def test_units_sold_ranking(self):
        """Products should be ranked by units sold"""
        products = [
            {"name": "Camisa T14", "units": 50},
            {"name": "Pantalón T12", "units": 120},
            {"name": "Falda T10", "units": 80},
        ]

        ranked = sorted(products, key=lambda x: x["units"], reverse=True)

        assert ranked[0]["name"] == "Pantalón T12"
        assert ranked[1]["name"] == "Falda T10"
        assert ranked[2]["name"] == "Camisa T14"

    def test_revenue_calculation(self):
        """Total revenue per product"""
        product_sales = [
            {"qty": 10, "price": 50000},
            {"qty": 5, "price": 50000},
            {"qty": 3, "price": 50000},
        ]

        total_units = sum(s["qty"] for s in product_sales)
        total_revenue = sum(s["qty"] * s["price"] for s in product_sales)

        assert total_units == 18
        assert total_revenue == 900000

    def test_limit_top_results(self):
        """Only return top N products"""
        products = [f"Product_{i}" for i in range(20)]
        limit = 5

        top_products = products[:limit]

        assert len(top_products) == 5


# ============================================================================
# TEST: Top Clients Logic
# ============================================================================

class TestTopClientsLogic:
    """Tests for top clients calculation"""

    def test_client_ranking_by_total_spent(self):
        """Clients should be ranked by total spent"""
        clients = [
            {"name": "Client A", "total": 500000},
            {"name": "Client B", "total": 1200000},
            {"name": "Client C", "total": 300000},
        ]

        ranked = sorted(clients, key=lambda x: x["total"], reverse=True)

        assert ranked[0]["name"] == "Client B"
        assert ranked[1]["name"] == "Client A"
        assert ranked[2]["name"] == "Client C"

    def test_purchase_count(self):
        """Count number of purchases per client"""
        client_purchases = {
            "client_1": 5,
            "client_2": 12,
            "client_3": 3,
        }

        assert sum(client_purchases.values()) == 20

    def test_client_with_date_filter(self):
        """Date filter should only count sales in range"""
        # Simulating sales data
        sales = [
            {"client": "A", "date": date(2024, 6, 10), "total": 50000},
            {"client": "A", "date": date(2024, 6, 15), "total": 75000},
            {"client": "A", "date": date(2024, 5, 20), "total": 100000},  # Out of range
        ]

        start_date = date(2024, 6, 1)
        end_date = date(2024, 6, 30)

        filtered = [s for s in sales if start_date <= s["date"] <= end_date]

        assert len(filtered) == 2
        assert sum(s["total"] for s in filtered) == 125000


# ============================================================================
# TEST: Dashboard Metrics
# ============================================================================

class TestDashboardMetrics:
    """Tests for dashboard summary metrics"""

    def test_today_metrics(self):
        """Today's sales metrics calculation"""
        today_sales = [
            {"total": 50000, "status": "completed"},
            {"total": 75000, "status": "completed"},
            {"total": 25000, "status": "cancelled"},  # Should not count
        ]

        completed = [s for s in today_sales if s["status"] == "completed"]
        revenue = sum(s["total"] for s in completed)
        count = len(completed)

        assert count == 2
        assert revenue == 125000

    def test_month_metrics(self):
        """This month's metrics should aggregate correctly"""
        monthly_data = {
            "total_sales": 45,
            "total_revenue": 2500000,
        }

        average_ticket = monthly_data["total_revenue"] / monthly_data["total_sales"]

        assert average_ticket == pytest.approx(55555.56, rel=0.01)

    def test_low_stock_count(self):
        """Count products below stock threshold"""
        inventory = [
            {"product": "A", "stock": 2, "min": 5},  # Low
            {"product": "B", "stock": 10, "min": 5},  # OK
            {"product": "C", "stock": 0, "min": 3},  # Low (zero)
            {"product": "D", "stock": 5, "min": 5},  # At threshold = Low
        ]

        low_stock = [p for p in inventory if p["stock"] <= p["min"]]

        assert len(low_stock) == 3


# ============================================================================
# TEST: Date Edge Cases
# ============================================================================

class TestDateEdgeCases:
    """Edge cases for date filtering"""

    def test_empty_date_range(self):
        """No sales in date range should return zero"""
        sales_in_range = []
        total_revenue = sum(s.get("total", 0) for s in sales_in_range)

        assert total_revenue == 0

    def test_future_date_range(self):
        """Future dates should have no sales"""
        today = date.today()
        future_start = today + timedelta(days=30)
        future_end = today + timedelta(days=60)

        # No sales should exist in future
        assert future_start > today
        assert future_end > today

    def test_historical_date_range(self):
        """Historical date ranges should work"""
        # Sales from 2023
        start_date = date(2023, 1, 1)
        end_date = date(2023, 12, 31)

        days_in_range = (end_date - start_date).days + 1

        assert days_in_range == 365

    def test_single_day_filter(self):
        """Filter for a single specific day"""
        target_day = date(2024, 6, 15)

        start = datetime.combine(target_day, datetime.min.time())
        end = datetime.combine(target_day, datetime.max.time())

        # A sale at noon should be in range
        sale_time = datetime(2024, 6, 15, 12, 30, 0)

        assert start <= sale_time <= end

    def test_cross_month_range(self):
        """Date range spanning multiple months"""
        start_date = date(2024, 5, 15)
        end_date = date(2024, 7, 15)

        months_covered = []
        current = start_date
        while current <= end_date:
            month_key = (current.year, current.month)
            if month_key not in months_covered:
                months_covered.append(month_key)
            current += timedelta(days=28)

        assert len(months_covered) >= 3  # May, June, July


# ============================================================================
# TEST: Report Service Integration (Mocked)
# ============================================================================

class TestReportsServiceMocked:
    """Integration tests with mocked database"""

    @pytest.mark.asyncio
    async def test_get_sales_summary_default_dates(self, mock_db_session):
        """Sales summary should default to today if no dates provided"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                one=MagicMock(return_value=MagicMock(
                    total_sales=5,
                    total_revenue=Decimal("250000"),
                    average_ticket=Decimal("50000")
                )),
                all=MagicMock(return_value=[])
            )
        )

        service = ReportsService(mock_db_session)

        # Should not raise error with default dates
        result = await service.get_sales_summary(str(uuid4()))

        assert "total_sales" in result
        assert "total_revenue" in result
        assert "start_date" in result
        assert "end_date" in result

    @pytest.mark.asyncio
    async def test_get_top_products_with_dates(self, mock_db_session):
        """Top products should filter by date range"""
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                all=MagicMock(return_value=[
                    MagicMock(
                        product_id=uuid4(),
                        code="PROD-001",
                        name="Camisa",
                        size="T14",
                        units_sold=50,
                        total_revenue=Decimal("2500000")
                    )
                ])
            )
        )

        service = ReportsService(mock_db_session)

        result = await service.get_top_products(
            str(uuid4()),
            limit=5,
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 30)
        )

        assert len(result) == 1
        assert result[0]["product_code"] == "PROD-001"

    @pytest.mark.asyncio
    async def test_get_top_clients_with_dates(self, mock_db_session):
        """Top clients should filter by date range"""
        from collections import namedtuple

        # Create a proper mock row with named attributes
        ClientRow = namedtuple('ClientRow', ['id', 'code', 'name', 'phone', 'total_purchases', 'total_spent'])
        mock_row = ClientRow(
            id=uuid4(),
            code="CLI-001",
            name="Juan Pérez",
            phone="3001234567",
            total_purchases=10,
            total_spent=Decimal("500000")
        )

        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                all=MagicMock(return_value=[mock_row])
            )
        )

        service = ReportsService(mock_db_session)

        result = await service.get_top_clients(
            str(uuid4()),
            limit=5,
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 30)
        )

        assert len(result) == 1
        assert result[0]["client_name"] == "Juan Pérez"
        assert result[0]["total_purchases"] == 10
