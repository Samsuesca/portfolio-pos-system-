"""
Sale and SaleItem Schemas
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema
from app.models.sale import SaleStatus, PaymentMethod, ChangeStatus, ChangeType, SaleSource


# ============================================
# SalePayment Schemas
# ============================================

class SalePaymentCreate(BaseSchema):
    """Schema for creating a payment line"""
    amount: Decimal = Field(..., gt=0)
    payment_method: PaymentMethod
    notes: str | None = None
    # Cash change tracking (only for cash payments)
    amount_received: Decimal | None = Field(
        None,
        gt=0,
        description="Physical amount received from customer (only for cash)"
    )


class AddPaymentToSale(BaseSchema):
    """Schema for adding a payment to an existing sale"""
    amount: Decimal = Field(..., gt=0)
    payment_method: PaymentMethod
    notes: str | None = None
    apply_accounting: bool = Field(
        default=True,
        description="Si True, crea transaccion contable y actualiza balances"
    )
    # Cash change tracking (only for cash payments)
    amount_received: Decimal | None = Field(
        None,
        gt=0,
        description="Physical amount received from customer (only for cash)"
    )


class SalePaymentResponse(BaseSchema):
    """SalePayment for API responses"""
    id: UUID
    sale_id: UUID
    amount: Decimal
    payment_method: PaymentMethod
    notes: str | None = None
    transaction_id: UUID | None = None
    # Cash change tracking
    amount_received: Decimal | None = None
    change_given: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# SaleItem Schemas
# ============================================

class SaleItemBase(BaseSchema):
    """Base sale item schema"""
    product_id: UUID | None = None
    global_product_id: UUID | None = None
    is_global_product: bool = False
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    subtotal: Decimal = Field(..., ge=0)


class SaleItemCreate(BaseSchema):
    """Schema for creating sale item (simplified input)"""
    product_id: UUID
    quantity: int = Field(..., gt=0)
    is_global: bool = False  # True if product is from global inventory
    # unit_price and subtotal will be calculated from product


class SaleItemInDB(SaleItemBase, IDModelSchema):
    """SaleItem as stored in database"""
    sale_id: UUID


class SaleItemResponse(SaleItemInDB):
    """SaleItem for API responses"""

    model_config = {"from_attributes": True}


class SaleItemWithProduct(SaleItemResponse):
    """SaleItem with product information"""
    product_code: str | None = None
    product_name: str | None = None
    product_size: str | None = None
    product_color: str | None = None
    # Global product info (if applicable)
    global_product_code: str | None = None
    global_product_name: str | None = None
    global_product_size: str | None = None
    global_product_color: str | None = None


# ============================================
# Sale Schemas
# ============================================

class SaleBase(BaseSchema):
    """Base sale schema"""
    client_id: UUID | None = None
    payment_method: PaymentMethod | None = None
    notes: str | None = None


class SaleCreate(SaleBase):
    """Schema for creating sale"""
    # school_id is optional here because it's injected from URL path
    school_id: UUID | None = None
    items: list[SaleItemCreate] = Field(..., min_length=1)
    source: SaleSource = SaleSource.DESKTOP_APP  # Default to desktop app
    # Historical sales (migration) - don't affect inventory
    is_historical: bool = False
    sale_date: datetime | None = None  # Optional: set custom date for historical sales
    # Multiple payments support (replaces single payment_method)
    payments: list[SalePaymentCreate] | None = None
    # code, status, totals will be auto-generated

    @model_validator(mode='after')
    def validate_payment_fields(self):
        """Ensure payment method is provided for non-historical sales"""
        if self.payments and self.payment_method:
            raise ValueError("Use either 'payment_method' (single) or 'payments' (multiple), not both")
        # Require payment method for non-historical sales
        if not self.is_historical and not self.payments and not self.payment_method:
            raise ValueError("Se requiere 'payment_method' o 'payments' para ventas no historicas")
        return self


class SaleUpdate(BaseSchema):
    """Schema for updating sale (limited fields)"""
    client_id: UUID | None = None
    status: SaleStatus | None = None
    payment_method: PaymentMethod | None = None
    notes: str | None = None


class SaleInDB(SaleBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """Sale as stored in database"""
    code: str
    user_id: UUID
    status: SaleStatus
    source: SaleSource
    is_historical: bool = False
    total: Decimal
    paid_amount: Decimal
    sale_date: datetime


class SaleResponse(SaleInDB):
    """Sale for API responses"""
    items: list[SaleItemResponse] = []
    payments: list[SalePaymentResponse] = []

    model_config = {"from_attributes": True}


class SaleWithItems(SaleResponse):
    """Sale with all items and product details"""
    items: list[SaleItemWithProduct]
    payments: list[SalePaymentResponse] = []
    client_name: str | None = None
    user_name: str | None = None
    school_name: str | None = None


class SaleListResponse(BaseSchema):
    """Simplified sale response for listings (multi-school support)"""
    id: UUID
    code: str
    status: SaleStatus
    source: SaleSource | None = None
    is_historical: bool = False
    payment_method: PaymentMethod | None = None
    total: Decimal
    paid_amount: Decimal
    client_id: UUID | None = None
    client_name: str | None = None
    sale_date: datetime
    created_at: datetime
    items_count: int = 0
    # Track who made the sale
    user_id: UUID | None = None
    user_name: str | None = None
    # Multi-school support
    school_id: UUID | None = None
    school_name: str | None = None


# ============================================
# Sale Analytics Schemas
# ============================================

class SalesReport(BaseSchema):
    """Sales summary report"""
    total_sales: int
    total_revenue: Decimal
    total_tax: Decimal
    average_ticket: Decimal
    sales_by_status: dict[str, int]  # {"completed": 45, "pending": 3, "cancelled": 2}
    sales_by_payment_method: dict[str, int]  # {"cash": 30, "transfer": 15, "credit": 5}


class TopProduct(BaseSchema):
    """Product sales performance"""
    product_id: UUID
    product_code: str
    product_name: str | None
    units_sold: int
    total_revenue: Decimal


class SalesByPeriod(BaseSchema):
    """Sales grouped by time period"""
    period: str  # "2024-01", "2024-W05", "2024-01-15"
    sales_count: int
    total_revenue: Decimal


class DailySalesSummary(BaseSchema):
    """Daily sales summary"""
    date: str  # "2024-01-15"
    total_sales: int
    total_revenue: Decimal
    cash_sales: Decimal
    transfer_sales: Decimal
    credit_sales: Decimal
    completed_count: int
    pending_count: int
    cancelled_count: int


# ============================================
# SaleChange Schemas
# ============================================

class SaleChangeBase(BaseSchema):
    """Base sale change schema"""
    change_type: ChangeType
    returned_quantity: int = Field(..., gt=0)
    # For school products
    new_product_id: UUID | None = None
    # For global products (shared inventory)
    is_new_global_product: bool = False
    new_quantity: int = Field(0, ge=0)
    reason: str = Field(..., min_length=3, max_length=500)


class SaleChangeCreate(SaleChangeBase):
    """Schema for creating sale change request"""
    original_item_id: UUID
    # When stock is not available, create an order for the new product
    create_order_if_no_stock: bool = False
    # Payment method for price adjustment (when creating order with no stock)
    payment_method: PaymentMethod | None = None

    @model_validator(mode='after')
    def validate_change_type_fields(self):
        """Validate fields based on change type after all fields are set"""
        change_type = self.change_type
        new_product_id = self.new_product_id
        new_quantity = self.new_quantity

        # For returns, no new product needed
        if change_type == ChangeType.RETURN:
            if new_product_id is not None:
                raise ValueError("Returns should not have a new product")
            if new_quantity > 0:
                raise ValueError("Returns should not have new quantity")

        # For changes, new product is required
        elif change_type in [ChangeType.SIZE_CHANGE, ChangeType.PRODUCT_CHANGE, ChangeType.DEFECT]:
            if new_product_id is None:
                raise ValueError(f"{change_type.value} requires a new product")
            if new_quantity <= 0:
                raise ValueError(f"{change_type.value} requires new quantity > 0")

        return self


class SaleChangeUpdate(BaseSchema):
    """Schema for updating sale change (approve/reject)"""
    status: ChangeStatus
    rejection_reason: str | None = Field(None, max_length=500)

    @field_validator('rejection_reason')
    def validate_rejection_reason(cls, v, info):
        """Rejection reason required when rejecting"""
        status = info.data.get('status')
        if status == ChangeStatus.REJECTED and not v:
            raise ValueError("Rejection reason is required when rejecting a change")
        return v


class SaleChangeReject(BaseSchema):
    """Schema for rejecting a sale change - dedicated endpoint"""
    rejection_reason: str = Field(..., min_length=3, max_length=500)


class SaleChangeApprove(BaseSchema):
    """Schema for approving sale change with payment method for price adjustments"""
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.CASH,
        description="Payment method for price adjustment (refund or additional payment)"
    )


class SaleChangeInDB(SaleChangeBase, IDModelSchema, TimestampSchema):
    """SaleChange as stored in database"""
    sale_id: UUID
    original_item_id: UUID
    user_id: UUID
    change_date: datetime
    new_unit_price: Decimal | None
    new_global_product_id: UUID | None = None
    price_adjustment: Decimal
    status: ChangeStatus
    rejection_reason: str | None
    order_id: UUID | None = None


class SaleChangeResponse(SaleChangeInDB):
    """SaleChange for API responses"""
    # Include order code for display
    order_code: str | None = None


class SaleChangeWithDetails(SaleChangeResponse):
    """SaleChange with detailed product information"""
    # Original item details (can be school or global product)
    original_product_code: str
    original_product_name: str | None
    original_product_size: str
    original_unit_price: Decimal
    original_is_global: bool = False

    # New product details (if applicable, can be school or global)
    new_product_code: str | None
    new_product_name: str | None
    new_product_size: str | None

    # User who processed the change
    user_username: str


class SaleChangeListResponse(BaseSchema):
    """Sale change response with full product details for listings"""
    id: UUID
    sale_id: UUID
    sale_code: str
    change_type: ChangeType
    status: ChangeStatus
    returned_quantity: int
    new_quantity: int
    price_adjustment: Decimal
    change_date: datetime
    reason: str
    rejection_reason: str | None = None
    created_at: datetime | None = None

    # Producto original
    original_product_code: str | None = None
    original_product_name: str | None = None
    original_product_size: str | None = None
    original_product_color: str | None = None
    original_unit_price: Decimal | None = None
    original_is_global: bool = False

    # Producto nuevo (si aplica)
    new_product_code: str | None = None
    new_product_name: str | None = None
    new_product_size: str | None = None
    new_product_color: str | None = None
    new_unit_price: Decimal | None = None
    new_is_global: bool = False

    # Usuario y pedido
    user_username: str | None = None
    order_code: str | None = None
    order_id: UUID | None = None


# ============================================
# SaleChange Detail Schemas (para modal de detalle)
# ============================================

class TransactionSummary(BaseSchema):
    """Resumen de transaccion contable relacionada al cambio"""
    id: UUID
    type: str
    amount: Decimal
    description: str | None = None
    transaction_date: datetime


class InventoryMovementSummary(BaseSchema):
    """Resumen de movimiento de inventario relacionado al cambio"""
    id: UUID
    product_code: str
    product_name: str | None = None
    movement_type: str  # "entrada" o "salida"
    quantity: int
    created_at: datetime


class OrderSummary(BaseSchema):
    """Resumen de pedido asociado al cambio"""
    id: UUID
    code: str
    status: str
    delivery_date: datetime | None = None


class SaleChangeDetailResponse(SaleChangeListResponse):
    """Detalle completo de un cambio para el modal"""
    # Datos de la venta original
    sale_total: Decimal
    sale_date: datetime
    client_name: str | None = None
    school_name: str | None = None

    # Transacciones contables relacionadas
    transactions: list[TransactionSummary] = []

    # Movimientos de inventario
    inventory_movements: list[InventoryMovementSummary] = []

    # Pedido asociado (si pending_stock)
    associated_order: OrderSummary | None = None


# ============================================
# Sale Cancellation Schemas
# ============================================

class SaleCancelRequest(BaseSchema):
    """Schema for cancelling a sale with full rollback"""
    reason: str = Field(..., min_length=5, max_length=500)
    refund_method: PaymentMethod | None = Field(
        default=None,
        description="Payment method for refund. If not provided, uses original payment method"
    )


class SaleCancelResponse(BaseSchema):
    """Response after cancelling a sale"""
    id: UUID
    code: str
    status: SaleStatus
    cancelled_at: datetime
    inventory_restored: bool
    transactions_reversed: bool
    receivables_cancelled: bool
    message: str
