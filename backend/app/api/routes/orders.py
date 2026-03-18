"""
Orders (Encargos) Endpoints

Two types of endpoints:
1. Multi-school: /orders - Lists data from ALL schools user has access to
2. School-specific: /schools/{school_id}/orders - Original endpoints for specific school
"""
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, status, Query, Depends, UploadFile, File
from sqlalchemy import select, or_

from app.utils.timezone import get_colombia_now_naive
from sqlalchemy.orm import selectinload, joinedload
import os
import shutil
from pathlib import Path

from app.api.dependencies import DatabaseSession, CurrentUser, require_school_access, UserSchoolIds
from app.models.user import UserRole
from app.models.order import Order, OrderItem, OrderStatus, OrderItemStatus
from app.models.client import Client
from app.models.school import School
from app.schemas.order import (
    OrderCreate, OrderUpdate, OrderPayment, OrderResponse, OrderListResponse,
    OrderWithItems, OrderItemResponse, WebOrderResponse, OrderItemStatusUpdate,
    OrderItemWithGarment, OrderApprovalRequest, ProductDemandResponse,
    OrderChangeCreate, OrderChangeResponse, OrderChangeListResponse,
    OrderChangeApprove, OrderChangeReject
)
from app.services.order import OrderService
from app.services.receipt import ReceiptService
from app.services.email import send_order_confirmation_email
from app.models.sale import Sale, SaleSource, ChangeStatus, ChangeType
from app.models.order import OrderChange
from fastapi.responses import HTMLResponse


# =============================================================================
# Multi-School Orders Router (lists from ALL user's schools)
# =============================================================================
router = APIRouter(tags=["Orders"])


