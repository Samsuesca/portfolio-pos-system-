"""
Global Product Endpoints - Shared products across all schools
"""
from uuid import UUID
from pathlib import Path
from typing import Literal
import shutil
import uuid as uuid_lib
from app.utils.timezone import get_colombia_now_naive

from fastapi import APIRouter, HTTPException, status, Query, Depends, UploadFile, File
from sqlalchemy import select, func, case, and_

from app.api.dependencies import DatabaseSession, CurrentUser, UserSchoolIds, require_global_permission
from app.api.error_responses import responses, AUTHENTICATED
from app.models.product import GarmentType, GarmentTypeImage, Product, Inventory
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.product import (
    GarmentTypeCreate, GarmentTypeUpdate, GarmentTypeResponse, GarmentTypeWithImages,
    GarmentTypeImageResponse, GarmentTypeImageReorder,
    ProductCreate, ProductUpdate, ProductResponse,
    ProductWithInventory, ProductStatsResponse,
    InventoryCreate, InventoryUpdate, InventoryAdjust,
    InventoryResponse, GlobalGtVisibility,
)
from app.models.order import Order, OrderItem, OrderStatus
from app.services.product import GarmentTypeService, ProductService
from app.services.inventory import InventoryService

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024
MAX_IMAGES_PER_GARMENT_TYPE = 10
UPLOADS_BASE_DIR = Path("/var/www/uniformes-system-v2/uploads")

router = APIRouter(prefix="/global", tags=["Global Products"])


# ==========================================
# Global Garment Types
# ==========================================

