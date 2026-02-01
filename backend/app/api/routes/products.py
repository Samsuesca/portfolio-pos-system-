"""
Product and GarmentType Endpoints

Two types of endpoints:
1. Multi-school: /products - Lists data from ALL schools user has access to
2. School-specific: /schools/{school_id}/products - Original endpoints for specific school
"""
from uuid import UUID
from pathlib import Path
from datetime import datetime
import shutil
import uuid as uuid_lib
from app.utils.timezone import get_colombia_now_naive

from fastapi import APIRouter, HTTPException, status, Query, Depends, UploadFile, File
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload, joinedload

from app.api.dependencies import DatabaseSession, CurrentUser, require_school_access, UserSchoolIds
from app.models.user import UserRole
from app.models.product import Product, GarmentType, GarmentTypeImage, Inventory
from app.models.order import OrderItem, Order, OrderStatus, OrderItemStatus
from app.models.school import School
from app.schemas.product import (
    GarmentTypeCreate, GarmentTypeUpdate, GarmentTypeResponse,
    GarmentTypeImageResponse, GarmentTypeImageReorder, GarmentTypeWithImages,
    ProductCreate, ProductUpdate, ProductResponse, ProductWithInventory,
    ProductListResponse
)
from app.services.product import GarmentTypeService, ProductService

# Constants for image uploads
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB
MAX_IMAGES_PER_GARMENT_TYPE = 10
UPLOADS_BASE_DIR = Path("/var/www/uniformes-system-v2/uploads")


# =============================================================================
# Multi-School Products Router (lists from ALL user's schools)
# =============================================================================
router = APIRouter(tags=["Products"])


