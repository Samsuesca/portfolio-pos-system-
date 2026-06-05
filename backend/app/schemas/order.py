"""
Order and OrderItem Schemas (Encargos/Yombers)
"""
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from pydantic import ConfigDict, Field, field_validator, model_validator
from app.schemas.base import BaseSchema, IDModelSchema, TimestampSchema, SchoolIsolatedSchema
from app.models.order import OrderStatus, OrderItemStatus, DeliveryType, OriginalItemDisposal
from app.models.sale import SaleSource, ChangeType, ChangeStatus, PaymentMethod


# ============================================
# OrderItem Schemas
# ============================================

class OrderItemBase(BaseSchema):
    """Base order item schema"""
    garment_type_id: UUID | None = None
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    unit_cost: Decimal | None = None
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
    garment_type_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440000")
    quantity: int = Field(..., gt=0, example=2)

    # Order type: "catalog" | "yomber" | "custom" | "web_custom"
    order_type: str = Field(default="custom", example="catalog")

    product_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440001")

    unit_price: Decimal | None = Field(None, ge=0, example=45000.00)

    # Additional services price (mainly for yomber)
    additional_price: Decimal | None = Field(None, ge=0, example=8000.00)

    # Flag for items that need quotation (web custom orders)
    needs_quotation: bool = Field(default=False)

    # Stock reservation - "pisar" functionality (reserve from inventory if available)
    reserve_stock: bool = Field(default=True, description="Reserve from stock if available for catalog orders")

    # Common fields
    size: str | None = Field(None, max_length=10, example="M")
    color: str | None = Field(None, max_length=50, example="Azul")
    gender: str | None = Field(None, max_length=10, example="female")
    custom_measurements: dict | None = Field(None, example={"cintura": 70, "largo": 85, "cadera": 95})
    embroidery_text: str | None = Field(None, max_length=100, example="Colegio San José")
    notes: str | None = Field(None, example="Bordado en lado izquierdo del pecho")

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
    quantity: int | None = Field(None, gt=0, example=3)
    size: str | None = Field(None, max_length=10, example="L")
    color: str | None = Field(None, max_length=50, example="Blanco")
    gender: str | None = Field(None, max_length=10, example="male")
    custom_measurements: dict | None = Field(None, example={"cintura": 75, "largo": 90})
    embroidery_text: str | None = Field(None, max_length=100, example="Instituto Pedagógico")
    notes: str | None = Field(None, example="Ajustar largo según medidas actualizadas")


class OrderItemStatusUpdate(BaseSchema):
    """Schema for updating order item status"""
    item_status: OrderItemStatus = Field(..., example="in_production")


class OrderItemInDB(OrderItemBase, SchoolIsolatedSchema, IDModelSchema):
    """OrderItem as stored in database"""
    order_id: UUID
    product_id: UUID | None = None
    item_status: OrderItemStatus = OrderItemStatus.PENDING
    status_updated_at: datetime | None = None
    # Stock reservation tracking
    reserved_from_stock: bool = False
    quantity_reserved: int = 0


class OrderItemResponse(OrderItemInDB):
    """OrderItem for API responses"""
    is_global: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "aa0e8400-e29b-41d4-a716-446655440010",
                "order_id": "bb0e8400-e29b-41d4-a716-446655440020",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "garment_type_id": "cc0e8400-e29b-41d4-a716-446655440030",
                "product_id": None,
                "quantity": 2,
                "unit_price": 55000.00,
                "unit_cost": 28000.00,
                "subtotal": 110000.00,
                "size": "12",
                "color": "azul",
                "gender": "female",
                "custom_measurements": None,
                "embroidery_text": "Valentina G.",
                "notes": None,
                "item_status": "pending",
                "status_updated_at": None,
                "reserved_from_stock": False,
                "quantity_reserved": 0,
                "is_global": False,
            }
        },
    )


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
    client_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    delivery_date: date | None = Field(None, example="2026-05-15")
    notes: str | None = Field(None, example="Encargo urgente para evento escolar")
    # Delivery info
    delivery_type: DeliveryType = Field(default=DeliveryType.PICKUP, example="pickup")


class OrderCreate(OrderBase, SchoolIsolatedSchema):
    """Schema for creating order"""
    # Override school_id to be optional (for web custom orders with custom_school_name)
    school_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440000")
    items: list[OrderItemCreate] = Field(..., min_length=1)
    advance_payment: Decimal | None = Field(None, ge=0, example=50000.00)
    advance_payment_method: str | None = Field(None, max_length=20, example="cash")
    advance_amount_received: Decimal | None = Field(
        None, gt=0,
        description="Physical amount received from customer (only for cash advance payments)",
        example=50000.00
    )
    source: SaleSource = Field(default=SaleSource.DESKTOP_APP, example="desktop_app")
    # Custom school name for non-existent schools (web custom orders)
    custom_school_name: str | None = Field(None, max_length=200, example="Colegio Nuevo Horizonte")
    # Delivery fields (for delivery type orders)
    delivery_address: str | None = Field(None, max_length=300, example="Cra 80 #45-12, Medellín")
    delivery_neighborhood: str | None = Field(None, max_length=100, example="Laureles")
    delivery_city: str | None = Field(None, max_length=100, example="Medellín")
    delivery_references: str | None = Field(None, example="Edificio azul, portería principal")
    delivery_zone_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440000")
    # code, status, totals will be auto-generated