@router.post(
    "/garment-types",
    response_model=GarmentTypeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(400),
    operation_id="createGlobalGarmentType",
)
async def create_global_garment_type(
    data: GarmentTypeCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new global garment type.

    **Auth:** Bearer JWT
    **Permission:** `garment_types.manage_global` (global)
    """
    service = GarmentTypeService(db)

    try:
        garment_type = await service.create_global_garment_type(
            name=data.name,
            description=data.description,
            category=data.category,
            requires_embroidery=data.requires_embroidery,
            has_custom_measurements=data.has_custom_measurements,
            cost_type=data.cost_type,
        )
        await db.commit()
        return GarmentTypeResponse.model_validate(garment_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/garment-types",
    response_model=PaginatedResponse[GarmentTypeWithImages],
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=AUTHENTICATED,
    operation_id="listGlobalGarmentTypes",
)
async def list_global_garment_types(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True)
):
    """
    List all global garment types.

    **Auth:** Bearer JWT (staff)
    **Permission:** `products.view` (global)
    """
    count_query = select(func.count(GarmentType.id)).where(GarmentType.school_id.is_(None))
    if active_only:
        count_query = count_query.where(GarmentType.is_active == True)
    total = (await db.execute(count_query)).scalar_one()

    service = GarmentTypeService(db)
    garment_types = await service.get_all_global_garment_types(active_only=active_only)
    items = []
    for gt in garment_types[skip:skip + limit]:
        # Global garment-type images carry school_id IS NULL (same as gt.school_id).
        relevant = sorted(
            [img for img in (gt.images or []) if img.school_id == gt.school_id],
            key=lambda x: x.display_order,
        )
        primary = next((img for img in relevant if img.is_primary), relevant[0] if relevant else None)
        items.append(GarmentTypeWithImages(
            id=gt.id,
            school_id=gt.school_id,
            name=gt.name,
            description=gt.description,
            category=gt.category,
            requires_embroidery=gt.requires_embroidery,
            has_custom_measurements=gt.has_custom_measurements,
            cost_type=gt.cost_type,
            is_active=gt.is_active,
            created_at=gt.created_at,
            updated_at=gt.updated_at,
            images=[GarmentTypeImageResponse.model_validate(img) for img in relevant],
            primary_image_url=primary.image_url if primary else None,
        ))
    return PaginatedResponse[GarmentTypeWithImages](**paginate(items, total, skip, limit))


@router.get(
    "/garment-types/{garment_type_id}",
    response_model=GarmentTypeResponse,
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=responses(404),
    operation_id="getGlobalGarmentType",
)
async def get_global_garment_type(
    garment_type_id: UUID,
    db: DatabaseSession
):
    """Get global garment type by ID"""
    service = GarmentTypeService(db)
    garment_type = await service.get_global_garment_type(garment_type_id)

    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    return GarmentTypeResponse.model_validate(garment_type)


@router.put(
    "/garment-types/{garment_type_id}",
    response_model=GarmentTypeResponse,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404),
    operation_id="updateGlobalGarmentType",
)
async def update_global_garment_type(
    garment_type_id: UUID,
    data: GarmentTypeUpdate,
    db: DatabaseSession
):
    """
    Update global garment type.

    **Auth:** Bearer JWT
    **Permission:** `garment_types.manage_global` (global)
    """
    service = GarmentTypeService(db)
    update_data = data.model_dump(exclude_unset=True)
    garment_type = await service.update_global_garment_type(garment_type_id, **update_data)

    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    await db.commit()
    return GarmentTypeResponse.model_validate(garment_type)


@router.get(
    "/garment-types/{garment_type_id}/visibility",
    response_model=GlobalGtVisibility,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404),
    operation_id="getGlobalGarmentTypeVisibility",
)
async def get_global_garment_type_visibility(
    garment_type_id: UUID,
    db: DatabaseSession,
):
    """
    Colegios donde este garment_type global esta OCULTO del catalogo publico.

    **Auth:** Bearer JWT
    **Permission:** `garment_types.manage_global` (global)
    """
    service = GarmentTypeService(db)
    gt = await service.get_global_garment_type(garment_type_id)
    if not gt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )
    hidden = await service.get_global_gt_hidden_school_ids(garment_type_id)
    return GlobalGtVisibility(hidden_school_ids=hidden)


@router.put(
    "/garment-types/{garment_type_id}/visibility",
    response_model=GlobalGtVisibility,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404),
    operation_id="setGlobalGarmentTypeVisibility",
)
async def set_global_garment_type_visibility(
    garment_type_id: UUID,
    data: GlobalGtVisibility,
    db: DatabaseSession,
):
    """
    Reemplaza el set de colegios donde este garment_type global esta oculto.

    **Auth:** Bearer JWT
    **Permission:** `garment_types.manage_global` (global)
    """
    service = GarmentTypeService(db)
    gt = await service.get_global_garment_type(garment_type_id)
    if not gt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )
    # Validar que los colegios referenciados existan: evita exclusiones fantasma
    # (o un 500 por FK) cuando el cliente envía IDs arbitrarios.
    if data.hidden_school_ids:
        from app.models.school import School
        distinct_ids = set(data.hidden_school_ids)
        valid_count = (await db.execute(
            select(func.count(School.id)).where(School.id.in_(distinct_ids))
        )).scalar_one()
        if valid_count != len(distinct_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uno o más IDs de colegio no son válidos"
            )
    await service.set_global_gt_hidden_school_ids(garment_type_id, data.hidden_school_ids)
    await db.commit()
    hidden = await service.get_global_gt_hidden_school_ids(garment_type_id)
    return GlobalGtVisibility(hidden_school_ids=hidden)


@router.delete(
    "/garment-types/{garment_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404, 409),
    operation_id="deleteGlobalGarmentType",
)
async def delete_global_garment_type(
    garment_type_id: UUID,
    db: DatabaseSession
):
    """Eliminar tipo de prenda global (soft o hard delete segun historial)"""
    service = GarmentTypeService(db)
    try:
        await service.delete_global_garment_type(garment_type_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )

    await db.commit()


# ==========================================
# Global Garment Type Images
# ==========================================

@router.get(
    "/garment-types/{garment_type_id}/images",
    response_model=list[GarmentTypeImageResponse],
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=responses(404),
    operation_id="listGlobalGarmentTypeImages",
)
async def list_global_garment_type_images(
    garment_type_id: UUID,
    db: DatabaseSession
):
    """List all images for a global garment type"""
    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id.is_(None)
        )
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    result = await db.execute(
        select(GarmentTypeImage)
        .where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
        .order_by(GarmentTypeImage.display_order)
    )
    images = result.scalars().all()

    return [GarmentTypeImageResponse.model_validate(img) for img in images]


@router.post(
    "/garment-types/{garment_type_id}/images",
    response_model=GarmentTypeImageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(400, 404),
    operation_id="uploadGlobalGarmentTypeImage",
)
async def upload_global_garment_type_image(
    garment_type_id: UUID,
    db: DatabaseSession,
    file: UploadFile = File(...)
):
    """
    Upload a new image for a global garment type.

    **Permission:** `garment_types.manage_global` (global)

    - Accepted formats: .jpg, .jpeg, .png, .webp
    - Max file size: 2MB
    - Max 10 images per garment type
    """
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Solo se aceptan: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Imagen muy grande. Tamano maximo: 2MB"
        )

    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id.is_(None)
        )
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    count_result = await db.execute(
        select(func.count(GarmentTypeImage.id)).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= MAX_IMAGES_PER_GARMENT_TYPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximo {MAX_IMAGES_PER_GARMENT_TYPE} imagenes por tipo de prenda"
        )

    upload_dir = UPLOADS_BASE_DIR / "global-garment-types" / str(garment_type_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    timestamp = get_colombia_now_naive().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid_lib.uuid4().hex[:8]
    filename = f"img_{timestamp}_{unique_id}{file_ext}"
    file_path = upload_dir / filename

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar imagen: {str(e)}"
        )

    is_primary = current_count == 0

    max_order_result = await db.execute(
        select(func.max(GarmentTypeImage.display_order)).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    max_order = max_order_result.scalar() or -1
    next_order = max_order + 1

    image_url = f"/uploads/global-garment-types/{garment_type_id}/{filename}"
    new_image = GarmentTypeImage(
        garment_type_id=garment_type_id,
        school_id=None,
        image_url=image_url,
        display_order=next_order,
        is_primary=is_primary
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)

    return GarmentTypeImageResponse.model_validate(new_image)


@router.delete(
    "/garment-types/{garment_type_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404),
    operation_id="deleteGlobalGarmentTypeImage",
)
async def delete_global_garment_type_image(
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Delete a global garment type image (requires `garment_types.manage_global`)."""
    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.id == image_id,
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no encontrada"
        )

    was_primary = image.is_primary

    file_path = UPLOADS_BASE_DIR / image.image_url.lstrip("/uploads/")
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

    await db.delete(image)

    if was_primary:
        next_primary_result = await db.execute(
            select(GarmentTypeImage)
            .where(
                GarmentTypeImage.garment_type_id == garment_type_id,
                GarmentTypeImage.school_id.is_(None)
            )
            .order_by(GarmentTypeImage.display_order)
            .limit(1)
        )
        next_primary = next_primary_result.scalar_one_or_none()
        if next_primary:
            next_primary.is_primary = True

    await db.commit()


