"""
Order and OrderItem Schemas (Encargos/Yombers)
"""
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from pydantic import Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema
from app.models.order import OrderStatus, OrderItemStatus, DeliveryType
from app.models.sale import SaleSource, ChangeType, ChangeStatus, PaymentMethod


# ============================================
# OrderItem Schemas
# ============================================

class OrderItemBase(BaseSchema):
    """Base order item schema"""
    garment_type_id: UUID | None = None  # Nullable for global products (use global_garment_type_id)
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    subtotal: Decimal = Field(..., ge=0)
    size: str | None = Field(None, max_length=10)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    custom_measurements: dict | None = None
    embroidery_text: str | None = Field(None, max_length=100)
    notes: str | None = None

    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        """Validate gender field"""
        if v and v not in ['unisex', 'male', 'female']:
            raise ValueError('Gender must be: unisex, male, or female')
        return v

    @field_validator('custom_measurements')
    @classmethod
    def validate_measurements(cls, v: dict | None) -> dict | None:
        """Validate custom measurements structure"""
        if v:
            allowed_keys = {
                'delantero', 'trasero', 'espalda', 'cintura', 'largo',
                'cadera', 'pierna', 'entrepierna', 'hombro', 'manga',
                'cuello', 'pecho', 'busto', 'tiro'
            }
            for key in v.keys():
                if key not in allowed_keys:
                    raise ValueError(f'Invalid measurement key: {key}')
            # Validate values are positive numbers
            for key, value in v.items():
                if not isinstance(value, (int, float)) or value <= 0:
                    raise ValueError(f'Measurement {key} must be a positive number')
        return v


class OrderItemCreate(BaseSchema):
    """Schema for creating order item"""
    garment_type_id: UUID | None = None  # Optional for web_custom orders with needs_quotation
    quantity: int = Field(..., gt=0)

    # Order type: "catalog" | "yomber" | "custom" | "web_custom"
    order_type: str = Field(default="custom")

    # For catalog/yomber orders - select specific product for price (school products)
    product_id: UUID | None = None

    # For global products (shared inventory)
    global_product_id: UUID | None = None
    is_global_product: bool = False

    # For custom orders - manual price
    unit_price: Decimal | None = Field(None, ge=0)

    # Additional services price (mainly for yomber)
    additional_price: Decimal | None = Field(None, ge=0)

    # Flag for items that need quotation (web custom orders)
    needs_quotation: bool = Field(default=False)

    # Stock reservation - "pisar" functionality (reserve from inventory if available)
    reserve_stock: bool = Field(default=True, description="Reserve from stock if available for catalog orders")

    # Common fields
    size: str | None = Field(None, max_length=10)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    custom_measurements: dict | None = None
    embroidery_text: str | None = Field(None, max_length=100)
    notes: str | None = None

    @field_validator('order_type')
    @classmethod
    def validate_order_type(cls, v: str) -> str:
        """Validate order type field"""
        valid_types = ['catalog', 'yomber', 'custom', 'web_custom']
        if v not in valid_types:
            raise ValueError(f'Order type must be one of: {", ".join(valid_types)}')
        return v


class OrderItemUpdate(BaseSchema):
    """Schema for updating order item"""
    quantity: int | None = Field(None, gt=0)
    size: str | None = Field(None, max_length=10)
    color: str | None = Field(None, max_length=50)
    gender: str | None = Field(None, max_length=10)
    custom_measurements: dict | None = None
    embroidery_text: str | None = Field(None, max_length=100)
    notes: str | None = None


class OrderItemStatusUpdate(BaseSchema):
    """Schema for updating order item status"""
    item_status: OrderItemStatus


class OrderItemInDB(OrderItemBase, SchoolIsolatedSchema, IDModelSchema):
    """OrderItem as stored in database"""
    order_id: UUID
    product_id: UUID | None = None
    global_product_id: UUID | None = None
    global_garment_type_id: UUID | None = None  # For global products
    is_global_product: bool = False
    item_status: OrderItemStatus = OrderItemStatus.PENDING
    status_updated_at: datetime | None = None
    # Stock reservation tracking
    reserved_from_stock: bool = False
    quantity_reserved: int = 0