@router.get(
    "/orders",
    response_model=list[OrderListResponse],
    summary="List orders from all schools"
)
async def list_all_orders(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    school_id: UUID | None = Query(None, description="Filter by specific school"),
    status_filter: OrderStatus | None = Query(None, alias="status", description="Filter by status"),
    search: str | None = Query(None, description="Search by code or client name"),
    source_filter: str | None = Query(None, description="Source filter: 'exclude_web_portal' to exclude web orders"),
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    start_date: date | None = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="Filter until date (YYYY-MM-DD)")
):
    """
    List orders (encargos) from ALL schools the user has access to.

    Supports filtering by:
    - school_id: Specific school (optional)
    - status: Order status (pending, in_production, ready, delivered, cancelled)
    - search: Search in order code or client name
    - source_filter: Use 'exclude_web_portal' to exclude orders from web portal
    """
    if not user_school_ids:
        return []

    # Build query - include custom schools (with "+" prefix) even if user doesn't have explicit access
    # This allows admins to see orders for new schools created via web portal

    # First, get custom school IDs (schools with "+" prefix)
    custom_schools_result = await db.execute(
        select(School.id).where(School.name.like('+%'))
    )
    custom_school_ids = [row[0] for row in custom_schools_result.fetchall()]

    # Combine user's schools with custom schools
    all_accessible_school_ids = list(set(list(user_school_ids) + custom_school_ids))

    query = (
        select(Order)
        .options(
            selectinload(Order.items),
            joinedload(Order.client),
            joinedload(Order.school)
        )
        .where(Order.school_id.in_(all_accessible_school_ids))
        .order_by(Order.created_at.desc())
    )

    # Apply filters
    if school_id:
        # Check if user has access to this school (either explicitly or via custom school)
        if school_id not in all_accessible_school_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        query = query.where(Order.school_id == school_id)

    if status_filter:
        query = query.where(Order.status == status_filter)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Order.code.ilike(search_term),
                Order.client.has(Client.name.ilike(search_term))
            )
        )

    # Filter by client
    if client_id:
        query = query.where(Order.client_id == client_id)

    # Filter by source (exclude web portal orders if requested)
    if source_filter == "exclude_web_portal":
        query = query.where(Order.source != SaleSource.WEB_PORTAL)

    # Date range filter
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.where(Order.order_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.where(Order.order_date <= end_datetime)

    # Pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    orders = result.unique().scalars().all()

    return [
        OrderListResponse(
            id=order.id,
            code=order.code,
            status=order.status,
            source=order.source,  # Include source for filtering web_portal orders
            client_name=order.client.name if order.client else None,
            student_name=order.client.student_name if order.client else None,
            delivery_date=order.delivery_date,
            total=order.total,
            balance=order.balance,
            created_at=order.created_at,
            items_count=len(order.items) if order.items else 0,
            school_id=order.school_id,
            school_name=order.school.name if order.school else None,
            # Partial delivery tracking
            items_delivered=sum(1 for item in order.items if item.item_status == OrderItemStatus.DELIVERED) if order.items else 0,
            items_total=len(order.items) if order.items else 0,
            # Payment proof
            payment_proof_url=order.payment_proof_url,
            # Delivery info
            delivery_type=order.delivery_type,
            delivery_fee=order.delivery_fee,
            delivery_address=order.delivery_address,
            delivery_neighborhood=order.delivery_neighborhood
        )
        for order in orders
    ]


@router.get(
    "/orders/demand",
    response_model=ProductDemandResponse,
    summary="Get aggregated product demand from active orders"
)
async def get_product_demand(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    school_id: UUID | None = Query(None, description="Filter by specific school"),
    include_ready: bool = Query(False, description="Include ready items in results"),
    type_filter: str | None = Query(None, description="Filter: 'yomber', 'standard', or 'all'"),
    sort_by: str = Query("quantity", description="Sort by: 'quantity', 'delivery_date', 'order_count'"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'"),
):
    """
    Get aggregated product demand from pending and in_production orders.

    Returns products grouped by (garment_type, size, color, is_yomber) with:
    - Quantity breakdown by item status (pending, in_production, ready)
    - References to all orders containing this product
    - School information for multi-school users
    - Earliest delivery date

    This endpoint uses a single optimized query instead of N+1 queries.
    """
    if not user_school_ids:
        return ProductDemandResponse(
            items=[],
            total_items=0,
            total_quantity=0,
            total_orders=0,
            yomber_quantity=0,
            standard_quantity=0,
            pending_quantity=0,
            in_production_quantity=0,
            ready_quantity=0,
            generated_at=get_colombia_now_naive(),
            filters_applied={}
        )

    order_service = OrderService(db)

    # Validate school_id access
    target_school_ids = list(user_school_ids)
    if school_id:
        if school_id not in user_school_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        target_school_ids = [school_id]

    result = await order_service.get_product_demand(
        school_ids=target_school_ids,
        include_ready=include_ready,
        type_filter=type_filter,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return ProductDemandResponse(
        items=result['items'],
        total_items=result['total_items'],
        total_quantity=result['total_quantity'],
        total_orders=result['total_orders'],
        yomber_quantity=result['yomber_quantity'],
        standard_quantity=result['standard_quantity'],
        pending_quantity=result['pending_quantity'],
        in_production_quantity=result['in_production_quantity'],
        ready_quantity=result['ready_quantity'],
        generated_at=get_colombia_now_naive(),
        filters_applied={
            'school_id': str(school_id) if school_id else None,
            'include_ready': include_ready,
            'type_filter': type_filter,
            'sort_by': sort_by,
            'sort_order': sort_order,
        }
    )


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
    summary="Get order by ID (from any accessible school)"
)
async def get_order_global(
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """Get a specific order by ID from any school the user has access to."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.id == order_id,
            Order.school_id.in_(user_school_ids)
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encargo no encontrado"
        )

    return OrderResponse.model_validate(order)


@router.get(
    "/orders/{order_id}/details",
    response_model=OrderWithItems,
    summary="Get order with full details (from any accessible school)"
)
async def get_order_details_global(
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Get a specific order with all items and details from any school the user has access to.
    Does not require school_id in URL - validates access based on the order's school.
    """
    # First, get custom school IDs (schools with "+" prefix) for web portal orders
    custom_schools_result = await db.execute(
        select(School.id).where(School.name.like('+%'))
    )
    custom_school_ids = [row[0] for row in custom_schools_result.fetchall()]
    all_accessible_school_ids = list(set(list(user_school_ids) + custom_school_ids))

    # Get order with all relations
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.garment_type),
            joinedload(Order.client)
        )
        .where(
            Order.id == order_id,
            Order.school_id.in_(all_accessible_school_ids)
        )
    )
    order = result.unique().scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encargo no encontrado o sin acceso"
        )

    # Get school name
    school_name = None
    if order.school_id:
        school_result = await db.execute(
            select(School).where(School.id == order.school_id)
        )
        school = school_result.scalar_one_or_none()
        school_name = school.name if school else None

    # Build response with client and items info
    items_response = []
    for item in order.items:
        item_dict = {
            "id": item.id,
            "order_id": item.order_id,
            "school_id": item.school_id,
            "garment_type_id": item.garment_type_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal,
            "size": item.size,
            "color": item.color,
            "gender": item.gender,
            "custom_measurements": item.custom_measurements,
            "embroidery_text": item.embroidery_text,
            "notes": item.notes,
            "item_status": item.item_status,
            "status_updated_at": item.status_updated_at,
            "garment_type_name": item.garment_type.name if item.garment_type else "Unknown",
            "garment_type_category": item.garment_type.category if item.garment_type else None,
            "requires_embroidery": item.garment_type.requires_embroidery if item.garment_type else False,
            "has_custom_measurements": bool(item.custom_measurements)
        }
        items_response.append(item_dict)

    return OrderWithItems(
        id=order.id,
        school_id=order.school_id,
        code=order.code,
        client_id=order.client_id,
        status=order.status,
        delivery_date=order.delivery_date,
        notes=order.notes,
        subtotal=order.subtotal,
        tax=order.tax,
        total=order.total,
        paid_amount=order.paid_amount,
        balance=order.balance,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=items_response,
        client_name=order.client.name if order.client else "Unknown",
        client_phone=order.client.phone if order.client else None,
        client_email=order.client.email if order.client else None,
        student_name=order.client.student_name if order.client else None,
        delivery_type=order.delivery_type,
        delivery_address=order.delivery_address,
        delivery_neighborhood=order.delivery_neighborhood,
        delivery_city=order.delivery_city,
        delivery_references=order.delivery_references,
        delivery_zone_id=order.delivery_zone_id,
        delivery_fee=order.delivery_fee,
        school_name=school_name
    )


