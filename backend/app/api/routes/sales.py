"""
Sales Endpoints

Two types of endpoints:
1. Multi-school: /sales - Lists data from ALL schools user has access to
2. School-specific: /schools/{school_id}/sales - Original endpoints for specific school
"""
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, status, Query, Depends
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload, joinedload

from app.api.dependencies import DatabaseSession, CurrentUser, require_permission, UserSchoolIds, get_user_school_ids_with_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.models.user import User
from app.models.sale import Sale, SaleItem, SaleChange, SaleSource, SaleStatus, ChangeStatus, ChangeType
from app.models.client import Client
from app.models.school import School
from app.schemas.sale import (
    SaleCreate, SaleUpdate, SaleResponse, SaleWithItems, SaleListResponse,
    SaleChangeCreate, SaleChangeResponse, SaleChangeUpdate, SaleChangeListResponse,
    SaleChangeApprove, SaleChangeReject, AddPaymentToSale, SalePaymentResponse,
    SaleCancelRequest, SaleCancelResponse, SaleChangeDetailResponse,
    TransactionSummary, InventoryMovementSummary, OrderSummary
)
from app.models.sale import PaymentMethod
from app.services.sale import SaleService
from app.services.receipt import ReceiptService
from app.services.email import send_sale_confirmation_email
from fastapi.responses import HTMLResponse


# =============================================================================
# Multi-School Sales Router (lists from ALL user's schools)
# =============================================================================
router = APIRouter(tags=["Sales"])


@router.get(
    "/sales",
    response_model=PaginatedResponse[SaleListResponse],
    summary="List sales from all schools",
    responses=AUTHENTICATED,
    operation_id="listMultiSchoolSales"
)
async def list_all_sales(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    school_id: UUID | None = Query(None, description="Filter by specific school"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    source: SaleSource | None = Query(None, description="Filter by source"),
    search: str | None = Query(None, description="Search by code or client name"),
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    include_historical: bool = Query(False, description="Include historical/migrated sales"),
    start_date: date | None = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="Filter until date (YYYY-MM-DD)")
):
    """
    List sales from ALL schools the user has access to.

    **Auth:** Bearer JWT (staff)
    **Tenant isolation:** Filters by authenticated user's assigned school_ids

    Supports filtering by:
    - school_id: Specific school (optional)
    - status: Sale status (pending, completed, cancelled)
    - source: Sale source (desktop_app, web_portal, api)
    - search: Search in sale code or client name
    """
    if not user_school_ids:
        return PaginatedResponse[SaleListResponse](items=[], total=0, skip=skip, limit=limit)

    # Base filter conditions (reused for data query and count)
    filters = [Sale.school_id.in_(user_school_ids)]

    if school_id:
        if school_id not in user_school_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        filters.append(Sale.school_id == school_id)

    if status_filter:
        filters.append(Sale.status == status_filter)

    if source:
        filters.append(Sale.source == source)

    if client_id:
        filters.append(Sale.client_id == client_id)

    if not include_historical:
        filters.append(Sale.is_historical.is_not(True))

    if search:
        search_term = f"%{search}%"
        filters.append(
            or_(
                Sale.code.ilike(search_term),
                Sale.client.has(Client.name.ilike(search_term))
            )
        )

    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        filters.append(Sale.sale_date >= start_datetime)
    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        filters.append(Sale.sale_date <= end_datetime)

    # Count total
    total = (await db.execute(select(func.count(Sale.id)).where(*filters))).scalar_one()

    # Data query
    query = (
        select(Sale)
        .options(
            selectinload(Sale.items),
            selectinload(Sale.payments),
            joinedload(Sale.client),
            joinedload(Sale.user),
            joinedload(Sale.school)
        )
        .where(*filters)
        .order_by(Sale.created_at.desc())
        .offset(skip).limit(limit)
    )

    result = await db.execute(query)
    sales = result.unique().scalars().all()

    def get_payment_method(sale: Sale) -> PaymentMethod | None:
        if sale.payment_method:
            return sale.payment_method
        if sale.payments and len(sale.payments) > 0:
            return sale.payments[0].payment_method
        return None

    items = [
        SaleListResponse(
            id=sale.id,
            code=sale.code,
            status=sale.status,
            source=sale.source,
            payment_method=get_payment_method(sale),
            total=sale.total,
            paid_amount=sale.paid_amount,
            client_id=sale.client_id,
            client_name=sale.client.name if sale.client else None,
            sale_date=sale.sale_date,
            created_at=sale.created_at,
            items_count=len(sale.items) if sale.items else 0,
            user_id=sale.user_id,
            user_name=sale.user.username if sale.user else None,
            school_id=sale.school_id,
            school_name=sale.school.name if sale.school else None
        )
        for sale in sales
    ]

    return PaginatedResponse[SaleListResponse](
        items=items, total=total, skip=skip, limit=limit
    )