class OrderItemResponse(OrderItemInDB):
    """OrderItem for API responses"""
    pass


class OrderItemWithGarment(OrderItemResponse):
    """OrderItem with garment type information"""
    garment_type_name: str
    garment_type_category: str | None
    requires_embroidery: bool
    has_custom_measurements: bool


# ============================================
# Order Schemas
# ============================================

class OrderBase(BaseSchema):
    """Base order schema"""
    client_id: UUID
    delivery_date: date | None = None
    notes: str | None = None
    # Delivery info
    delivery_type: DeliveryType = DeliveryType.PICKUP


class OrderCreate(OrderBase, SchoolIsolatedSchema):
    """Schema for creating order"""
    # Override school_id to be optional (for web custom orders with custom_school_name)
    school_id: UUID | None = None
    items: list[OrderItemCreate] = Field(..., min_length=1)
    advance_payment: Decimal | None = Field(None, ge=0)
    advance_payment_method: str | None = Field(None, max_length=20)  # cash, nequi, transfer, card
    advance_amount_received: Decimal | None = Field(
        None, gt=0,
        description="Physical amount received from customer (only for cash advance payments)"
    )
    source: SaleSource = SaleSource.DESKTOP_APP  # Default to desktop app
    # Payment proof (for web orders)
    payment_proof_url: str | None = Field(None, max_length=500)
    payment_notes: str | None = None
    # Custom school name for non-existent schools (web custom orders)
    custom_school_name: str | None = Field(None, max_length=200)
    # Delivery fields (for delivery type orders)
    delivery_address: str | None = Field(None, max_length=300)
    delivery_neighborhood: str | None = Field(None, max_length=100)
    delivery_city: str | None = Field(None, max_length=100)
    delivery_references: str | None = None
    delivery_zone_id: UUID | None = None
    # code, status, totals will be auto-generated


class OrderUpdate(BaseSchema):
    """Schema for updating order"""
    delivery_date: date | None = None
    status: OrderStatus | None = None
    notes: str | None = None


class OrderPayment(BaseSchema):
    """Schema for recording order payment"""
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., max_length=20)
    payment_reference: str | None = Field(None, max_length=100)
    notes: str | None = None
    amount_received: Decimal | None = Field(
        None, gt=0,
        description="Physical amount received from customer (only for cash)"
    )


class OrderInDB(OrderBase, SchoolIsolatedSchema, IDModelSchema, TimestampSchema):
    """Order as stored in database"""
    code: str
    status: OrderStatus
    source: SaleSource | None = None  # Optional for backwards compatibility with old orders
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    paid_amount: Decimal
    balance: Decimal  # Computed column
    # Cash change tracking
    amount_received: Decimal | None = None
    change_given: Decimal | None = None
    user_id: UUID | None = None  # Who created the order (None for web portal)
    payment_proof_url: str | None = None
    payment_notes: str | None = None
    # Delivery fields
    delivery_type: DeliveryType = DeliveryType.PICKUP
    delivery_address: str | None = None
    delivery_neighborhood: str | None = None
    delivery_city: str | None = None
    delivery_references: str | None = None
    delivery_zone_id: UUID | None = None
    delivery_fee: Decimal = Decimal("0")


class OrderResponse(OrderInDB):
    """Order for API responses"""
    pass


class OrderWithItems(OrderResponse):
    """Order with all items"""
    items: list[OrderItemWithGarment]
    client_name: str
    client_phone: str | None
    client_email: str | None
    student_name: str | None
    school_name: str | None = None


class OrderListResponse(BaseSchema):
    """Simplified order response for listings (multi-school support)"""
    id: UUID
    code: str
    status: OrderStatus
    source: SaleSource | None = None
    client_name: str | None = None
    student_name: str | None = None
    delivery_date: date | None = None
    total: Decimal
    balance: Decimal
    created_at: datetime
    items_count: int = 0
    # Track who created the order
    user_id: UUID | None = None
    user_name: str | None = None
    # Multi-school support
    school_id: UUID | None = None
    school_name: str | None = None
    # Partial delivery tracking
    items_delivered: int = 0
    items_total: int = 0
    # Payment proof
    payment_proof_url: str | None = None
    # Quotation flag (true if any item needs quotation)
    needs_quotation: bool = False
    # Delivery info
    delivery_type: DeliveryType = DeliveryType.PICKUP
    delivery_fee: Decimal = Decimal("0")
    delivery_address: str | None = None
    delivery_neighborhood: str | None = None