@router.get(
    "/products",
    response_model=list[ProductListResponse],
    summary="List products from all schools"
)
async def list_all_products(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    school_id: UUID | None = Query(None, description="Filter by specific school"),
    garment_type_id: UUID | None = Query(None, description="Filter by garment type"),
    search: str | None = Query(None, description="Search by code or name"),
    active_only: bool = Query(True, description="Only active products"),
    with_stock: bool = Query(False, description="Include stock quantity"),
    with_images: bool = Query(False, description="Include garment type images"),
    missing_cost: bool = Query(False, description="Only products without cost (cost IS NULL or cost = 0)")
):
    """
    List products from ALL schools the user has access to.

    Supports filtering by:
    - school_id: Specific school (optional)
    - garment_type_id: Specific garment type (optional)
    - search: Search in product code or name
    - active_only: Filter only active products
    - with_stock: Include current stock quantity
    - with_images: Include garment type images for catalog display
    """
    if not user_school_ids:
        return []

    # Build query options - avoid loader strategy conflict
    # When with_images=True, use selectinload for garment_type (to chain images)
    # When with_images=False, use joinedload for garment_type (faster for simple cases)
    if with_images:
        query_options = [
            selectinload(Product.garment_type).selectinload(GarmentType.images),
            joinedload(Product.school)
        ]
    else:
        query_options = [
            joinedload(Product.garment_type),
            joinedload(Product.school)
        ]

    query = (
        select(Product)
        .options(*query_options)
        .where(Product.school_id.in_(user_school_ids))
        .order_by(Product.name)
    )

    # Apply filters
    if school_id:
        if school_id not in user_school_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        query = query.where(Product.school_id == school_id)

    if garment_type_id:
        query = query.where(Product.garment_type_id == garment_type_id)

    if active_only:
        query = query.where(Product.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Product.code.ilike(search_term),
                Product.name.ilike(search_term)
            )
        )

    if missing_cost:
        query = query.where(
            or_(
                Product.cost.is_(None),
                Product.cost == 0
            )
        )

    # Pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    products = result.unique().scalars().all()

    # If with_stock, get inventory data
    stock_map = {}
    min_stock_map = {}
    if with_stock and products:
        product_ids = [p.id for p in products]
        inv_result = await db.execute(
            select(Inventory).where(Inventory.product_id.in_(product_ids))
        )
        for inv in inv_result.scalars().all():
            stock_map[inv.product_id] = inv.quantity
            min_stock_map[inv.product_id] = inv.min_stock_alert

    # Get pending orders information for each product
    # Match by garment_type + size + color (not product_id) because web orders
    # don't have product_id assigned until approved
    pending_orders_map = {}
    if products:
        # Only count items that are truly pending (not yet fulfilled from stock)
        # PENDING = not yet processed
        # IN_PRODUCTION = being made (no stock available)
        # READY/DELIVERED = already fulfilled, should NOT count
        pending_item_statuses = [OrderItemStatus.PENDING, OrderItemStatus.IN_PRODUCTION]

        # For each product, find matching order items by garment_type + size + color
        for product in products:
            # Build query to find matching order items in same school
            matching_query = await db.execute(
                select(
                    func.sum(OrderItem.quantity).label('total_qty'),
                    func.count(func.distinct(OrderItem.order_id)).label('order_count')
                )
                .join(Order, OrderItem.order_id == Order.id)
                .where(
                    Order.school_id == product.school_id,
                    OrderItem.garment_type_id == product.garment_type_id,
                    OrderItem.item_status.in_(pending_item_statuses),
                    # Match size (handle NULL)
                    or_(
                        OrderItem.size == product.size,
                        (OrderItem.size.is_(None)) & (product.size is None)
                    ),
                    # Match color (handle NULL)
                    or_(
                        OrderItem.color == product.color,
                        (OrderItem.color.is_(None)) & (product.color is None)
                    )
                )
            )
            row = matching_query.first()
            if row and (row.total_qty or 0) > 0:
                pending_orders_map[product.id] = {
                    'qty': int(row.total_qty or 0),
                    'count': int(row.order_count or 0)
                }

    # Build responses
    responses = []
    for product in products:
        # Get images for this garment type if requested
        images = []
        primary_image_url = None
        if with_images and product.garment_type:
            # Filter images by school_id (since images are per-school)
            garment_images = [
                img for img in (product.garment_type.images or [])
                if img.school_id == product.school_id
            ]
            # Sort by display_order
            garment_images.sort(key=lambda x: x.display_order)
            images = [
                GarmentTypeImageResponse.model_validate(img)
                for img in garment_images
            ]
            # Find primary image
            primary = next((img for img in garment_images if img.is_primary), None)
            if primary:
                primary_image_url = primary.image_url
            elif garment_images:
                primary_image_url = garment_images[0].image_url

        responses.append(ProductListResponse(
            id=product.id,
            code=product.code,
            name=product.name,
            size=product.size,
            color=product.color,
            gender=product.gender,
            price=product.price,
            is_active=product.is_active,
            garment_type_id=product.garment_type_id,
            garment_type_name=product.garment_type.name if product.garment_type else None,
            school_id=product.school_id,
            school_name=product.school.name if product.school else None,
            stock=stock_map.get(product.id, 0) if with_stock else None,
            min_stock=min_stock_map.get(product.id, 5) if with_stock else None,
            pending_orders_qty=pending_orders_map.get(product.id, {}).get('qty', 0),
            pending_orders_count=pending_orders_map.get(product.id, {}).get('count', 0),
            garment_type_images=images if with_images else [],
            garment_type_primary_image_url=primary_image_url
        ))

    return responses


