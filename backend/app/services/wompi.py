"""
Wompi Payment Gateway Service

Handles:
- Integrity signature generation
- Payment session creation (for checkout redirect)
- Webhook signature validation and processing
- Accounting integration on approved payments
"""
import hashlib
import hmac
import httpx
import logging
import time
from uuid import UUID
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.utils.timezone import get_colombia_now_naive, get_colombia_date
from app.models.payment_transaction import PaymentTransaction, WompiTransactionStatus
from app.models.order import Order
from app.models.sale import SaleSource
from app.models.accounting import (
    AccountsReceivable,
    Transaction,
    TransactionType,
    AccPaymentMethod,
    Expense,
)
from app.schemas.payment_transaction import PaymentSessionCreate, PaymentSessionResponse

logger = logging.getLogger(__name__)

# Map Wompi payment method types to our AccPaymentMethod
# Wompi deposits ALL payments to the merchant's bank account (Bancolombia),
# regardless of how the customer paid (card, PSE, Nequi, etc).
# So all Wompi payments map to TRANSFER (Banco).
WOMPI_TO_ACC_PAYMENT_METHOD = {
    "CARD": AccPaymentMethod.TRANSFER,
    "PSE": AccPaymentMethod.TRANSFER,
    "NEQUI": AccPaymentMethod.TRANSFER,
    "BANCOLOMBIA_TRANSFER": AccPaymentMethod.TRANSFER,
    "BANCOLOMBIA_QR": AccPaymentMethod.TRANSFER,
    "BANCOLOMBIA_COLLECT": AccPaymentMethod.TRANSFER,
    "DAVIPLATA": AccPaymentMethod.TRANSFER,
}