# ============================================
# Order Analytics Schemas
# ============================================

class OrdersReport(BaseSchema):
    """Orders summary report"""
    total_orders: int
    total_value: Decimal
    total_paid: Decimal
    total_balance: Decimal
    orders_by_status: dict[str, int]  # {"pending": 10, "in_production": 5, ...}
    overdue_orders: int


class PendingOrder(BaseSchema):
    """Order with pending balance"""
    order_id: UUID
    order_code: str
    client_name: str
    student_name: str | None
    total: Decimal
    paid_amount: Decimal
    balance: Decimal
    delivery_date: date | None
    days_pending: int


class OrdersByClient(BaseSchema):
    """Client orders summary"""
    client_id: UUID
    client_name: str
    total_orders: int
    pending_orders: int
    completed_orders: int
    total_value: Decimal
    pending_balance: Decimal


class ProductionSchedule(BaseSchema):
    """Orders grouped by delivery date"""
    delivery_date: date
    orders_count: int
    total_items: int
    order_codes: list[str]


# ============================================
# Web Portal Schemas
# ============================================

class WebOrderResponse(BaseSchema):
    """Simplified order response for web portal (no user_id required)"""
    id: UUID
    code: str
    status: OrderStatus
    total: Decimal
    created_at: datetime | None = None
    payment_proof_url: str | None = None
    payment_notes: str | None = None
    message: str = "Pedido creado exitosamente"


# ============================================
# Order Stock Verification Schemas
# ============================================

class OrderItemStockInfo(BaseSchema):
    """Stock information for an order item"""
    item_id: UUID
    garment_type_id: UUID
    garment_type_name: str
    size: str | None
    color: str | None
    quantity_requested: int
    # Product match info
    product_id: UUID | None = None
    product_code: str | None = None
    stock_available: int = 0
    can_fulfill_from_stock: bool = False
    # Quantities
    quantity_from_stock: int = 0  # How many can be taken from stock
    quantity_to_produce: int = 0  # How many need to be produced
    # Status suggestion
    suggested_action: str = "produce"  # "fulfill" | "partial" | "produce"


class OrderStockVerification(BaseSchema):
    """Stock verification result for an entire order"""
    order_id: UUID
    order_code: str
    items: list[OrderItemStockInfo]
    # Summary
    total_items: int = 0
    items_in_stock: int = 0  # Items that can be fully fulfilled
    items_partial: int = 0   # Items that can be partially fulfilled
    items_to_produce: int = 0  # Items that need production
    can_fulfill_completely: bool = False
    suggested_action: str = "review"  # "approve_all" | "partial" | "produce_all" | "review"


class OrderItemApprovalAction(BaseSchema):
    """Action for a specific item during approval"""
    item_id: UUID
    action: str = "auto"  # "fulfill" | "produce" | "auto"
    # If fulfilling from stock, specify product
    product_id: UUID | None = None
    quantity_from_stock: int | None = None


class OrderApprovalRequest(BaseSchema):
    """Request to approve/process a web order"""
    # Items actions - if empty, use auto-detection
    items: list[OrderItemApprovalAction] = []
    # Global options
    auto_fulfill_if_stock: bool = True  # Automatically fulfill items with stock
    notify_client: bool = True  # Send notification to client


# ============================================
# Product Demand Schemas (Demanda de Productos)
# ============================================

class OrderReference(BaseSchema):
    """Referencia simplificada a una orden para el modal de demanda"""
    order_id: UUID
    order_code: str
    order_status: OrderStatus
    client_name: str | None
    student_name: str | None
    school_id: UUID | None
    school_name: str | None
    delivery_date: date | None
    quantity: int
    item_id: UUID
    item_status: OrderItemStatus
    has_custom_measurements: bool
    custom_measurements: dict | None = None