class OrderUpdate(BaseSchema):
    """Schema for updating order metadata.

    Only delivery_date and notes are editable through this endpoint.
    Status transitions use dedicated endpoints:
    - PATCH /{order_id}/status for order status changes
    - POST /{order_id}/cancel for cancellation
    """
    delivery_date: date | None = Field(None, example="2026-05-20")
    notes: str | None = Field(None, example="Cliente confirmó medidas finales")


class OrderPayment(BaseSchema):
    """Schema for recording order payment"""
    amount: Decimal = Field(..., gt=0, example=75000.00)
    payment_method: str = Field(..., max_length=20, example="nequi")
    payment_reference: str | None = Field(None, max_length=100, example="REF-20260412-001")
    notes: str | None = Field(None, example="Segundo abono del encargo")
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

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "bb0e8400-e29b-41d4-a716-446655440020",
                "code": "CARACAS-001-ENC-2026-0034",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "client_id": "550e8400-e29b-41d4-a716-446655440000",
                "user_id": "ee0e8400-e29b-41d4-a716-446655440050",
                "status": "pending",
                "source": "desktop_app",
                "delivery_date": "2026-04-30",
                "delivery_type": "pickup",
                "delivery_address": None,
                "delivery_neighborhood": None,
                "delivery_city": None,
                "delivery_references": None,
                "delivery_zone_id": None,
                "delivery_fee": 0,
                "subtotal": 165000.00,
                "tax": 0,
                "total": 165000.00,
                "paid_amount": 80000.00,
                "balance": 85000.00,
                "amount_received": None,
                "change_given": None,
                "notes": "Bordado especial con nombre completo",
                "created_at": "2026-04-12T10:30:00",
                "updated_at": "2026-04-12T10:30:00",
            }
        },
    )


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
    # Quotation flag (true if any item needs quotation)
    needs_quotation: bool = False
    # Delivery info
    delivery_type: DeliveryType = DeliveryType.PICKUP
    delivery_fee: Decimal = Decimal("0")
    delivery_address: str | None = None
    delivery_neighborhood: str | None = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "bb0e8400-e29b-41d4-a716-446655440020",
                "code": "CARACAS-001-ENC-2026-0034",
                "status": "pending",
                "source": "desktop_app",
                "client_name": "María García López",
                "student_name": "Valentina García",
                "delivery_date": "2026-04-30",
                "total": 165000.00,
                "balance": 85000.00,
                "created_at": "2026-04-12T10:30:00",
                "items_count": 3,
                "user_id": "ee0e8400-e29b-41d4-a716-446655440050",
                "user_name": "Carlos Vendedor",
                "school_id": "770e8400-e29b-41d4-a716-446655440002",
                "school_name": "Colegio San José",
                "items_delivered": 1,
                "items_total": 3,
                "needs_quotation": False,
                "delivery_type": "pickup",
                "delivery_fee": 0,
                "delivery_address": None,
                "delivery_neighborhood": None,
            }
        },
    )


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

    is_global: bool = False

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
    original_item_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    change_type: ChangeType = Field(..., example="size_change")
    returned_quantity: int = Field(..., gt=0, example=1)
    new_product_id: UUID | None = Field(None, example="550e8400-e29b-41d4-a716-446655440001")
    new_quantity: int = Field(0, ge=0, example=1)
    reason: str = Field(..., min_length=3, max_length=500, example="Talla incorrecta, cliente solicita cambio a L")
    # Payment method for price adjustment
    payment_method: PaymentMethod | None = Field(None, example="cash")
    # Order-specific: new item specifications
    new_size: str | None = Field(None, max_length=10, example="L")
    new_color: str | None = Field(None, max_length=50, example="Azul")
    new_custom_measurements: dict | None = Field(None, example={"cintura": 75, "largo": 90})
    new_embroidery_text: str | None = Field(None, max_length=100, example="Colegio San José")
    # Required when original item was NOT reserved from stock (production / made-to-order)
    original_item_disposal: OriginalItemDisposal | None = Field(
        None,
        description=(
            "Destino físico del item original. Obligatorio cuando el item NO vino "
            "de stock (estaba en producción o terminado made-to-order). "
            "cancel_production = item en producción se cancela; "
            "return_to_inventory = prenda terminada no personalizada vuelve al inventario; "
            "register_loss = prenda terminada personalizada se registra como pérdida."
        ),
        example="cancel_production",
    )

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
        description="Payment method for price adjustment (refund or additional payment)",
        example="cash"
    )


class OrderChangeReject(BaseSchema):
    """Schema for rejecting an order change"""
    rejection_reason: str = Field(..., min_length=3, max_length=500, example="Producto ya fue confeccionado, no aplica cambio")


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
    original_item_disposal: OriginalItemDisposal | None = None
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