@router.get(
    "/sales/{sale_id}",
    response_model=SaleResponse,
    summary="Get sale by ID (from any accessible school)",
    responses=responses(404),
    operation_id="getMultiSchoolSale"
)
async def get_sale_global(
    sale_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
):
    """Get a specific sale by ID from any school the user has access to."""
    result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items))
        .where(
            Sale.id == sale_id,
            Sale.school_id.in_(user_school_ids)
        )
    )
    sale = result.scalar_one_or_none()

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    return SaleResponse.model_validate(sale)


@router.get(
    "/sales/{sale_id}/details",
    response_model=SaleWithItems,
    summary="Get sale with full details (from any accessible school)",
    responses=responses(404),
    operation_id="getMultiSchoolSaleDetails"
)
async def get_sale_details_global(
    sale_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
):
    """
    Get a specific sale with all items and details from any school the user has access to.
    Does not require school_id in URL - validates access based on the sale's school.
    """
    from app.schemas.sale import SaleItemWithProduct

    result = await db.execute(
        select(Sale)
        .options(
            selectinload(Sale.items).selectinload(SaleItem.product),
            selectinload(Sale.payments)
        )
        .where(
            Sale.id == sale_id,
            Sale.school_id.in_(user_school_ids)
        )
    )
    sale = result.scalar_one_or_none()

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada o sin acceso"
        )

    items_with_products = []
    for item in sale.items:
        item_dict = {
            "id": item.id,
            "sale_id": item.sale_id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal,
            "product_code": item.product.code if item.product else None,
            "product_name": item.product.name if item.product else None,
            "product_size": item.product.size if item.product else None,
            "product_color": item.product.color if item.product else None,
            "is_global": item.product.school_id is None if item.product else False,
        }
        items_with_products.append(SaleItemWithProduct(**item_dict))

    # Get client name
    client_name = None
    if sale.client_id:
        result = await db.execute(
            select(Client).where(Client.id == sale.client_id)
        )
        client = result.scalar_one_or_none()
        client_name = client.name if client else None

    # Get user name (seller)
    user_name = None
    if sale.user_id:
        result = await db.execute(
            select(User).where(User.id == sale.user_id)
        )
        user = result.scalar_one_or_none()
        user_name = user.username if user else None

    # Get school name
    school_name = None
    if sale.school_id:
        result = await db.execute(
            select(School).where(School.id == sale.school_id)
        )
        school = result.scalar_one_or_none()
        school_name = school.name if school else None

    # Build payments list
    from app.schemas.sale import SalePaymentResponse
    payments_list = [
        SalePaymentResponse(
            id=p.id,
            sale_id=p.sale_id,
            amount=p.amount,
            payment_method=p.payment_method,
            notes=p.notes,
            transaction_id=p.transaction_id,
            created_at=p.created_at
        )
        for p in (sale.payments or [])
    ]

    return SaleWithItems(
        id=sale.id,
        school_id=sale.school_id,
        code=sale.code,
        client_id=sale.client_id,
        user_id=sale.user_id,
        status=sale.status,
        source=sale.source,
        is_historical=sale.is_historical,
        payment_method=sale.payment_method,
        total=sale.total,
        paid_amount=sale.paid_amount,
        sale_date=sale.sale_date,
        notes=sale.notes,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items_with_products,
        payments=payments_list,
        client_name=client_name,
        user_name=user_name,
        school_name=school_name
    )