class WompiService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Signature Generation ───────────────────────────────────────

    @staticmethod
    def generate_integrity_signature(
        reference: str,
        amount_in_cents: int,
        currency: str = "COP",
    ) -> str:
        """
        Generate SHA-256 integrity signature for Wompi.
        Format: SHA256("{reference}{amount_in_cents}{currency}{integrity_key}")
        """
        raw = f"{reference}{amount_in_cents}{currency}{settings.WOMPI_INTEGRITY_KEY}"
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def validate_webhook_signature(payload: dict) -> bool:
        """
        Validate Wompi webhook checksum.

        Algorithm:
        1. Read signature.properties (dot-notation paths)
        2. Extract values from data object
        3. Concatenate values + timestamp + events_key
        4. SHA-256 and compare with checksum
        """
        try:
            signature = payload.get("signature", {})
            properties = signature.get("properties", [])
            checksum = signature.get("checksum", "")
            timestamp = payload.get("timestamp", "")
            data = payload.get("data", {})

            # Extract property values using dot notation
            values = []
            for prop in properties:
                parts = prop.split(".")
                value = data
                for part in parts:
                    if isinstance(value, dict):
                        value = value.get(part)
                    else:
                        value = None
                        break
                values.append(str(value) if value is not None else "")

            # Concatenate: values + timestamp + events_key
            concat = "".join(values) + str(timestamp) + settings.WOMPI_EVENTS_KEY
            expected = hashlib.sha256(concat.encode()).hexdigest()

            return hmac.compare_digest(expected, checksum)
        except Exception as e:
            logger.error(f"Webhook signature validation error: {e}")
            return False

    # ─── Payment Session ────────────────────────────────────────────

    async def create_payment_session(
        self,
        data: PaymentSessionCreate,
        client_id: UUID | None = None,
    ) -> PaymentSessionResponse:
        """
        Create a payment session for Wompi checkout redirect.

        1. Load order or receivable, validate it's payable
        2. Generate unique reference
        3. Calculate amount_in_cents
        4. Generate integrity signature
        5. Create PaymentTransaction record (PENDING)
        6. Return session data for frontend redirect
        """
        if not settings.WOMPI_ENABLED:
            raise ValueError("Pagos en linea no estan habilitados")

        amount_cop: Decimal
        school_id: UUID | None = None
        description: str
        order: Order | None = None
        receivable: AccountsReceivable | None = None

        if data.order_id:
            result = await self.db.execute(
                select(Order).where(Order.id == data.order_id)
            )
            order = result.scalar_one_or_none()
            if not order:
                raise ValueError("Pedido no encontrado")
            if order.balance <= 0:
                raise ValueError("Este pedido ya esta pagado")

            # Prevent double payment: reject if there's already a PENDING transaction
            existing = await self.db.execute(
                select(PaymentTransaction).where(
                    PaymentTransaction.order_id == data.order_id,
                    PaymentTransaction.status == WompiTransactionStatus.PENDING,
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(
                    "Ya existe un pago en proceso para este pedido. "
                    "Espera unos minutos o revisa en Mis Pedidos."
                )

            amount_cop = order.balance
            school_id = order.school_id
            client_id = client_id or order.client_id
            description = f"Pago encargo {order.code}"
            ref_code = order.code

        elif data.receivable_id:
            result = await self.db.execute(
                select(AccountsReceivable).where(
                    AccountsReceivable.id == data.receivable_id
                )
            )
            receivable = result.scalar_one_or_none()
            if not receivable:
                raise ValueError("Cuenta por cobrar no encontrada")
            if receivable.is_paid:
                raise ValueError("Esta cuenta ya esta pagada")

            amount_cop = receivable.balance
            school_id = receivable.school_id
            client_id = client_id or receivable.client_id
            description = f"Pago CxC: {receivable.description[:50]}"
            ref_code = f"CXC-{str(receivable.id)[:8]}"

        else:
            raise ValueError("Debe especificar order_id o receivable_id")

        # Generate unique reference
        timestamp = int(time.time())
        reference = f"WP-{ref_code}-{timestamp}"

        # Convert COP to cents
        amount_in_cents = int(amount_cop * 100)

        # Generate integrity signature
        signature = self.generate_integrity_signature(reference, amount_in_cents)

        # Create payment transaction record
        payment_tx = PaymentTransaction(
            reference=reference,
            order_id=data.order_id,
            receivable_id=data.receivable_id,
            school_id=school_id,
            client_id=client_id,
            amount_in_cents=amount_in_cents,
            currency="COP",
            status=WompiTransactionStatus.PENDING,
            integrity_signature=signature,
        )
        self.db.add(payment_tx)
        await self.db.flush()

        return PaymentSessionResponse(
            reference=reference,
            amount_in_cents=amount_in_cents,
            currency="COP",
            public_key=settings.WOMPI_PUBLIC_KEY,
            integrity_signature=signature,
            redirect_url=settings.WOMPI_REDIRECT_URL,
            description=description,
        )

    # ─── Webhook Processing ─────────────────────────────────────────

    async def process_webhook(self, payload: dict) -> bool:
        """
        Process Wompi webhook event.

        1. Validate signature
        2. Extract transaction data
        3. Find PaymentTransaction by reference
        4. Update status
        5. If APPROVED: apply accounting
        """
        # Validate webhook signature
        if not self.validate_webhook_signature(payload):
            logger.warning("Invalid Wompi webhook signature")
            return False

        event = payload.get("event", "")
        if event != "transaction.updated":
            logger.info(f"Ignoring Wompi event: {event}")
            return True

        tx_data = payload.get("data", {}).get("transaction", {})
        reference = tx_data.get("reference")
        wompi_status = tx_data.get("status")
        wompi_id = tx_data.get("id")
        payment_method_type = tx_data.get("payment_method_type")

        if not reference:
            logger.error("Webhook missing reference")
            return False

        # Find our payment transaction
        result = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.reference == reference
            )
        )
        payment_tx = result.scalar_one_or_none()

        if not payment_tx:
            logger.error(f"PaymentTransaction not found for reference: {reference}")
            return False

        # Idempotency: skip if already processed to final state
        if payment_tx.status != WompiTransactionStatus.PENDING:
            logger.info(f"Payment {reference} already in state {payment_tx.status}, skipping")
            return True

        # Update payment transaction
        try:
            payment_tx.status = WompiTransactionStatus(wompi_status)
        except ValueError:
            payment_tx.status = WompiTransactionStatus.ERROR

        payment_tx.wompi_transaction_id = wompi_id
        payment_tx.payment_method_type = payment_method_type
        payment_tx.status_message = tx_data.get("status_message")
        payment_tx.wompi_response_data = tx_data
        payment_tx.completed_at = get_colombia_now_naive()

        # Extract fee info from Wompi response
        await self._extract_fees(payment_tx, tx_data)

        # If approved, apply accounting
        if payment_tx.status == WompiTransactionStatus.APPROVED:
            await self._apply_approved_payment(payment_tx)

        # Telegram alert for payment result
        try:
            from app.services.telegram import fire_and_forget_routed_alert
            from app.services.telegram_messages import TelegramMessageBuilder

            if payment_tx.status in (WompiTransactionStatus.APPROVED, WompiTransactionStatus.DECLINED, WompiTransactionStatus.ERROR):
                amount_cop = Decimal(str(payment_tx.amount_in_cents / 100)) if payment_tx.amount_in_cents else Decimal("0")
                msg = TelegramMessageBuilder.wompi_payment(
                    status=payment_tx.status.value,
                    amount=amount_cop,
                    reference=payment_tx.reference,
                )
                fire_and_forget_routed_alert("wompi_payment", msg)
        except Exception:
            pass

        await self.db.flush()
        return True

    async def _extract_fees(self, payment_tx: PaymentTransaction, tx_data: dict):
        """Extract Wompi fee/commission from transaction data if available."""
        try:
            # Wompi may include fee info in different places depending on API version
            # Try common paths in the transaction data
            fee_cents = None
            fee_tax_cents = None

            # Path 1: top-level fees
            if "fees" in tx_data:
                fees = tx_data["fees"]
                if isinstance(fees, list):
                    for fee in fees:
                        if fee.get("type") == "MERCHANT_FEE":
                            fee_cents = fee.get("amount_in_cents", 0)
                        elif fee.get("type") == "MERCHANT_FEE_TAX":
                            fee_tax_cents = fee.get("amount_in_cents", 0)
                elif isinstance(fees, dict):
                    fee_cents = fees.get("merchant_fee_in_cents") or fees.get("fee_in_cents")
                    fee_tax_cents = fees.get("merchant_fee_tax_in_cents") or fees.get("tax_in_cents")

            # Path 2: payment_method.extra
            if fee_cents is None:
                pm = tx_data.get("payment_method", {})
                extra = pm.get("extra", {}) if isinstance(pm, dict) else {}
                if "processor_response_code" in extra:
                    # Some processors include fee here
                    pass

            if fee_cents is not None:
                payment_tx.wompi_fee_cents = fee_cents
                payment_tx.wompi_fee_tax_cents = fee_tax_cents or 0
                logger.info(
                    f"Extracted Wompi fees for {payment_tx.reference}: "
                    f"fee={fee_cents}, tax={fee_tax_cents}"
                )
        except Exception as e:
            logger.warning(f"Could not extract fees for {payment_tx.reference}: {e}")

    async def _apply_approved_payment(self, payment_tx: PaymentTransaction):
        """
        Apply accounting for an approved Wompi payment.

        Replicates the logic in OrderPaymentMixin.add_payment:
        1. Update order.paid_amount or receivable.amount_paid
        2. Create Transaction (INCOME)
        3. Apply to balance via BalanceIntegrationService
        """
        if payment_tx.accounting_applied:
            return

        amount_cop = Decimal(payment_tx.amount_in_cents) / 100

        # Determine AccPaymentMethod from Wompi method
        acc_method = WOMPI_TO_ACC_PAYMENT_METHOD.get(
            payment_tx.payment_method_type or "",
            AccPaymentMethod.TRANSFER,  # Default to bank for electronic payments
        )

        description_prefix = "[Wompi]"

        if payment_tx.order_id:
            # Update order paid amount (cap at total to prevent overpayment)
            result = await self.db.execute(
                select(Order).where(Order.id == payment_tx.order_id)
            )
            order = result.scalar_one_or_none()
            if order:
                new_paid = min(order.paid_amount + amount_cop, order.total)
                order.paid_amount = new_paid
                description = f"{description_prefix} Abono encargo {order.code}"
                reference_code = order.code

                # Update related receivable
                recv_result = await self.db.execute(
                    select(AccountsReceivable).where(
                        AccountsReceivable.order_id == order.id,
                        AccountsReceivable.is_paid == False,
                    )
                )
                recv = recv_result.scalar_one_or_none()
                if recv:
                    recv.amount_paid = recv.amount_paid + amount_cop
                    if recv.amount_paid >= recv.amount:
                        recv.is_paid = True
            else:
                logger.error(f"Order {payment_tx.order_id} not found for payment")
                return

        elif payment_tx.receivable_id:
            result = await self.db.execute(
                select(AccountsReceivable).where(
                    AccountsReceivable.id == payment_tx.receivable_id
                )
            )
            recv = result.scalar_one_or_none()
            if recv:
                recv.amount_paid = recv.amount_paid + amount_cop
                if recv.amount_paid >= recv.amount:
                    recv.is_paid = True
                description = f"{description_prefix} Pago CxC: {recv.description[:50]}"
                reference_code = f"CXC-{str(recv.id)[:8]}"
            else:
                logger.error(f"Receivable {payment_tx.receivable_id} not found")
                return
        else:
            logger.error(f"Payment {payment_tx.reference} has no order or receivable")
            return

        from app.services.accounting.transactions import TransactionService
        txn_service = TransactionService(self.db)
        transaction = await txn_service.record(
            type=TransactionType.INCOME,
            amount=amount_cop,
            payment_method=acc_method,
            description=description,
            school_id=payment_tx.school_id,
            category="orders" if payment_tx.order_id else "receivables",
            reference_code=reference_code,
            transaction_date=get_colombia_date(),
            order_id=payment_tx.order_id,
            created_by=None,
        )

        # Mark as applied (idempotency)
        payment_tx.accounting_applied = True

        # Create expense for Wompi commission if fees were extracted
        await self._record_wompi_fee_expense(payment_tx, reference_code)

        await self.db.flush()

        logger.info(
            f"Applied Wompi payment {payment_tx.reference}: "
            f"${amount_cop} via {acc_method.value}"
        )

        # Notify about web order now that payment is confirmed
        if payment_tx.order_id and order and order.source == SaleSource.WEB_PORTAL:
            await self._notify_web_order_paid(order)

    async def _record_wompi_fee_expense(
        self, payment_tx: PaymentTransaction, reference_code: str
    ):
        """Create an automatic expense for Wompi commission + IVA."""
        fee_cents = payment_tx.wompi_fee_cents or 0
        fee_tax_cents = payment_tx.wompi_fee_tax_cents or 0
        total_fee_cents = fee_cents + fee_tax_cents

        if total_fee_cents <= 0:
            # Try to fetch fees from Wompi API if not in webhook
            await self._fetch_and_store_fees(payment_tx)
            fee_cents = payment_tx.wompi_fee_cents or 0
            fee_tax_cents = payment_tx.wompi_fee_tax_cents or 0
            total_fee_cents = fee_cents + fee_tax_cents

        if total_fee_cents <= 0:
            logger.info(
                f"No Wompi fee info for {payment_tx.reference}, skipping expense"
            )
            return

        fee_cop = Decimal(fee_cents) / 100
        fee_tax_cop = Decimal(fee_tax_cents) / 100
        total_fee_cop = fee_cop + fee_tax_cop

        # Create expense for Wompi commission
        expense = Expense(
            school_id=None,  # Global expense
            category="bank_fees",
            description=(
                f"[Wompi] Comision pago {reference_code} "
                f"(${fee_cop:,.0f} + IVA ${fee_tax_cop:,.0f})"
            ),
            amount=total_fee_cop,
            amount_paid=total_fee_cop,
            is_paid=True,
            expense_date=get_colombia_date(),
            payment_method="transfer",
            vendor="Wompi",
            created_by=None,
        )
        self.db.add(expense)
        await self.db.flush()

        from app.services.accounting.transactions import TransactionService
        txn_service = TransactionService(self.db)
        await txn_service.record(
            type=TransactionType.EXPENSE,
            amount=total_fee_cop,
            payment_method=AccPaymentMethod.TRANSFER,
            description=f"[Wompi] Comisión {reference_code}",
            category="bank_fees",
            reference_code=payment_tx.reference,
            transaction_date=get_colombia_date(),
            expense_id=expense.id,
            created_by=None,
        )

        logger.info(
            f"Recorded Wompi fee expense for {payment_tx.reference}: "
            f"${total_fee_cop} (comisión ${fee_cop} + IVA ${fee_tax_cop})"
        )

    async def _notify_web_order_paid(self, order: Order):
        """Send internal notification + Telegram alert for a web order whose payment was confirmed."""
        try:
            from app.services.notification import NotificationService
            notification_service = NotificationService(self.db)
            await notification_service.notify_new_web_order(order)
        except Exception as e:
            logger.error(f"Internal notification failed for web order {order.code}: {e}")

        try:
            from app.services.telegram import fire_and_forget_routed_alert
            from app.services.telegram_messages import TelegramMessageBuilder
            from app.models.school import School

            school_result = await self.db.execute(
                select(School).where(School.id == order.school_id)
            )
            school_obj = school_result.scalar_one_or_none()
            school_name = school_obj.name if school_obj else "N/A"

            msg = TelegramMessageBuilder.web_order_created(
                code=order.code,
                total=order.total,
                school_name=school_name,
                delivery_type=order.delivery_type.value if order.delivery_type else None,
            )
            fire_and_forget_routed_alert("web_order_created", msg)
        except Exception as e:
            logger.error(f"Telegram alert failed for web order {order.code}: {e}")

    async def _fetch_and_store_fees(self, payment_tx: PaymentTransaction):
        """Query Wompi API to get fee details for an approved transaction."""
        if not payment_tx.wompi_transaction_id or not settings.WOMPI_PRIVATE_KEY:
            return

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{settings.wompi_base_url}/transactions/{payment_tx.wompi_transaction_id}",
                    headers={"Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}"},
                )
                if resp.status_code != 200:
                    return

                data = resp.json().get("data", {})

                # Try to extract fees from detailed response
                fees = data.get("fees", [])
                if isinstance(fees, list):
                    for fee in fees:
                        if fee.get("type") == "MERCHANT_FEE":
                            payment_tx.wompi_fee_cents = fee.get("amount_in_cents", 0)
                        elif fee.get("type") == "MERCHANT_FEE_TAX":
                            payment_tx.wompi_fee_tax_cents = fee.get("amount_in_cents", 0)

                # Also update response data with the detailed version
                if not payment_tx.wompi_response_data:
                    payment_tx.wompi_response_data = data

        except Exception as e:
            logger.warning(f"Could not fetch fees from Wompi for {payment_tx.reference}: {e}")

    # ─── Status Check ───────────────────────────────────────────────

    async def get_payment_status(self, reference: str) -> PaymentTransaction | None:
        """Get payment transaction by reference."""
        result = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.reference == reference
            )
        )
        return result.scalar_one_or_none()

    async def sync_status_from_reference(self, payment_tx: PaymentTransaction) -> bool:
        """Query Wompi by our reference to find the transaction and sync status."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Wompi API: search transactions by reference (requires private key)
                resp = await client.get(
                    f"{settings.wompi_base_url}/transactions",
                    params={"reference": payment_tx.reference},
                    headers={"Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}"},
                )
                if resp.status_code != 200:
                    return False

                data = resp.json().get("data", [])
                if not data:
                    return False

                # Use the most recent transaction for this reference
                tx = data[0] if isinstance(data, list) else data
                if isinstance(tx, dict):
                    wompi_status = tx.get("status")
                else:
                    return False

                status_map = {
                    "APPROVED": WompiTransactionStatus.APPROVED,
                    "DECLINED": WompiTransactionStatus.DECLINED,
                    "VOIDED": WompiTransactionStatus.VOIDED,
                    "ERROR": WompiTransactionStatus.ERROR,
                }
                new_status = status_map.get(wompi_status)
                if not new_status or new_status == payment_tx.status:
                    return False

                payment_tx.status = new_status
                payment_tx.wompi_transaction_id = tx.get("id")
                payment_tx.payment_method_type = tx.get("payment_method_type")
                payment_tx.wompi_response_data = tx
                payment_tx.completed_at = get_colombia_now_naive()

                if new_status == WompiTransactionStatus.APPROVED:
                    await self._apply_approved_payment(payment_tx)

                await self.db.flush()
                logger.info(f"Synced status for {payment_tx.reference}: {wompi_status}")
                return True

        except Exception as e:
            logger.error(f"Failed to sync status for {payment_tx.reference}: {e}")
            return False

    async def resolve_reference_from_wompi(self, wompi_id: str) -> str | None:
        """Query Wompi API to get our payment reference from a Wompi transaction ID."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{settings.wompi_base_url}/transactions/{wompi_id}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("data", {}).get("reference")
        except Exception as e:
            logger.error(f"Failed to resolve Wompi ID {wompi_id}: {e}")
        return None

    async def sync_status_from_wompi(
        self, wompi_id: str, payment_tx: PaymentTransaction
    ) -> bool:
        """Query Wompi for real-time status and update our record if changed."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{settings.wompi_base_url}/transactions/{wompi_id}"
                )
                if resp.status_code != 200:
                    return False

                data = resp.json().get("data", {})
                wompi_status = data.get("status")
                if not wompi_status:
                    return False

                # Map Wompi status to our enum
                status_map = {
                    "APPROVED": WompiTransactionStatus.APPROVED,
                    "DECLINED": WompiTransactionStatus.DECLINED,
                    "VOIDED": WompiTransactionStatus.VOIDED,
                    "ERROR": WompiTransactionStatus.ERROR,
                }
                new_status = status_map.get(wompi_status)
                if not new_status or new_status == payment_tx.status:
                    return False

                # Update our record
                payment_tx.status = new_status
                payment_tx.wompi_transaction_id = wompi_id
                payment_tx.payment_method_type = data.get("payment_method_type")
                payment_tx.status_message = data.get("status_message")
                payment_tx.wompi_response_data = data
                payment_tx.completed_at = get_colombia_now_naive()

                # If approved, apply accounting
                if new_status == WompiTransactionStatus.APPROVED:
                    await self._apply_approved_payment(payment_tx)

                await self.db.flush()
                logger.info(f"Synced Wompi status for {payment_tx.reference}: {wompi_status}")
                return True

        except Exception as e:
            logger.error(f"Failed to sync Wompi status for {wompi_id}: {e}")
            return False

    async def get_payments_for_order(self, order_id: UUID) -> list[PaymentTransaction]:
        """Get all payment transactions for an order."""
        result = await self.db.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.order_id == order_id)
            .order_by(PaymentTransaction.created_at.desc())
        )
        return list(result.scalars().all())