@router.put(
    "/garment-types/{garment_type_id}/images/{image_id}/primary",
    response_model=GarmentTypeImageResponse,
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(404),
    operation_id="setGlobalGarmentTypePrimaryImage",
)
async def set_global_primary_image(
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Set an image as the primary for a global garment type (requires `garment_types.manage_global`)."""
    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.id == image_id,
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no encontrada"
        )

    all_images_result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    for img in all_images_result.scalars().all():
        img.is_primary = False

    image.is_primary = True
    await db.commit()
    await db.refresh(image)

    return GarmentTypeImageResponse.model_validate(image)


@router.put(
    "/garment-types/{garment_type_id}/images/reorder",
    response_model=list[GarmentTypeImageResponse],
    dependencies=[Depends(require_global_permission("garment_types.manage_global"))],
    responses=responses(400, 404),
    operation_id="reorderGlobalGarmentTypeImages",
)
async def reorder_global_garment_type_images(
    garment_type_id: UUID,
    reorder_data: GarmentTypeImageReorder,
    db: DatabaseSession
):
    """Reorder images for a global garment type (requires `garment_types.manage_global`)."""
    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id.is_(None)
        )
    )
    if not garment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
    )
    images = {img.id: img for img in result.scalars().all()}

    for img_id in reorder_data.image_ids:
        if img_id not in images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Imagen {img_id} no encontrada"
            )

    for order, img_id in enumerate(reorder_data.image_ids):
        images[img_id].display_order = order

    await db.commit()

    updated_result = await db.execute(
        select(GarmentTypeImage)
        .where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id.is_(None)
        )
        .order_by(GarmentTypeImage.display_order)
    )
    updated_images = updated_result.scalars().all()

    return [GarmentTypeImageResponse.model_validate(img) for img in updated_images]


# ==========================================
# Global Products
# ==========================================

@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("products.create_global"))],
    responses=responses(400),
    operation_id="createGlobalProduct",
)
async def create_global_product(
    data: ProductCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new global product.

    **Auth:** Bearer JWT
    **Permission:** `products.create_global` (global)
    """
    service = ProductService(db)

    try:
        product = await service.create_global_product(
            garment_type_id=data.garment_type_id,
            size=data.size,
            price=data.price,
            name=data.name,
            color=data.color,
            gender=data.gender,
            cost=data.cost,
            description=data.description,
            image_url=data.image_url,
        )
        await db.commit()
        return ProductResponse.model_validate(product)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/products",
    response_model=PaginatedResponse[ProductWithInventory],
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=AUTHENTICATED,
    operation_id="listGlobalProducts",
)
async def list_global_products(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    with_inventory: bool = Query(True),
    with_images: bool = Query(True, description="Include garment type images for catalog display"),
    school_id: UUID | None = Query(
        None,
        description="Si viene, excluye los globales ocultos para ese colegio (catalogo publico). Omitir para gestion interna (ve todos)."
    ),
):
    """
    List all global products with inventory and optionally garment type images.

    **Auth:** Bearer JWT (staff)
    **Permission:** `products.view` (global). El campo `cost` solo se incluye si
    el usuario tiene `inventory.view_cost`. Si `school_id` viene, se filtran los
    globales marcados como ocultos para ese colegio.
    """
    service = ProductService(db)

    count_query = select(func.count(Product.id)).where(
        Product.school_id.is_(None),
        Product.is_active == True
    )
    if school_id is not None:
        from app.models.product import SchoolGlobalGarmentTypeExclusion
        excluded = select(SchoolGlobalGarmentTypeExclusion.global_garment_type_id).where(
            SchoolGlobalGarmentTypeExclusion.school_id == school_id
        )
        count_query = count_query.where(Product.garment_type_id.not_in(excluded))
    total = (await db.execute(count_query)).scalar_one()

    if with_inventory:
        items = await service.get_global_products_with_inventory(
            skip=skip, limit=limit, with_images=with_images, school_id=school_id
        )
    else:
        products = await service.get_all_global_products(skip=skip, limit=limit)
        items = [ProductResponse.model_validate(p) for p in products]

    from app.services.permission import PermissionService
    can_view_cost = await PermissionService(db).has_global_permission(current_user, "inventory.view_cost")
    if not can_view_cost:
        for item in items:
            item.cost = None

    return PaginatedResponse[ProductWithInventory](**paginate(items, total, skip, limit))