# =============================================================================
# Multi-School Order Changes Endpoint
# =============================================================================

@router.get(
    "/order-changes",
    response_model=list[OrderChangeListResponse],
    summary="List all order changes from all schools"
)
async def list_all_order_changes(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: ChangeStatus | None = Query(None, alias="status", description="Filter by status"),
    change_type: ChangeType | None = Query(None, description="Filter by change type"),
):
    """
    List all order changes from all schools the user has access to.
    """
    query = (
        select(OrderChange)
        .join(Order, OrderChange.order_id == Order.id)
        .options(
            selectinload(OrderChange.order).selectinload(Order.school)
        )
        .where(Order.school_id.in_(user_school_ids))
        .order_by(OrderChange.created_at.desc())
    )

    if status_filter:
        query = query.where(OrderChange.status == status_filter)
    if change_type:
        query = query.where(OrderChange.change_type == change_type)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    changes = result.scalars().all()

    return [
        OrderChangeListResponse(
            id=change.id,
            order_id=change.order_id,
            order_code=change.order.code if change.order else "",
            school_id=change.order.school_id if change.order else None,
            school_name=change.order.school.name if change.order and change.order.school else None,
            change_type=change.change_type,
            status=change.status,
            returned_quantity=change.returned_quantity,
            new_quantity=change.new_quantity,
            price_adjustment=change.price_adjustment,
            change_date=change.change_date,
            reason=change.reason
        )
        for change in changes
    ]


# =============================================================================
# School-Specific Orders Router (original endpoints)
# =============================================================================
school_router = APIRouter(prefix="/schools/{school_id}/orders", tags=["Orders"])