# =============================================================================
# Multi-School Sale Changes Endpoint
# =============================================================================

@router.get(
    "/sale-changes",
    response_model=PaginatedResponse[SaleChangeListResponse],
    summary="List all sale changes from all schools",
    responses=AUTHENTICATED,
    operation_id="listMultiSchoolSaleChanges"
)
async def list_all_sale_changes(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: ChangeStatus | None = Query(None, alias="status", description="Filter by status"),
    change_type: ChangeType | None = Query(None, description="Filter by change type"),
):
    """
    List all sale changes from all schools the user has access to.

    This is a global endpoint that returns all changes in a single request,
    avoiding the need for multiple API calls per sale.

    Includes full product details for both original and new products.
    """
    from app.models.order import Order

    query = (
        select(SaleChange)
        .join(Sale, SaleChange.sale_id == Sale.id)
        .options(
            selectinload(SaleChange.sale),
            selectinload(SaleChange.original_item).selectinload(SaleItem.product),
            selectinload(SaleChange.new_product),
            selectinload(SaleChange.user),
            selectinload(SaleChange.order),
        )
        .where(Sale.school_id.in_(user_school_ids))
        .order_by(SaleChange.created_at.desc())
    )

    # Apply filters
    if status_filter:
        query = query.where(SaleChange.status == status_filter)
    if change_type:
        query = query.where(SaleChange.change_type == change_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    changes = result.scalars().all()

    response_list = []
    for change in changes:
        original_item = change.original_item
        orig_product = original_item.product if original_item else None
        new_product = change.new_product

        response_list.append(
            SaleChangeListResponse(
                id=change.id,
                sale_id=change.sale_id,
                sale_code=change.sale.code if change.sale else "",
                change_type=change.change_type,
                status=change.status,
                returned_quantity=change.returned_quantity,
                new_quantity=change.new_quantity,
                price_adjustment=change.price_adjustment,
                change_date=change.change_date,
                reason=change.reason,
                rejection_reason=change.rejection_reason,
                created_at=change.created_at,
                original_product_code=orig_product.code if orig_product else None,
                original_product_name=orig_product.name if orig_product else None,
                original_product_size=orig_product.size if orig_product else None,
                original_product_color=orig_product.color if orig_product else None,
                original_unit_price=original_item.unit_price if original_item else None,
                original_is_global=orig_product.is_global if orig_product else False,
                new_product_code=new_product.code if new_product else None,
                new_product_name=new_product.name if new_product else None,
                new_product_size=new_product.size if new_product else None,
                new_product_color=new_product.color if new_product else None,
                new_unit_price=change.new_unit_price,
                new_is_global=new_product.is_global if new_product else False,
                user_username=change.user.username if change.user else None,
                order_code=change.order.code if change.order else None,
                order_id=change.order_id,
            )
        )

    return paginate(response_list, total, skip, limit)


@router.get(
    "/sale-changes/{change_id}/details",
    response_model=SaleChangeDetailResponse,
    summary="Get detailed information for a sale change",
    responses=responses(404),
    operation_id="getSaleChangeDetails"
)
async def get_sale_change_details(
    change_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
):
    """
    Get complete details for a sale change including:
    - Full product information (original and new)
    - Related accounting transactions
    - Inventory movements
    - Associated order (if any)
    - Original sale information
    """
    from app.models.accounting import Transaction
    from app.models.inventory_log import InventoryLog
    from app.models.order import Order
    from decimal import Decimal

    # Get change with all related data
    result = await db.execute(
        select(SaleChange)
        .join(Sale, SaleChange.sale_id == Sale.id)
        .options(
            selectinload(SaleChange.sale).selectinload(Sale.client),
            selectinload(SaleChange.sale).selectinload(Sale.school),
            selectinload(SaleChange.original_item).selectinload(SaleItem.product),
            selectinload(SaleChange.new_product),
            selectinload(SaleChange.user),
            selectinload(SaleChange.order),
        )
        .where(
            SaleChange.id == change_id,
            Sale.school_id.in_(user_school_ids)
        )
    )
    change = result.scalar_one_or_none()

    if not change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cambio no encontrado o sin acceso"
        )

    original_item = change.original_item
    orig_product = original_item.product if original_item else None
    new_product = change.new_product

    # Get related transactions
    transactions_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.sale_id == change.sale_id,
            Transaction.category == "sale_changes"
        )
        .order_by(Transaction.transaction_date.desc())
    )
    transactions = transactions_result.scalars().all()

    transaction_summaries = [
        TransactionSummary(
            id=t.id,
            type=t.type.value if hasattr(t.type, 'value') else str(t.type),
            amount=Decimal(str(t.amount)),
            description=t.description,
            transaction_date=t.transaction_date
        )
        for t in transactions
    ]

    # Get related inventory movements (using sale_change_id FK)
    from app.models.product import Inventory

    inventory_movements_result = await db.execute(
        select(InventoryLog)
        .options(
            selectinload(InventoryLog.inventory).selectinload(Inventory.product),
        )
        .where(InventoryLog.sale_change_id == change.id)
        .order_by(InventoryLog.created_at.desc())
    )
    movements = inventory_movements_result.scalars().all()

    movement_summaries = []
    for m in movements:
        product_code = ""
        product_name = None
        if m.inventory and m.inventory.product:
            product_code = m.inventory.product.code
            product_name = m.inventory.product.name

        movement_summaries.append(
            InventoryMovementSummary(
                id=m.id,
                product_code=product_code,
                product_name=product_name,
                movement_type="entrada" if m.quantity_delta > 0 else "salida",
                quantity=abs(m.quantity_delta),
                created_at=m.created_at
            )
        )

    # Build associated order summary if exists
    associated_order = None
    if change.order:
        associated_order = OrderSummary(
            id=change.order.id,
            code=change.order.code,
            status=change.order.status.value if hasattr(change.order.status, 'value') else str(change.order.status),
            delivery_date=change.order.delivery_date
        )

    # Build full response
    sale = change.sale
    return SaleChangeDetailResponse(
        id=change.id,
        sale_id=change.sale_id,
        sale_code=sale.code if sale else "",
        change_type=change.change_type,
        status=change.status,
        returned_quantity=change.returned_quantity,
        new_quantity=change.new_quantity,
        price_adjustment=change.price_adjustment,
        change_date=change.change_date,
        reason=change.reason,
        rejection_reason=change.rejection_reason,
        created_at=change.created_at,
        # Original product info
        original_product_code=orig_product.code if orig_product else None,
        original_product_name=orig_product.name if orig_product else None,
        original_product_size=orig_product.size if orig_product else None,
        original_product_color=orig_product.color if orig_product else None,
        original_unit_price=original_item.unit_price if original_item else None,
        original_is_global=orig_product.is_global if orig_product else False,
        new_product_code=new_product.code if new_product else None,
        new_product_name=new_product.name if new_product else None,
        new_product_size=new_product.size if new_product else None,
        new_product_color=new_product.color if new_product else None,
        new_unit_price=change.new_unit_price,
        new_is_global=new_product.is_global if new_product else False,
        user_username=change.user.username if change.user else None,
        order_code=change.order.code if change.order else None,
        order_id=change.order_id,
        # Sale info
        sale_total=sale.total if sale else Decimal("0"),
        sale_date=sale.sale_date if sale else change.change_date,
        client_name=sale.client.name if sale and sale.client else None,
        school_name=sale.school.name if sale and sale.school else None,
        # Related data
        transactions=transaction_summaries,
        inventory_movements=movement_summaries,
        associated_order=associated_order,
    )