@router.get(
    "/products/stats",
    response_model=ProductStatsResponse,
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=AUTHENTICATED,
    operation_id="getGlobalProductsStats",
)
async def get_global_products_stats(
    db: DatabaseSession,
    user_school_ids: UserSchoolIds,
    school_id: UUID | None = Query(None),
    garment_type_id: UUID | None = Query(None),
    scope: Literal["global", "school", "all"] = Query("global"),
):
    """
    Aggregated catalog KPIs (total stock, out-of-stock count, low-stock
    count, products with pending orders, total pending demand).

    Returns counts/sums in two queries — does not load product rows — so
    the dashboard reflects the full catalog regardless of pagination.

    Scope controls which catalog the KPIs cover so the cards can mirror the
    active tab on the Products page:
    - `global` (default): shared products (`school_id IS NULL`).
    - `school`: products summed across every school the user has a role in
      (mirrors `GET /products`; superusers see all schools).
    - `all`: every product.
    An explicit `school_id` always wins and restricts to that single school.

    **Auth:** Bearer JWT (staff)
    **Permission:** `products.view` (global)
    """
    product_filters = [Product.is_active == True]
    if school_id is not None:
        product_filters.append(Product.school_id == school_id)
    elif scope == "school":
        # Sum across the user's accessible schools only. No memberships ->
        # empty catalog (zeros), same short-circuit as GET /products.
        if not user_school_ids:
            return ProductStatsResponse(
                total_products=0,
                total_stock=0,
                out_of_stock_count=0,
                low_stock_count=0,
                with_orders_count=0,
                total_pending_orders=0,
            )
        product_filters.append(Product.school_id.in_(user_school_ids))
    elif scope == "global":
        product_filters.append(Product.school_id.is_(None))
    # scope == "all": no school constraint
    if garment_type_id is not None:
        product_filters.append(Product.garment_type_id == garment_type_id)

    out_of_stock_case = case((func.coalesce(Inventory.quantity, 0) == 0, 1), else_=0)
    low_stock_case = case(
        (
            and_(
                Inventory.quantity > 0,
                Inventory.quantity <= Inventory.min_stock_alert,
            ),
            1,
        ),
        else_=0,
    )

    catalog_row = (
        await db.execute(
            select(
                func.count(Product.id.distinct()).label("total_products"),
                func.coalesce(func.sum(Inventory.quantity), 0).label("total_stock"),
                func.coalesce(func.sum(out_of_stock_case), 0).label("out_of_stock_count"),
                func.coalesce(func.sum(low_stock_case), 0).label("low_stock_count"),
            )
            .select_from(Product)
            .outerjoin(Inventory, Inventory.product_id == Product.id)
            .where(*product_filters)
        )
    ).one()

    pending_statuses = [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION, OrderStatus.READY]
    order_filters = [Order.status.in_(pending_statuses)]
    # If school filter is on Product, also constrain orders to that school
    if school_id is not None:
        order_filters.append(Order.school_id == school_id)

    pending_row = (
        await db.execute(
            select(
                func.count(OrderItem.product_id.distinct()).label("with_orders"),
                func.coalesce(func.sum(OrderItem.quantity), 0).label("total_pending"),
            )
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(*order_filters, *product_filters)
        )
    ).one()

    return ProductStatsResponse(
        total_products=int(catalog_row.total_products or 0),
        total_stock=int(catalog_row.total_stock or 0),
        out_of_stock_count=int(catalog_row.out_of_stock_count or 0),
        low_stock_count=int(catalog_row.low_stock_count or 0),
        with_orders_count=int(pending_row.with_orders or 0),
        total_pending_orders=int(pending_row.total_pending or 0),
    )


