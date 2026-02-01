"""
Payment Account Model

Stores bank account information and QR codes for payment methods.
Admin can configure these through the desktop app, and they will be
displayed to customers in the web portal when making payments.

Examples:
- Nequi number + QR code
- Bank account numbers (Bancolombia, Davivienda, etc.)
- Transfer instructions
"""
from sqlalchemy import Column, String, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from sqlalchemy import DateTime
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class PaymentMethodType(str, enum.Enum):
    """Types of payment methods"""
    NEQUI = "nequi"              # Nequi digital wallet
    BANK_ACCOUNT = "bank_account"  # Traditional bank account
    DAVIPLATA = "daviplata"      # Daviplata digital wallet
    OTHER = "other"              # Other payment methods


class PaymentAccount(Base):
    """
    Payment account configuration.

    Attributes:
        id: Unique identifier
        method_type: Type of payment method (nequi, bank_account, etc.)
        account_name: Display name (e.g., "Nequi Consuelo Ríos")
        account_number: Account/phone number
        account_holder: Name of account holder
        bank_name: Bank name (optional, for bank accounts)
        account_type: Account type (Ahorros, Corriente) for bank accounts
        qr_code_url: URL to QR code image (optional)
        instructions: Additional payment instructions (optional)
        display_order: Order to display in web portal (lower = first)
        is_active: Whether this payment method is currently active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "payment_accounts"

    # IDs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Payment method info
    method_type = Column(
        String(50),
        nullable=False,
        default=PaymentMethodType.NEQUI.value
    )
    account_name = Column(String(200), nullable=False)
    account_number = Column(String(100), nullable=False)
    account_holder = Column(String(200), nullable=False)

    # Bank-specific fields (optional)
    bank_name = Column(String(100), nullable=True)
    account_type = Column(String(50), nullable=True)  # "Ahorros" or "Corriente"

    # QR code and instructions
    qr_code_url = Column(String(500), nullable=True)
    instructions = Column(Text, nullable=True)

    # Display settings
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=get_colombia_now_naive)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive
    )

    def __repr__(self):
        return f"<PaymentAccount {self.account_name} - {self.method_type}>"