# =============================================================================
# School-Specific Sales Router (original endpoints)
# =============================================================================
school_router = APIRouter(prefix="/schools/{school_id}/sales", tags=["Sales"])


@school_router.post(
    "",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("sales.create"))],
    responses=responses(400),
    operation_id="createSale"
)
async def create_sale(
    school_id: UUID,
    sale_data: SaleCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new sale with items.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.create`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools

    Automatically:
    - Generates sale code ({SCHOOL}-VNT-YYYY-NNNN)
    - Validates product availability
    - Reserves inventory
    - Calculates totals (subtotal, tax, total)
    """
    # Ensure school_id matches
    sale_data.school_id = school_id

    sale_service = SaleService(db)

    try:
        sale = await sale_service.create_sale(sale_data, user_id=current_user.id)
        await db.commit()

        # Invalidate accounting caches after new sale
        from app.utils.cache import invalidate_accounting_caches
        await invalidate_accounting_caches()

        return SaleResponse.model_validate(sale)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "",
    response_model=PaginatedResponse[SaleListResponse],
    dependencies=[Depends(require_permission("sales.view"))],
    responses=AUTHENTICATED,
    operation_id="listSales"
)
async def list_sales(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """
    List sales for school.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.view`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools
    """
    count_result = await db.execute(
        select(func.count(Sale.id)).where(Sale.school_id == school_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Sale)
        .options(
            selectinload(Sale.items),
            joinedload(Sale.client),
            joinedload(Sale.user)
        )
        .where(Sale.school_id == school_id)
        .order_by(Sale.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    sales = result.unique().scalars().all()

    items = [
        SaleListResponse(
            id=sale.id,
            code=sale.code,
            status=sale.status,
            source=sale.source,
            payment_method=sale.payment_method,
            total=sale.total,
            paid_amount=sale.paid_amount,
            client_id=sale.client_id,
            client_name=sale.client.name if sale.client else None,
            sale_date=sale.sale_date,
            created_at=sale.created_at,
            items_count=len(sale.items) if sale.items else 0,
            user_id=sale.user_id,
            user_name=sale.user.username if sale.user else None
        )
        for sale in sales
    ]
    return paginate(items, total, skip, limit)


@school_router.get(
    "/{sale_id}",
    response_model=SaleResponse,
    dependencies=[Depends(require_permission("sales.view"))],
    responses=responses(404),
    operation_id="getSale"
)
async def get_sale(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession
):
    """
    Get sale by ID with items loaded.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.view`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools
    """
    sale_service = SaleService(db)
    # Use get_sale_with_items to ensure items relationship is loaded for serialization
    sale = await sale_service.get_sale_with_items(sale_id, school_id)

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    return SaleResponse.model_validate(sale)


@school_router.patch(
    "/{sale_id}",
    response_model=SaleResponse,
    dependencies=[Depends(require_permission("sales.edit"))],
    responses=responses(400, 404),
    operation_id="updateSale"
)
async def update_sale(
    school_id: UUID,
    sale_id: UUID,
    update_data: SaleUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update a sale's editable fields.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.edit`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools

    Allowed updates:
    - client_id: Assign or change the client for this sale
    - notes: Update sale notes

    Use this endpoint to:
    - Assign a client to a sale that was created without one
    - Change the associated client
    - Remove the client (set client_id to null)
    """
    sale_service = SaleService(db)

    try:
        sale = await sale_service.update_sale(
            sale_id=sale_id,
            school_id=school_id,
            data=update_data
        )
        await db.commit()

        # Reload sale with all relationships for SaleResponse
        result = await db.execute(
            select(Sale)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.payments),
                joinedload(Sale.client),
                joinedload(Sale.user),
                joinedload(Sale.school)
            )
            .where(Sale.id == sale_id)
        )
        sale = result.scalar_one()
        return SaleResponse.model_validate(sale)

    except HTTPException:
        await db.rollback()
        raise
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/{sale_id}/items",
    response_model=SaleWithItems,
    dependencies=[Depends(require_permission("sales.view"))],
    responses=responses(404),
    operation_id="getSaleItems"
)
async def get_sale_with_items(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession
):
    """Get sale with all items (including product details)"""
    from app.schemas.sale import SaleItemWithProduct

    sale_service = SaleService(db)
    sale = await sale_service.get_sale_with_items(sale_id, school_id)

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    items_with_products = []
    for item in sale.items:
        item_dict = {
            "id": item.id,
            "sale_id": item.sale_id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal,
            "product_code": item.product.code if item.product else None,
            "product_name": item.product.name if item.product else None,
            "product_size": item.product.size if item.product else None,
            "product_color": item.product.color if item.product else None,
            "is_global": item.product.school_id is None if item.product else False,
        }
        items_with_products.append(SaleItemWithProduct(**item_dict))

    # Get client name
    client_name = None
    if sale.client_id:
        result = await db.execute(
            select(Client).where(Client.id == sale.client_id)
        )
        client = result.scalar_one_or_none()
        client_name = client.name if client else None

    # Get user name (seller)
    user_name = None
    if sale.user_id:
        result = await db.execute(
            select(User).where(User.id == sale.user_id)
        )
        user = result.scalar_one_or_none()
        user_name = user.username if user else None

    # Get school name
    school_name = None
    if sale.school_id:
        result = await db.execute(
            select(School).where(School.id == sale.school_id)
        )
        school = result.scalar_one_or_none()
        school_name = school.name if school else None

    # Build payments list
    from app.schemas.sale import SalePaymentResponse
    payments_list = [
        SalePaymentResponse(
            id=p.id,
            sale_id=p.sale_id,
            amount=p.amount,
            payment_method=p.payment_method,
            notes=p.notes,
            transaction_id=p.transaction_id,
            created_at=p.created_at
        )
        for p in (sale.payments or [])
    ]

    return SaleWithItems(
        id=sale.id,
        school_id=sale.school_id,
        code=sale.code,
        client_id=sale.client_id,
        user_id=sale.user_id,
        status=sale.status,
        source=sale.source,
        is_historical=sale.is_historical,
        payment_method=sale.payment_method,
        total=sale.total,
        paid_amount=sale.paid_amount,
        sale_date=sale.sale_date,
        notes=sale.notes,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items_with_products,
        payments=payments_list,
        client_name=client_name,
        user_name=user_name,
        school_name=school_name
    )


@school_router.get(
    "/{sale_id}/receipt",
    response_class=HTMLResponse,
    dependencies=[Depends(require_permission("sales.view"))],
    summary="Get sale receipt HTML for printing",
    responses=responses(404),
    operation_id="getSaleReceipt"
)
async def get_sale_receipt(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession
):
    """
    Get HTML receipt for a sale, optimized for thermal printer (80mm).

    Opens in browser and triggers print dialog automatically.
    """
    receipt_service = ReceiptService(db)
    html = await receipt_service.generate_sale_receipt_html(sale_id)

    if not html:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    return HTMLResponse(content=html)


@school_router.post(
    "/{sale_id}/send-receipt",
    dependencies=[Depends(require_permission("sales.create"))],
    summary="Send sale receipt by email",
    responses=responses(400, 404),
    operation_id="sendSaleReceipt"
)
async def send_sale_receipt_email(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession
):
    """
    Send sale receipt by email to the client.

    Requires the client to have a valid email address.
    Returns success/failure status.
    """
    # Get sale with details
    receipt_service = ReceiptService(db)
    sale = await receipt_service.get_sale_with_details(sale_id)

    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    # Check client email
    if not sale.client or not sale.client.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente no tiene email registrado"
        )

    # Generate email HTML
    school_name = sale.school.name if sale.school else "Uniformes Consuelo Rios"
    email_html = receipt_service.generate_sale_email_html(sale, school_name)

    # Send email
    success = send_sale_confirmation_email(
        email=sale.client.email,
        name=sale.client.name,
        sale_code=sale.code,
        html_content=email_html
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al enviar el email"
        )

    return {"message": f"Recibo enviado a {sale.client.email}", "success": True}


# ============================================
# Sale Payments Endpoints
# ============================================

@school_router.post(
    "/{sale_id}/payments",
    response_model=SalePaymentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("sales.add_payment"))],
    summary="Add payment to existing sale",
    responses=responses(400, 404),
    operation_id="createSalePayment"
)
async def add_payment_to_sale(
    school_id: UUID,
    sale_id: UUID,
    payment_data: AddPaymentToSale,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Add a payment to an existing sale.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.add_payment`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools

    Use this endpoint to:
    - Fix sales that were created without payment method
    - Add partial payments to a sale
    - Record additional payments with proper accounting

    The payment will:
    - Create a SalePayment record
    - If apply_accounting=True and method is not CREDIT:
      - Create a Transaction (INCOME)
      - Update the corresponding BalanceAccount (Caja/Banco)
    - If method is CREDIT:
      - Create an AccountsReceivable record

    Validates that the payment amount doesn't exceed the remaining balance.
    """
    sale_service = SaleService(db)

    try:
        payment = await sale_service.add_payment_to_sale(
            sale_id=sale_id,
            school_id=school_id,
            payment_data=payment_data,
            user_id=current_user.id
        )
        await db.commit()
        return SalePaymentResponse.model_validate(payment)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================
# Sale Changes Endpoints
# ============================================

@school_router.post(
    "/{sale_id}/changes",
    response_model=SaleChangeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("changes.create"))],
    responses=responses(400, 404),
    operation_id="createSaleChange"
)
async def create_sale_change(
    school_id: UUID,
    sale_id: UUID,
    change_data: SaleChangeCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a sale change request (size change, product change, return, defect).

    **Auth:** Bearer JWT (staff)
    **Permission:** `changes.create`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools

    The change will be created in PENDING status.

    Types of changes:
    - size_change: Change product size (e.g., T14 → T16)
    - product_change: Change to different product
    - return: Return product without replacement (refund)
    - defect: Change due to defective product

    The system will:
    - Validate stock availability for new product
    - Calculate price adjustment automatically
    - Create change request in PENDING status
    """
    sale_service = SaleService(db)

    try:
        change = await sale_service.create_sale_change(
            sale_id=sale_id,
            school_id=school_id,
            user_id=current_user.id,
            change_data=change_data
        )
        await db.commit()
        return SaleChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/{sale_id}/changes",
    response_model=PaginatedResponse[SaleChangeListResponse],
    dependencies=[Depends(require_permission("sales.view"))],
    responses=responses(404),
    operation_id="listSaleChanges"
)
async def list_sale_changes(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    Get all change requests for a sale

    Returns paginated list of all changes (pending, approved, rejected) ordered by creation date.
    Includes full product details for both original and new products.
    """
    sale_result = await db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.school_id == school_id)
    )
    sale = sale_result.scalar_one_or_none()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada"
        )

    count_result = await db.execute(
        select(func.count(SaleChange.id)).where(SaleChange.sale_id == sale_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(SaleChange)
        .options(
            selectinload(SaleChange.original_item).selectinload(SaleItem.product),
            selectinload(SaleChange.new_product),
            selectinload(SaleChange.user),
            selectinload(SaleChange.order),
        )
        .where(SaleChange.sale_id == sale_id)
        .order_by(SaleChange.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    changes = result.scalars().all()

    response_list = []
    for change in changes:
        original_item = change.original_item
        orig_product = original_item.product if original_item else None
        new_product = change.new_product

        response_list.append(
            SaleChangeListResponse(
                id=change.id,
                sale_id=change.sale_id,
                sale_code=sale.code,
                change_type=change.change_type,
                status=change.status,
                returned_quantity=change.returned_quantity,
                new_quantity=change.new_quantity,
                price_adjustment=change.price_adjustment,
                change_date=change.change_date,
                reason=change.reason,
                rejection_reason=change.rejection_reason,
                created_at=change.created_at,
                # Original product info
                original_product_code=orig_product.code if orig_product else None,
                original_product_name=orig_product.name if orig_product else None,
                original_product_size=orig_product.size if orig_product else None,
                original_product_color=orig_product.color if orig_product else None,
                original_unit_price=original_item.unit_price if original_item else None,
                original_is_global=orig_product.is_global if orig_product else False,
                new_product_code=new_product.code if new_product else None,
                new_product_name=new_product.name if new_product else None,
                new_product_size=new_product.size if new_product else None,
                new_product_color=new_product.color if new_product else None,
                new_unit_price=change.new_unit_price,
                new_is_global=new_product.is_global if new_product else False,
                user_username=change.user.username if change.user else None,
                order_code=change.order.code if change.order else None,
                order_id=change.order_id,
            )
        )

    return paginate(response_list, total, skip, limit)


@school_router.patch(
    "/{sale_id}/changes/{change_id}/approve",
    response_model=SaleChangeResponse,
    dependencies=[Depends(require_permission("changes.approve"))],
    responses=responses(400, 404),
    operation_id="approveSaleChange"
)
async def approve_sale_change(
    school_id: UUID,
    sale_id: UUID,
    change_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    approve_data: SaleChangeApprove | None = None
):
    """
    Approve a sale change request (requires ADMIN role)

    This will:
    1. Return original product to inventory (+1)
    2. Deduct new product from inventory (-1) if applicable
    3. Create accounting transaction if there's a price adjustment:
       - price_adjustment > 0: INCOME (customer pays more)
       - price_adjustment < 0: EXPENSE (refund to customer)
    4. Update balance account (Caja/Banco) based on payment method
    5. Update change status to APPROVED

    Once approved, inventory and accounting changes are permanent.
    """
    sale_service = SaleService(db)

    # Default to CASH if no approve_data provided
    payment_method = approve_data.payment_method if approve_data else PaymentMethod.CASH

    try:
        change = await sale_service.approve_sale_change(
            change_id,
            school_id,
            payment_method=payment_method,
            approved_by=current_user.id
        )
        await db.commit()
        return SaleChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.patch(
    "/{sale_id}/changes/{change_id}/reject",
    response_model=SaleChangeResponse,
    dependencies=[Depends(require_permission("changes.reject"))],
    responses=responses(404),
    operation_id="rejectSaleChange"
)
async def reject_sale_change(
    school_id: UUID,
    sale_id: UUID,
    change_id: UUID,
    reject_data: SaleChangeReject,
    db: DatabaseSession
):
    """
    Reject a sale change request (requires ADMIN role)

    No inventory adjustments will be made.
    Rejection reason is required.
    """
    sale_service = SaleService(db)

    try:
        change = await sale_service.reject_sale_change(
            change_id,
            school_id,
            reject_data.rejection_reason
        )
        await db.commit()
        return SaleChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.patch(
    "/{sale_id}/changes/{change_id}/complete-from-order",
    response_model=SaleChangeResponse,
    dependencies=[Depends(require_permission("changes.approve"))],
    responses=responses(400, 404),
    operation_id="completeSaleChangeFromOrder"
)
async def complete_change_from_order(
    school_id: UUID,
    sale_id: UUID,
    change_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Complete a sale change that was waiting for stock (PENDING_STOCK status).

    This endpoint is used when:
    - A change was created but stock was not available
    - An order was automatically created to fulfill the new product
    - Now stock is available (order arrived or stock was added)

    The change must be in PENDING_STOCK status and have an associated order.

    IMPORTANT: The original product was already returned to inventory and the
    price adjustment was already processed when the change was created.
    This endpoint only deducts the new product from inventory.
    """
    sale_service = SaleService(db)

    try:
        change = await sale_service.complete_change_from_order(
            change_id,
            school_id,
            approved_by=current_user.id
        )
        await db.commit()
        return SaleChangeResponse.model_validate(change)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =============================================================================
# Sale Cancellation Endpoint
# =============================================================================

@school_router.post(
    "/{sale_id}/cancel",
    response_model=SaleCancelResponse,
    dependencies=[Depends(require_permission("sales.cancel"))],
    responses=responses(400, 404),
    operation_id="cancelSale"
)
async def cancel_sale(
    school_id: UUID,
    sale_id: UUID,
    cancel_data: SaleCancelRequest,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Cancel a sale with full rollback.

    **Auth:** Bearer JWT (staff)
    **Permission:** `sales.cancel`
    **Tenant isolation:** Validates school_id belongs to authenticated user's schools

    This endpoint:
    1. Validates the sale can be cancelled (not too old, no approved changes)
    2. Restores inventory for all items (school and global products)
    3. Creates reverse transactions (refunds) for all payments
    4. Cancels any pending accounts receivable
    5. Updates sale status to CANCELLED

    Validations:
    - Sale must exist and belong to the school
    - Sale must not be already cancelled
    - Sale must not have approved sale changes
    - Sale must be within the cancellation window (default 30 days)
    """
    sale_service = SaleService(db)

    try:
        result = await sale_service.cancel_sale(
            sale_id=sale_id,
            school_id=school_id,
            reason=cancel_data.reason,
            cancelled_by=current_user.id,
            refund_method=cancel_data.refund_method,
        )
        await db.commit()
        return SaleCancelResponse(**result)

    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