@router.get(
    "/products/search",
    response_model=PaginatedResponse[ProductResponse],
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=AUTHENTICATED,
    operation_id="searchGlobalProducts",
)
async def search_global_products(
    db: DatabaseSession,
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50)
):
    """Search global products"""
    service = ProductService(db)
    products = await service.search_global_products(q, skip=skip, limit=limit)
    items = [ProductResponse.model_validate(p) for p in products]
    total = await service.count_global_products_search(q)
    return PaginatedResponse[ProductResponse](**paginate(items, total, skip, limit))


@router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_global_permission("products.view"))],
    responses=responses(404),
    operation_id="getGlobalProduct",
)
async def get_global_product(
    product_id: UUID,
    db: DatabaseSession
):
    """Get global product by ID"""
    service = ProductService(db)
    product = await service.get_global_product(product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto global no encontrado"
        )

    return ProductResponse.model_validate(product)


@router.put(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_global_permission("products.edit_global"))],
    responses=responses(404),
    operation_id="updateGlobalProduct",
)
async def update_global_product(
    product_id: UUID,
    data: ProductUpdate,
    db: DatabaseSession
):
    """
    Update global product.

    **Auth:** Bearer JWT
    **Permission:** `products.edit_global` (global)
    """
    service = ProductService(db)
    update_data = data.model_dump(exclude_unset=True)
    product = await service.update_global_product(product_id, **update_data)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto global no encontrado"
        )

    await db.commit()
    return ProductResponse.model_validate(product)


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_global_permission("products.delete_global"))],
    responses=responses(404, 409),
    operation_id="deleteGlobalProduct",
)
async def delete_global_product(
    product_id: UUID,
    db: DatabaseSession
):
    """Eliminar producto global (soft o hard delete segun historial)"""
    service = ProductService(db)
    try:
        await service.delete_global_product(product_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )

    await db.commit()