@router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="Get product by ID (from any accessible school)"
)
async def get_product_global(
    product_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """Get a specific product by ID from any school the user has access to."""
    result = await db.execute(
        select(Product)
        .options(joinedload(Product.garment_type))
        .where(
            Product.id == product_id,
            Product.school_id.in_(user_school_ids)
        )
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    return ProductResponse.model_validate(product)


@router.get(
    "/garment-types",
    response_model=list[GarmentTypeWithImages],
    summary="List garment types from all schools"
)
async def list_all_garment_types(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    school_id: UUID | None = Query(None, description="Filter by specific school"),
    active_only: bool = Query(True, description="Only active garment types"),
    with_images: bool = Query(True, description="Include images for each garment type")
):
    """
    List garment types from ALL schools the user has access to.
    Includes images by default for display purposes.
    """
    if not user_school_ids:
        return []

    query_options = []
    if with_images:
        query_options.append(selectinload(GarmentType.images))

    query = select(GarmentType)
    if query_options:
        query = query.options(*query_options)
    query = query.where(GarmentType.school_id.in_(user_school_ids)).order_by(GarmentType.name)

    if school_id:
        if school_id not in user_school_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this school"
            )
        query = query.where(GarmentType.school_id == school_id)

    if active_only:
        query = query.where(GarmentType.is_active == True)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    garment_types = result.unique().scalars().all()

    # Build response with images
    responses = []
    for gt in garment_types:
        # Get images for this garment type (filter by school_id since images are per-school)
        gt_images = []
        primary_image_url = None
        if with_images and gt.images:
            # Filter images that belong to this garment type's school
            relevant_images = [img for img in gt.images if img.school_id == gt.school_id]
            relevant_images.sort(key=lambda x: x.display_order)
            gt_images = [GarmentTypeImageResponse.model_validate(img) for img in relevant_images]
            # Find primary image
            primary = next((img for img in relevant_images if img.is_primary), None)
            if primary:
                primary_image_url = primary.image_url
            elif relevant_images:
                primary_image_url = relevant_images[0].image_url

        response = GarmentTypeWithImages(
            id=gt.id,
            school_id=gt.school_id,
            name=gt.name,
            description=gt.description,
            category=gt.category,
            requires_embroidery=gt.requires_embroidery,
            has_custom_measurements=gt.has_custom_measurements,
            is_active=gt.is_active,
            created_at=gt.created_at,
            updated_at=gt.updated_at,
            images=gt_images,
            primary_image_url=primary_image_url
        )
        responses.append(response)

    return responses


# =============================================================================
# School-Specific Products Router (original endpoints)
# =============================================================================
school_router = APIRouter(prefix="/schools/{school_id}", tags=["Products"])


# ==========================================
# Garment Types
# ==========================================

@school_router.post(
    "/garment-types",
    response_model=GarmentTypeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_garment_type(
    school_id: UUID,
    garment_data: GarmentTypeCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Create a new garment type (requires ADMIN role)"""
    # Ensure school_id matches
    garment_data.school_id = school_id

    garment_service = GarmentTypeService(db)

    try:
        garment = await garment_service.create_garment_type(garment_data)
        await db.commit()
        return GarmentTypeResponse.model_validate(garment)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/garment-types",
    response_model=list[GarmentTypeResponse],
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def list_garment_types_for_school(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True)
):
    """List garment types for a specific school"""
    garment_service = GarmentTypeService(db)

    if active_only:
        garments = await garment_service.get_active_garment_types(
            school_id, skip=skip, limit=limit
        )
    else:
        garments = await garment_service.get_multi(
            school_id=school_id, skip=skip, limit=limit
        )

    return [GarmentTypeResponse.model_validate(g) for g in garments]


@school_router.put(
    "/garment-types/{garment_type_id}",
    response_model=GarmentTypeResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def update_garment_type(
    school_id: UUID,
    garment_type_id: UUID,
    garment_data: GarmentTypeUpdate,
    db: DatabaseSession
):
    """Update garment type for school (requires ADMIN role)"""
    garment_service = GarmentTypeService(db)
    garment_type = await garment_service.update_garment_type(
        garment_type_id,
        school_id,
        garment_data
    )

    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Garment type not found"
        )

    await db.commit()
    return GarmentTypeResponse.model_validate(garment_type)


# ==========================================
# Garment Type Images
# ==========================================

@school_router.get(
    "/garment-types/{garment_type_id}/images",
    response_model=list[GarmentTypeImageResponse],
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def list_garment_type_images(
    school_id: UUID,
    garment_type_id: UUID,
    db: DatabaseSession
):
    """List all images for a garment type"""
    # Verify garment type exists and belongs to school
    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id == school_id
        )
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda no encontrado"
        )

    # Get images
    result = await db.execute(
        select(GarmentTypeImage)
        .where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
        .order_by(GarmentTypeImage.display_order)
    )
    images = result.scalars().all()

    return [GarmentTypeImageResponse.model_validate(img) for img in images]


@school_router.post(
    "/garment-types/{garment_type_id}/images",
    response_model=GarmentTypeImageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def upload_garment_type_image(
    school_id: UUID,
    garment_type_id: UUID,
    db: DatabaseSession,
    file: UploadFile = File(...)
):
    """
    Upload a new image for a garment type.

    - Accepted formats: .jpg, .jpeg, .png, .webp
    - Max file size: 2MB
    - Max 10 images per garment type
    """
    # Validate file extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Solo se aceptan: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Validate file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Imagen muy grande. Tamano maximo: 2MB"
        )

    # Verify garment type exists and belongs to school
    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id == school_id
        )
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda no encontrado"
        )

    # Check max images limit
    count_result = await db.execute(
        select(func.count(GarmentTypeImage.id)).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= MAX_IMAGES_PER_GARMENT_TYPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximo {MAX_IMAGES_PER_GARMENT_TYPE} imagenes por tipo de prenda"
        )

    # Create upload directory
    upload_dir = UPLOADS_BASE_DIR / "garment-types" / str(school_id) / str(garment_type_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    timestamp = get_colombia_now_naive().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid_lib.uuid4().hex[:8]
    filename = f"img_{timestamp}_{unique_id}{file_ext}"
    file_path = upload_dir / filename

    # Save file
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar imagen: {str(e)}"
        )

    # Determine if this should be primary (first image is primary by default)
    is_primary = current_count == 0

    # Get next display order
    max_order_result = await db.execute(
        select(func.max(GarmentTypeImage.display_order)).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    max_order = max_order_result.scalar() or -1
    next_order = max_order + 1

    # Create database record
    image_url = f"/uploads/garment-types/{school_id}/{garment_type_id}/{filename}"
    new_image = GarmentTypeImage(
        garment_type_id=garment_type_id,
        school_id=school_id,
        image_url=image_url,
        display_order=next_order,
        is_primary=is_primary
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)

    return GarmentTypeImageResponse.model_validate(new_image)


@school_router.delete(
    "/garment-types/{garment_type_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def delete_garment_type_image(
    school_id: UUID,
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Delete a garment type image"""
    # Find the image
    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.id == image_id,
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no encontrada"
        )

    was_primary = image.is_primary

    # Delete file from filesystem
    file_path = UPLOADS_BASE_DIR / image.image_url.lstrip("/uploads/")
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass  # Ignore file deletion errors

    # Delete database record
    await db.delete(image)

    # If deleted image was primary, set next image as primary
    if was_primary:
        next_primary_result = await db.execute(
            select(GarmentTypeImage)
            .where(
                GarmentTypeImage.garment_type_id == garment_type_id,
                GarmentTypeImage.school_id == school_id
            )
            .order_by(GarmentTypeImage.display_order)
            .limit(1)
        )
        next_primary = next_primary_result.scalar_one_or_none()
        if next_primary:
            next_primary.is_primary = True

    await db.commit()


@school_router.put(
    "/garment-types/{garment_type_id}/images/{image_id}/primary",
    response_model=GarmentTypeImageResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def set_primary_image(
    school_id: UUID,
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Set an image as the primary image for the garment type"""
    # Find the image
    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.id == image_id,
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no encontrada"
        )

    # Remove primary from all other images
    await db.execute(
        select(GarmentTypeImage)
        .where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id,
            GarmentTypeImage.is_primary == True
        )
    )
    # Update all images to not be primary
    all_images_result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    for img in all_images_result.scalars().all():
        img.is_primary = False

    # Set this image as primary
    image.is_primary = True
    await db.commit()
    await db.refresh(image)

    return GarmentTypeImageResponse.model_validate(image)


@school_router.put(
    "/garment-types/{garment_type_id}/images/reorder",
    response_model=list[GarmentTypeImageResponse],
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def reorder_garment_type_images(
    school_id: UUID,
    garment_type_id: UUID,
    reorder_data: GarmentTypeImageReorder,
    db: DatabaseSession
):
    """Reorder images for a garment type"""
    # Verify garment type exists
    garment_result = await db.execute(
        select(GarmentType).where(
            GarmentType.id == garment_type_id,
            GarmentType.school_id == school_id
        )
    )
    if not garment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda no encontrado"
        )

    # Get all images
    result = await db.execute(
        select(GarmentTypeImage).where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
    )
    images = {img.id: img for img in result.scalars().all()}

    # Validate all IDs are present
    for img_id in reorder_data.image_ids:
        if img_id not in images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Imagen {img_id} no encontrada"
            )

    # Update display order
    for order, img_id in enumerate(reorder_data.image_ids):
        images[img_id].display_order = order

    await db.commit()

    # Return updated images in new order
    updated_result = await db.execute(
        select(GarmentTypeImage)
        .where(
            GarmentTypeImage.garment_type_id == garment_type_id,
            GarmentTypeImage.school_id == school_id
        )
        .order_by(GarmentTypeImage.display_order)
    )
    updated_images = updated_result.scalars().all()

    return [GarmentTypeImageResponse.model_validate(img) for img in updated_images]


# ==========================================
# Products
# ==========================================

@school_router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def create_product(
    school_id: UUID,
    product_data: ProductCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Create a new product (requires ADMIN role)"""
    from sqlalchemy.exc import IntegrityError

    # Ensure school_id matches
    product_data.school_id = school_id

    product_service = ProductService(db)

    try:
        product = await product_service.create_product(product_data)
        await db.commit()
        return ProductResponse.model_validate(product)

    except IntegrityError as e:
        await db.rollback()
        # Handle FK constraint violations (e.g., invalid garment_type_id)
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if "garment_type_id" in error_msg.lower() or "fkey" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de prenda no válido o no encontrado"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad de datos"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@school_router.get(
    "/products",
    response_model=list[ProductWithInventory],  # Changed to support inventory fields
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def list_products_for_school(
    school_id: UUID,
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    active_only: bool = Query(True),
    with_inventory: bool = Query(False)
):
    """List products for school"""
    product_service = ProductService(db)

    if with_inventory:
        products = await product_service.get_products_with_inventory(
            school_id, skip=skip, limit=limit
        )
        return products
    else:
        if active_only:
            products = await product_service.get_active_products(
                school_id, skip=skip, limit=limit
            )
        else:
            products = await product_service.get_multi(
                school_id=school_id, skip=skip, limit=limit
            )

        return [ProductResponse.model_validate(p) for p in products]


@school_router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def get_product_for_school(
    school_id: UUID,
    product_id: UUID,
    db: DatabaseSession
):
    """Get product by ID for a specific school"""
    product_service = ProductService(db)
    product = await product_service.get(product_id, school_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    return ProductResponse.model_validate(product)


@school_router.put(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_school_access(UserRole.ADMIN))]
)
async def update_product(
    school_id: UUID,
    product_id: UUID,
    product_data: ProductUpdate,
    db: DatabaseSession
):
    """Update product (requires ADMIN role)"""
    product_service = ProductService(db)
    product = await product_service.update_product(
        product_id, school_id, product_data
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    await db.commit()
    return ProductResponse.model_validate(product)


@school_router.get(
    "/products/search/by-term",
    response_model=list[ProductResponse],
    dependencies=[Depends(require_school_access(UserRole.VIEWER))]
)
async def search_products(
    school_id: UUID,
    q: str = Query(..., min_length=1, description="Search term"),
    db: DatabaseSession = None,
    limit: int = Query(20, ge=1, le=50)
):
    """Search products by code, name, size, or color"""
    product_service = ProductService(db)
    products = await product_service.search_products(
        school_id, q, limit=limit
    )

    return [ProductResponse.model_validate(p) for p in products]


# =============================================================================
# Bulk Cost Update Endpoint
# =============================================================================

from pydantic import BaseModel, Field
from typing import List
from decimal import Decimal


class ProductCostUpdate(BaseModel):
    """Single product cost update item"""
    product_id: UUID
    cost: Decimal = Field(gt=0, description="New cost value, must be positive")


class BulkCostUpdateRequest(BaseModel):
    """Request body for bulk cost update"""
    updates: List[ProductCostUpdate] = Field(min_length=1, max_length=100)


class BulkCostUpdateResult(BaseModel):
    """Result of bulk cost update"""
    updated: int
    failed: int
    errors: List[str]


@router.patch(
    "/products/bulk-update-costs",
    response_model=BulkCostUpdateResult,
    summary="Bulk update product costs"
)
async def bulk_update_product_costs(
    request: BulkCostUpdateRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: UserSchoolIds
):
    """
    Update costs for multiple products at once.

    Only updates products that belong to schools the user has access to.
    Returns count of successful and failed updates.
    """
    updated = 0
    failed = 0
    errors: list[str] = []

    # Get all products in one query
    product_ids = [u.product_id for u in request.updates]
    result = await db.execute(
        select(Product).where(
            Product.id.in_(product_ids),
            Product.school_id.in_(user_school_ids)
        )
    )
    products_map = {p.id: p for p in result.scalars().all()}

    for update in request.updates:
        product = products_map.get(update.product_id)
        if not product:
            failed += 1
            errors.append(f"Product {update.product_id} not found or no access")
            continue

        try:
            product.cost = update.cost
            updated += 1
        except Exception as e:
            failed += 1
            errors.append(f"Failed to update {update.product_id}: {str(e)}")

    await db.commit()

    return BulkCostUpdateResult(
        updated=updated,
        failed=failed,
        errors=errors[:10]  # Limit errors to avoid large responses
    )