@school_router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def create_order(
    school_id: UUID,
    order_data: OrderCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new order (encargo) with items (requires SELLER role)

    Automatically:
    - Generates order code (ENC-YYYY-NNNN)
    - Validates garment types
    - Processes custom measurements
    - Calculates totals
    - Handles advance payment
    - Sends confirmation email if client has email
    """
    # Ensure school_id matches
    order_data.school_id = school_id

    order_service = OrderService(db)

    try:
        order = await order_service.create_order(order_data, current_user.id)
        await db.commit()

        # Send confirmation email automatically if client has email
        receipt_service = ReceiptService(db)
        order_with_details = await receipt_service.get_order_with_details(order.id)

        if order_with_details and order_with_details.client and order_with_details.client.email:
            try:
                school_name = order_with_details.school.name if order_with_details.school else "Uniformes Consuelo Rios"
                email_html = receipt_service.generate_order_email_html(order_with_details, school_name)
                send_order_confirmation_email(
                    email=order_with_details.client.email,
                    name=order_with_details.client.name,
                    order_code=order_with_details.code,
                    html_content=email_html
                )
            except Exception as e:
                # Log but don't fail the order creation
                print(f"Warning: Could not send order confirmation email: {e}")

        return OrderResponse.model_validate(order)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "",
    response_model=list[OrderListResponse],
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def list_orders_for_school(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: OrderStatus | None = Query(None, description="Filter by status")
):
    """List orders for a specific school"""
    order_service = OrderService(db)

    filters = {}
    if status_filter:
        filters["status"] = status_filter

    orders = await order_service.get_multi(
        school_id=school_id,
        skip=skip,
        limit=limit,
        filters=filters
    )

    # Convert to list response (simplified)
    return [
        OrderListResponse(
            id=order.id,
            code=order.code,
            status=order.status,
            source=order.source,  # Include source for filtering web_portal orders
            client_name="",  # TODO: Join with client
            student_name=None,
            delivery_date=order.delivery_date,
            total=order.total,
            balance=order.balance,
            created_at=order.created_at,
            items_count=0,  # TODO: Count items
            school_id=order.school_id,
            # Delivery info
            delivery_type=order.delivery_type,
            delivery_fee=order.delivery_fee,
            delivery_address=order.delivery_address,
            delivery_neighborhood=order.delivery_neighborhood
        )
        for order in orders
    ]


@school_router.get(
    "/{order_id}",
    response_model=OrderWithItems,
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_order_for_school(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession
):
    """Get order with items and client info for a specific school"""
    order_service = OrderService(db)
    order = await order_service.get_order_with_items(order_id, school_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get school name
    school_name = None
    if order.school_id:
        result = await db.execute(
            select(School).where(School.id == order.school_id)
        )
        school = result.scalar_one_or_none()
        school_name = school.name if school else None

    # Build response with client and items info
    items_response = []
    for item in order.items:
        item_dict = {
            "id": item.id,
            "order_id": item.order_id,
            "school_id": item.school_id,
            "garment_type_id": item.garment_type_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal,
            "size": item.size,
            "color": item.color,
            "gender": item.gender,
            "custom_measurements": item.custom_measurements,
            "embroidery_text": item.embroidery_text,
            "notes": item.notes,
            "item_status": item.item_status,
            "status_updated_at": item.status_updated_at,
            "garment_type_name": item.garment_type.name if item.garment_type else "Unknown",
            "garment_type_category": item.garment_type.category if item.garment_type else None,
            "requires_embroidery": item.garment_type.requires_embroidery if item.garment_type else False,
            "has_custom_measurements": bool(item.custom_measurements)
        }
        items_response.append(item_dict)

    return OrderWithItems(
        id=order.id,
        school_id=order.school_id,
        code=order.code,
        client_id=order.client_id,
        status=order.status,
        delivery_date=order.delivery_date,
        notes=order.notes,
        subtotal=order.subtotal,
        tax=order.tax,
        total=order.total,
        paid_amount=order.paid_amount,
        balance=order.balance,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=items_response,
        client_name=order.client.name if order.client else "Unknown",
        client_phone=order.client.phone if order.client else None,
        client_email=order.client.email if order.client else None,
        student_name=order.client.student_name if order.client else None,
        # Delivery fields
        delivery_type=order.delivery_type,
        delivery_address=order.delivery_address,
        delivery_neighborhood=order.delivery_neighborhood,
        delivery_city=order.delivery_city,
        delivery_references=order.delivery_references,
        delivery_zone_id=order.delivery_zone_id,
        delivery_fee=order.delivery_fee,
        school_name=school_name
    )


@school_router.get(
    "/{order_id}/receipt",
    response_class=HTMLResponse,
    dependencies=[Depends(require_school_access(UserRole.VIEWER))],
    summary="Get order receipt HTML for printing"
)
async def get_order_receipt(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession
):
    """
    Get HTML receipt for an order (encargo), optimized for thermal printer (80mm).

    Opens in browser and triggers print dialog automatically.
    """
    receipt_service = ReceiptService(db)
    html = await receipt_service.generate_order_receipt_html(order_id)

    if not html:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encargo no encontrado"
        )

    return HTMLResponse(content=html)


@school_router.post(
    "/{order_id}/send-receipt",
    dependencies=[Depends(require_school_access(UserRole.SELLER))],
    summary="Send order receipt by email"
)
async def send_order_receipt_email(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession
):
    """
    Send order receipt by email to the client.

    Requires the client to have a valid email address.
    Returns success/failure status.
    """
    # Get order with details
    receipt_service = ReceiptService(db)
    order = await receipt_service.get_order_with_details(order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encargo no encontrado"
        )

    # Check client email
    if not order.client or not order.client.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente no tiene email registrado"
        )

    # Generate email HTML
    school_name = order.school.name if order.school else "Uniformes Consuelo Rios"
    email_html = receipt_service.generate_order_email_html(order, school_name)

    # Send email
    success = send_order_confirmation_email(
        email=order.client.email,
        name=order.client.name,
        order_code=order.code,
        html_content=email_html
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al enviar el email"
        )

    return {"message": f"Recibo enviado a {order.client.email}", "success": True}


@school_router.post(
    "/{order_id}/payments",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def add_order_payment(
    school_id: UUID,
    order_id: UUID,
    payment_data: OrderPayment,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Add payment to order (requires SELLER role)"""
    order_service = OrderService(db)

    try:
        order = await order_service.add_payment(order_id, school_id, payment_data, current_user.id)

        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )

        await db.commit()
        return OrderResponse.model_validate(order)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def update_order_status(
    school_id: UUID,
    order_id: UUID,
    new_status: OrderStatus,
    db: DatabaseSession
):
    """Update order status (requires SELLER role)"""
    order_service = OrderService(db)

    order = await order_service.update_status(order_id, school_id, new_status)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    await db.commit()
    return OrderResponse.model_validate(order)