# ==========================================
# Global Inventory
# ==========================================

@router.post(
    "/products/{product_id}/inventory",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))],
    responses=responses(400, 404),
    operation_id="createGlobalInventory",
)
async def create_global_inventory(
    product_id: UUID,
    data: InventoryCreate,
    db: DatabaseSession
):
    """
    Create inventory for global product.

    **Auth:** Bearer JWT (staff)
    **Permission:** `global_inventory.adjust` (global)
    """
    data.product_id = product_id
    data.school_id = None

    service = InventoryService(db)

    try:
        inventory = await service.create_inventory(data)
        await db.commit()
        return InventoryResponse.model_validate(inventory)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/products/{product_id}/inventory",
    response_model=InventoryResponse,
    responses=responses(404),
    dependencies=[Depends(require_global_permission("products.view"))],
    operation_id="getGlobalInventory",
)
async def get_global_inventory(
    product_id: UUID,
    db: DatabaseSession
):
    """
    Get inventory for global product.

    **Auth:** Bearer JWT (staff)
    **Permission:** `products.view` (global)
    """
    service = InventoryService(db)
    inventory = await service.get_by_product(product_id, school_id=None)

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventario no encontrado para este producto"
        )

    return InventoryResponse.model_validate(inventory)


@router.put(
    "/products/{product_id}/inventory",
    response_model=InventoryResponse,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))],
    responses=responses(404),
    operation_id="updateGlobalInventory",
)
async def update_global_inventory(
    product_id: UUID,
    data: InventoryUpdate,
    db: DatabaseSession
):
    """
    Update inventory for global product.

    **Auth:** Bearer JWT (staff)
    **Permission:** `global_inventory.adjust` (global)
    """
    service = InventoryService(db)
    inventory = await service.get_by_product(product_id, school_id=None)

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventario no encontrado para este producto"
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(inventory, field, value)
    await db.commit()
    await db.refresh(inventory)
    return InventoryResponse.model_validate(inventory)


@router.post(
    "/products/{product_id}/inventory/adjust",
    response_model=InventoryResponse,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))],
    responses=responses(400, 404),
    operation_id="adjustGlobalInventory",
)
async def adjust_global_inventory(
    product_id: UUID,
    data: InventoryAdjust,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Adjust global inventory quantity.

    **Auth:** Bearer JWT (staff)
    **Permission:** `global_inventory.adjust` (global)
    """
    service = InventoryService(db)

    try:
        inventory = await service.adjust_quantity(
            product_id, school_id=None, adjust_data=data, created_by=current_user.id
        )
        await db.commit()
        return InventoryResponse.model_validate(inventory)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/inventory/low-stock",
    response_model=PaginatedResponse[InventoryResponse],
    responses=AUTHENTICATED,
    dependencies=[Depends(require_global_permission("products.view"))],
    operation_id="getGlobalLowStock",
)
async def get_low_stock_global(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get global products with low stock.

    **Auth:** Bearer JWT (staff)
    **Permission:** `products.view` (global)
    """
    service = InventoryService(db)

    total = (await db.execute(
        select(func.count(Inventory.id)).where(
            Inventory.school_id.is_(None),
            Inventory.quantity > 0,
            Inventory.quantity <= Inventory.min_stock_alert
        )
    )).scalar_one()

    low_stock = await service.get_global_low_stock(limit=limit)
    items = [InventoryResponse.model_validate(inv) for inv in low_stock]
    return PaginatedResponse[InventoryResponse](**paginate(items, total, skip, limit))