class ProductDemandItem(BaseSchema):
    """Demanda de un producto específico (garment_type + size + color + tipo)"""
    garment_type_id: UUID | None
    garment_type_name: str
    garment_type_category: str | None
    size: str | None
    color: str | None

    # Cantidades por estado de item
    total_quantity: int
    pending_quantity: int
    in_production_quantity: int
    ready_quantity: int

    # Conteos
    order_count: int
    item_count: int

    # Tipo (Yomber vs Estándar)
    is_yomber: bool

    # Es producto global (no específico de colegio)
    is_global_product: bool = False

    # Colegios involucrados
    school_ids: list[UUID]
    school_names: list[str]

    # Referencias a órdenes (para el modal de detalle)
    orders: list[OrderReference]

    # Fecha de entrega más próxima
    earliest_delivery_date: date | None


class ProductDemandResponse(BaseSchema):
    """Respuesta completa de demanda de productos"""
    items: list[ProductDemandItem]

    # Totales
    total_items: int
    total_quantity: int
    total_orders: int

    # Resumen por tipo
    yomber_quantity: int
    standard_quantity: int

    # Resumen por estado
    pending_quantity: int
    in_production_quantity: int
    ready_quantity: int

    # Metadata
    generated_at: datetime
    filters_applied: dict


# ============================================
# Order Change Schemas (Cambios/Devoluciones de Encargos)
# ============================================

class OrderChangeCreate(BaseSchema):
    """Schema for creating order change request"""
    original_item_id: UUID
    change_type: ChangeType
    returned_quantity: int = Field(..., gt=0)
    # New product (school or global)
    new_product_id: UUID | None = None
    is_new_global_product: bool = False
    new_quantity: int = Field(0, ge=0)
    reason: str = Field(..., min_length=3, max_length=500)
    # Payment method for price adjustment
    payment_method: PaymentMethod | None = None
    # Order-specific: new item specifications
    new_size: str | None = Field(None, max_length=10)
    new_color: str | None = Field(None, max_length=50)
    new_custom_measurements: dict | None = None
    new_embroidery_text: str | None = Field(None, max_length=100)

    @model_validator(mode='after')
    def validate_change_type_fields(self):
        """Validate fields based on change type"""
        if self.change_type == ChangeType.RETURN:
            if self.new_product_id is not None:
                raise ValueError("Returns should not have a new product")
            if self.new_quantity > 0:
                raise ValueError("Returns should not have new quantity")
        elif self.change_type in [ChangeType.SIZE_CHANGE, ChangeType.PRODUCT_CHANGE, ChangeType.DEFECT]:
            if self.new_product_id is None:
                raise ValueError(f"{self.change_type.value} requires a new product")
            if self.new_quantity <= 0:
                raise ValueError(f"{self.change_type.value} requires new quantity > 0")
        return self


class OrderChangeApprove(BaseSchema):
    """Schema for approving order change with payment method"""
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.CASH,
        description="Payment method for price adjustment (refund or additional payment)"
    )


class OrderChangeReject(BaseSchema):
    """Schema for rejecting an order change"""
    rejection_reason: str = Field(..., min_length=3, max_length=500)


class OrderChangeResponse(BaseSchema):
    """OrderChange for API responses"""
    id: UUID
    order_id: UUID
    original_item_id: UUID
    user_id: UUID
    change_type: ChangeType
    change_date: datetime
    returned_quantity: int
    new_product_id: UUID | None = None
    new_global_product_id: UUID | None = None
    is_new_global_product: bool = False
    new_quantity: int
    new_unit_price: Decimal | None = None
    new_size: str | None = None
    new_color: str | None = None
    new_custom_measurements: dict | None = None
    new_embroidery_text: str | None = None
    price_adjustment: Decimal
    status: ChangeStatus
    reason: str
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderChangeListResponse(BaseSchema):
    """Simplified order change response for listings"""
    id: UUID
    order_id: UUID
    order_code: str
    school_id: UUID | None = None
    school_name: str | None = None
    change_type: ChangeType
    status: ChangeStatus
    returned_quantity: int
    new_quantity: int
    price_adjustment: Decimal
    change_date: datetime
    reason: str

    class Config:
        from_attributes = True