@school_router.patch(
    "/{order_id}",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def update_order(
    school_id: UUID,
    order_id: UUID,
    order_update: OrderUpdate,
    db: DatabaseSession
):
    """Update order details (delivery_date, notes) - requires SELLER role"""
    order_service = OrderService(db)

    order = await order_service.update_order(order_id, school_id, order_update)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    await db.commit()
    return OrderResponse.model_validate(order)


@school_router.patch(
    "/{order_id}/items/{item_id}/status",
    response_model=OrderItemWithGarment,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def update_item_status(
    school_id: UUID,
    order_id: UUID,
    item_id: UUID,
    status_update: OrderItemStatusUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update individual order item status (requires SELLER role)

    This allows tracking progress of individual items within an order.
    For example: a catalog item may be ready while a yomber is still in production.

    Status transitions:
    - pending → in_production, ready, delivered, cancelled
    - in_production → ready, delivered, cancelled
    - ready → delivered, cancelled
    - delivered → (final state)
    - cancelled → (final state)

    The order status is automatically synchronized based on item statuses.
    """
    order_service = OrderService(db)

    try:
        item = await order_service.update_item_status(
            order_id=order_id,
            item_id=item_id,
            school_id=school_id,
            new_status=status_update.item_status,
            user_id=current_user.id
        )

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item no encontrado"
            )

        await db.commit()

        # Reload item with garment type for response
        item = await order_service.get_item(item_id, order_id, school_id)

        return OrderItemWithGarment(
            id=item.id,
            order_id=item.order_id,
            school_id=item.school_id,
            garment_type_id=item.garment_type_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            size=item.size,
            color=item.color,
            gender=item.gender,
            custom_measurements=item.custom_measurements,
            embroidery_text=item.embroidery_text,
            notes=item.notes,
            item_status=item.item_status,
            status_updated_at=item.status_updated_at,
            garment_type_name=item.garment_type.name if item.garment_type else "Unknown",
            garment_type_category=item.garment_type.category if item.garment_type else None,
            requires_embroidery=item.garment_type.requires_embroidery if item.garment_type else False,
            has_custom_measurements=bool(item.custom_measurements)
        )

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/{order_id}/stock-verification",
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def verify_order_stock(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession
):
    """
    Verify stock availability for all items in an order.

    Returns detailed information about:
    - Which items can be fulfilled from current inventory
    - Which items need to be produced
    - Suggested actions for each item

    This is useful for web orders to determine if they can be
    immediately fulfilled or need production.
    """
    order_service = OrderService(db)

    try:
        verification = await order_service.verify_order_stock(order_id, school_id)
        return verification

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@school_router.post(
    "/{order_id}/approve",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def approve_order_with_stock(
    school_id: UUID,
    order_id: UUID,
    approval_request: OrderApprovalRequest,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Approve/process a web order with intelligent stock handling.

    This endpoint:
    1. Checks stock availability for each item
    2. For items WITH stock: marks as READY and decrements inventory
    3. For items WITHOUT stock: marks as IN_PRODUCTION

    Options:
    - auto_fulfill_if_stock: If true, automatically fulfill items that have stock
    - items: Override actions for specific items

    The order status is automatically updated based on item statuses:
    - All READY → Order is READY
    - Any IN_PRODUCTION → Order is IN_PRODUCTION
    """
    order_service = OrderService(db)

    try:
        # Convert item actions from request
        item_actions = None
        if approval_request.items:
            item_actions = [
                {
                    "item_id": str(item.item_id),
                    "action": item.action,
                    "product_id": str(item.product_id) if item.product_id else None,
                    "quantity_from_stock": item.quantity_from_stock
                }
                for item in approval_request.items
            ]

        order = await order_service.approve_order_with_stock(
            order_id=order_id,
            school_id=school_id,
            user_id=current_user.id,
            auto_fulfill=approval_request.auto_fulfill_if_stock,
            item_actions=item_actions
        )

        await db.commit()
        return OrderResponse.model_validate(order)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.post(
    "/{order_id}/cancel",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def cancel_order(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    reason: str | None = Query(None, description="Cancellation reason")
):
    """
    Cancel an order and release any reserved stock.

    This endpoint:
    1. Validates the order can be cancelled (not delivered/already cancelled)
    2. Releases any stock that was reserved for this order ("pisar" functionality)
    3. Marks all items and the order as CANCELLED

    Reserved stock is returned to inventory when the order is cancelled.

    Requires SELLER role.

    Args:
        school_id: School ID
        order_id: Order ID
        reason: Optional cancellation reason (added to order notes)
        db: Database session
        current_user: Current authenticated user

    Returns:
        OrderResponse: Updated order with CANCELLED status

    Raises:
        HTTPException: 404 if order not found
        HTTPException: 400 if order cannot be cancelled
    """
    order_service = OrderService(db)

    try:
        order = await order_service.cancel_order(
            order_id=order_id,
            school_id=school_id,
            user_id=current_user.id,
            reason=reason
        )

        await db.commit()
        return OrderResponse.model_validate(order)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.post(
    "/{order_id}/resolve-duplicate",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def resolve_duplicate_order(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    sale_id: UUID = Query(..., description="Sale ID that replaces this order"),
    notes: str | None = Query(None, description="Additional notes")
):
    """
    Resolve a duplicate order that was already fulfilled by a physical sale.

    Cancels the order (reverting inventory reservations, advance payment transactions,
    and accounts receivable) while keeping the sale intact.

    Requires SELLER role.
    """
    # Validate sale exists
    sale_result = await db.execute(
        select(Sale).where(Sale.id == sale_id)
    )
    sale = sale_result.scalar_one_or_none()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    reason = f"Duplicado con venta {sale.code} — Cliente compro en punto fisico"
    if notes:
        reason += f". {notes}"

    order_service = OrderService(db)

    try:
        order = await order_service.cancel_order(
            order_id=order_id,
            school_id=school_id,
            user_id=current_user.id,
            reason=reason
        )

        await db.commit()
        return OrderResponse.model_validate(order)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =============================================================================
# Web Portal Order Endpoints (Public - for web clients)
# =============================================================================
web_router = APIRouter(prefix="/portal/orders", tags=["Order Portal"])


@web_router.post(
    "/create",
    response_model=WebOrderResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_web_order(
    order_data: OrderCreate,
    db: DatabaseSession
):
    """
    Create order from web portal (public endpoint).

    This endpoint allows web clients to create orders without authentication.
    The client_id in the order_data should be from a registered web client.

    Automatically sends confirmation email to the client.
    """
    order_service = OrderService(db)

    try:
        # Validate that the client exists
        client_result = await db.execute(
            select(Client).where(Client.id == order_data.client_id)
        )
        client = client_result.scalar_one_or_none()

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado. Por favor registra tus datos primero."
            )

        # Create the order using the web-specific method
        order = await order_service.create_web_order(order_data)
        await db.commit()

        # Send confirmation email automatically
        if client.email:
            try:
                receipt_service = ReceiptService(db)
                order_with_details = await receipt_service.get_order_with_details(order.id)

                if order_with_details:
                    school_name = order_with_details.school.name if order_with_details.school else "Uniformes Consuelo Rios"
                    email_html = receipt_service.generate_order_email_html(order_with_details, school_name)
                    send_order_confirmation_email(
                        email=client.email,
                        name=client.name,
                        order_code=order.code,
                        html_content=email_html
                    )
            except Exception as e:
                # Log but don't fail the order creation
                print(f"Warning: Could not send web order confirmation email: {e}")

        return WebOrderResponse(
            id=order.id,
            code=order.code,
            status=order.status,
            total=order.total,
            created_at=order.created_at,
            message=f"¡Pedido {order.code} creado exitosamente! Te contactaremos pronto."
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@web_router.post(
    "/{order_id}/upload-payment-proof",
    summary="Upload payment proof for order"
)
async def upload_payment_proof(
    order_id: UUID,
    db: DatabaseSession,
    file: UploadFile = File(...),
    payment_notes: str = Query(None, description="Optional payment notes")
):
    """
    Upload payment proof (receipt/screenshot) for an order.

    Public endpoint - allows clients to upload their payment proof
    after creating an order.

    Accepted file types: .jpg, .jpeg, .png, .pdf
    Max file size: 5MB

    Args:
        order_id: ID of the order
        file: Payment proof file (image or PDF)
        payment_notes: Optional notes about the payment
        db: Database session

    Returns:
        dict: Success message with file URL

    Raises:
        HTTPException: 404 if order not found
        HTTPException: 400 if file type invalid or too large
    """
    # Validate file type
    allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Solo se aceptan: {', '.join(allowed_extensions)}"
        )

    # Check file size (5MB max)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo es muy grande. Tamaño máximo: 5MB"
        )

    # Find the order
    query = select(Order).where(Order.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado"
        )

    # Create upload directory if it doesn't exist
    upload_dir = Path("/var/www/uniformes-system-v2/uploads/payment-proofs")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    import uuid as uuid_lib
    timestamp = get_colombia_now_naive().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{order.code}_{timestamp}_{uuid_lib.uuid4().hex[:8]}{file_ext}"
    file_path = upload_dir / unique_filename

    # Save file
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar el archivo: {str(e)}"
        )

    # Update order with payment proof URL and set status to pending
    from app.models.order import PaymentProofStatus
    file_url = f"/uploads/payment-proofs/{unique_filename}"
    order.payment_proof_url = file_url
    order.payment_proof_status = PaymentProofStatus.PENDING  # Marcar como pendiente de revisión
    if payment_notes:
        order.payment_notes = payment_notes

    await db.commit()

    return {
        "message": "Comprobante de pago subido exitosamente",
        "file_url": file_url,
        "order_code": order.code
    }


# =============================================================================
# Payment Verification Endpoints (Admin - for desktop app)
# =============================================================================

@school_router.post(
    "/{order_id}/approve-payment",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))],
    summary="Approve payment proof"
)
async def approve_payment(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Approve payment proof for an order.

    Changes order status to 'in_production' after payment approval.
    Requires SELLER role.

    Args:
        school_id: School ID
        order_id: Order ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        OrderResponse: Updated order with new status

    Raises:
        HTTPException: 404 if order not found
        HTTPException: 400 if no payment proof uploaded
    """
    # Find the order
    query = select(Order).where(
        Order.id == order_id,
        Order.school_id == school_id
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado"
        )

    if not order.payment_proof_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay comprobante de pago para aprobar"
        )

    # Update order status to in_production (payment approved)
    from app.models.order import PaymentProofStatus
    order.status = OrderStatus.IN_PRODUCTION
    order.payment_proof_status = PaymentProofStatus.APPROVED  # Marcar comprobante como aprobado
    order.payment_notes = (order.payment_notes or "") + f"\n[Pago aprobado por {current_user.full_name}]"

    await db.commit()
    await db.refresh(order)

    return OrderResponse.model_validate(order)


@school_router.post(
    "/{order_id}/reject-payment",
    response_model=OrderResponse,
    dependencies=[Depends(require_school_access(UserRole.SELLER))],
    summary="Reject payment proof"
)
async def reject_payment(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    rejection_notes: str = Query(..., description="Reason for rejection")
):
    """
    Reject payment proof for an order.

    Adds rejection notes and keeps order in pending status.
    Requires SELLER role.

    Args:
        school_id: School ID
        order_id: Order ID
        rejection_notes: Reason for rejecting the payment proof
        db: Database session
        current_user: Current authenticated user

    Returns:
        OrderResponse: Updated order with rejection notes

    Raises:
        HTTPException: 404 if order not found
        HTTPException: 400 if no payment proof uploaded
    """
    # Find the order
    query = select(Order).where(
        Order.id == order_id,
        Order.school_id == school_id
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado"
        )

    if not order.payment_proof_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay comprobante de pago para rechazar"
        )

    # Add rejection notes and mark as rejected
    from app.models.order import PaymentProofStatus
    rejection_msg = f"\n[Pago rechazado por {current_user.full_name}]: {rejection_notes}"
    order.payment_notes = (order.payment_notes or "") + rejection_msg
    order.payment_proof_status = PaymentProofStatus.REJECTED  # Marcar como rechazado

    # Clear payment proof URL so client can upload a new one
    order.payment_proof_url = None

    await db.commit()
    await db.refresh(order)

    return OrderResponse.model_validate(order)


# =============================================================================
# Order Changes Endpoints (Cambios/Devoluciones de Encargos)
# =============================================================================

@school_router.post(
    "/{order_id}/changes",
    response_model=OrderChangeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.SELLER))]
)
async def create_order_change(
    school_id: UUID,
    order_id: UUID,
    change_data: OrderChangeCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create an order change request (size change, product change, return, defect).

    Requires SELLER role. The change will be created in PENDING status.

    Types of changes:
    - size_change: Change product size
    - product_change: Change to different product
    - return: Return product without replacement (refund)
    - defect: Change due to defective product
    """
    order_service = OrderService(db)

    try:
        change = await order_service.create_order_change(
            order_id=order_id,
            school_id=school_id,
            user_id=current_user.id,
            change_data=change_data
        )
        await db.commit()
        return OrderChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/{order_id}/changes",
    response_model=list[OrderChangeResponse],
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def list_order_changes(
    school_id: UUID,
    order_id: UUID,
    db: DatabaseSession
):
    """
    Get all change requests for an order.

    Returns list of all changes (pending, approved, rejected) ordered by creation date.
    """
    order_service = OrderService(db)

    try:
        changes = await order_service.get_order_changes(order_id, school_id)
        return [OrderChangeResponse.model_validate(change) for change in changes]

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@school_router.patch(
    "/{order_id}/changes/{change_id}/approve",
    response_model=OrderChangeResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def approve_order_change(
    school_id: UUID,
    order_id: UUID,
    change_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    approve_data: OrderChangeApprove | None = None
):
    """
    Approve an order change request (requires ADMIN role).

    This will:
    1. Release reserved stock from original item (if applicable)
    2. Modify the order item in-place with new product/size/specs
    3. Try to reserve stock for the new product
    4. Recalculate order totals
    5. Create accounting transaction if there's a price adjustment
    6. Update accounts receivable if applicable
    7. Sync order status from items
    """
    order_service = OrderService(db)
    from app.models.sale import PaymentMethod

    payment_method = approve_data.payment_method if approve_data else PaymentMethod.CASH

    try:
        change = await order_service.approve_order_change(
            change_id,
            school_id,
            payment_method=payment_method,
            approved_by=current_user.id
        )
        await db.commit()
        return OrderChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.patch(
    "/{order_id}/changes/{change_id}/reject",
    response_model=OrderChangeResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def reject_order_change(
    school_id: UUID,
    order_id: UUID,
    change_id: UUID,
    reject_data: OrderChangeReject,
    db: DatabaseSession
):
    """
    Reject an order change request (requires ADMIN role).

    No inventory or accounting adjustments will be made.
    Rejection reason is required.
    """
    order_service = OrderService(db)

    try:
        change = await order_service.reject_order_change(
            change_id,
            school_id,
            reject_data.rejection_reason
        )
        await db.commit()
        return OrderChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
