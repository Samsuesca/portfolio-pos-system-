"""
Global Product Endpoints - Shared products across all schools
"""
from uuid import UUID
from pathlib import Path
from datetime import datetime
import shutil
import uuid as uuid_lib
from app.utils.timezone import get_colombia_now_naive

from fastapi import APIRouter, HTTPException, status, Query, Depends, UploadFile, File
from sqlalchemy import select, func

from app.api.dependencies import DatabaseSession, CurrentUser, require_superuser, require_global_permission
from app.models.product import GlobalGarmentType, GlobalGarmentTypeImage
from app.schemas.product import (
    GlobalGarmentTypeCreate, GlobalGarmentTypeUpdate, GlobalGarmentTypeResponse,
    GlobalGarmentTypeImageResponse, GlobalGarmentTypeImageReorder,
    GlobalProductCreate, GlobalProductUpdate, GlobalProductResponse,
    GlobalProductWithInventory,
    GlobalInventoryCreate, GlobalInventoryUpdate, GlobalInventoryAdjust,
    GlobalInventoryResponse
)
from app.services.global_product import (
    GlobalGarmentTypeService,
    GlobalProductService,
    GlobalInventoryService
)

# Constants for image uploads
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB
MAX_IMAGES_PER_GARMENT_TYPE = 10
UPLOADS_BASE_DIR = Path("/var/www/uniformes-system-v2/uploads")

router = APIRouter(prefix="/global", tags=["Global Products"])


# ==========================================
# Global Garment Types
# ==========================================

@router.post(
    "/garment-types",
    response_model=GlobalGarmentTypeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_superuser)]
)
async def create_global_garment_type(
    data: GlobalGarmentTypeCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Create a new global garment type (superuser only)"""
    service = GlobalGarmentTypeService(db)

    try:
        garment_type = await service.create(data)
        await db.commit()
        return GlobalGarmentTypeResponse.model_validate(garment_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/garment-types",
    response_model=list[GlobalGarmentTypeResponse]
)
async def list_global_garment_types(
    db: DatabaseSession,
    active_only: bool = Query(True)
):
    """List all global garment types"""
    service = GlobalGarmentTypeService(db)
    garment_types = await service.get_all(active_only=active_only)
    return [GlobalGarmentTypeResponse.model_validate(gt) for gt in garment_types]


@router.get(
    "/garment-types/{garment_type_id}",
    response_model=GlobalGarmentTypeResponse
)
async def get_global_garment_type(
    garment_type_id: UUID,
    db: DatabaseSession
):
    """Get global garment type by ID"""
    service = GlobalGarmentTypeService(db)
    garment_type = await service.get(garment_type_id)

    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global garment type not found"
        )

    return GlobalGarmentTypeResponse.model_validate(garment_type)


@router.put(
    "/garment-types/{garment_type_id}",
    response_model=GlobalGarmentTypeResponse,
    dependencies=[Depends(require_superuser)]
)
async def update_global_garment_type(
    garment_type_id: UUID,
    data: GlobalGarmentTypeUpdate,
    db: DatabaseSession
):
    """Update global garment type (superuser only)"""
    service = GlobalGarmentTypeService(db)
    garment_type = await service.update(garment_type_id, data)

    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global garment type not found"
        )

    await db.commit()
    return GlobalGarmentTypeResponse.model_validate(garment_type)


# ==========================================
# Global Garment Type Images
# ==========================================

@router.get(
    "/garment-types/{garment_type_id}/images",
    response_model=list[GlobalGarmentTypeImageResponse]
)
async def list_global_garment_type_images(
    garment_type_id: UUID,
    db: DatabaseSession
):
    """List all images for a global garment type"""
    # Verify garment type exists
    garment_result = await db.execute(
        select(GlobalGarmentType).where(GlobalGarmentType.id == garment_type_id)
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    # Get images
    result = await db.execute(
        select(GlobalGarmentTypeImage)
        .where(GlobalGarmentTypeImage.garment_type_id == garment_type_id)
        .order_by(GlobalGarmentTypeImage.display_order)
    )
    images = result.scalars().all()

    return [GlobalGarmentTypeImageResponse.model_validate(img) for img in images]


@router.post(
    "/garment-types/{garment_type_id}/images",
    response_model=GlobalGarmentTypeImageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_superuser)]
)
async def upload_global_garment_type_image(
    garment_type_id: UUID,
    db: DatabaseSession,
    file: UploadFile = File(...)
):
    """
    Upload a new image for a global garment type (superuser only).

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

    # Verify garment type exists
    garment_result = await db.execute(
        select(GlobalGarmentType).where(GlobalGarmentType.id == garment_type_id)
    )
    garment_type = garment_result.scalar_one_or_none()
    if not garment_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    # Check max images limit
    count_result = await db.execute(
        select(func.count(GlobalGarmentTypeImage.id)).where(
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= MAX_IMAGES_PER_GARMENT_TYPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximo {MAX_IMAGES_PER_GARMENT_TYPE} imagenes por tipo de prenda"
        )

    # Create upload directory
    upload_dir = UPLOADS_BASE_DIR / "global-garment-types" / str(garment_type_id)
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
        select(func.max(GlobalGarmentTypeImage.display_order)).where(
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
        )
    )
    max_order = max_order_result.scalar() or -1
    next_order = max_order + 1

    # Create database record
    image_url = f"/uploads/global-garment-types/{garment_type_id}/{filename}"
    new_image = GlobalGarmentTypeImage(
        garment_type_id=garment_type_id,
        image_url=image_url,
        display_order=next_order,
        is_primary=is_primary
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)

    return GlobalGarmentTypeImageResponse.model_validate(new_image)


@router.delete(
    "/garment-types/{garment_type_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_superuser)]
)
async def delete_global_garment_type_image(
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Delete a global garment type image (superuser only)"""
    # Find the image
    result = await db.execute(
        select(GlobalGarmentTypeImage).where(
            GlobalGarmentTypeImage.id == image_id,
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
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
            select(GlobalGarmentTypeImage)
            .where(GlobalGarmentTypeImage.garment_type_id == garment_type_id)
            .order_by(GlobalGarmentTypeImage.display_order)
            .limit(1)
        )
        next_primary = next_primary_result.scalar_one_or_none()
        if next_primary:
            next_primary.is_primary = True

    await db.commit()


@router.put(
    "/garment-types/{garment_type_id}/images/{image_id}/primary",
    response_model=GlobalGarmentTypeImageResponse,
    dependencies=[Depends(require_superuser)]
)
async def set_global_primary_image(
    garment_type_id: UUID,
    image_id: UUID,
    db: DatabaseSession
):
    """Set an image as the primary image for a global garment type (superuser only)"""
    # Find the image
    result = await db.execute(
        select(GlobalGarmentTypeImage).where(
            GlobalGarmentTypeImage.id == image_id,
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no encontrada"
        )

    # Update all images to not be primary
    all_images_result = await db.execute(
        select(GlobalGarmentTypeImage).where(
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
        )
    )
    for img in all_images_result.scalars().all():
        img.is_primary = False

    # Set this image as primary
    image.is_primary = True
    await db.commit()
    await db.refresh(image)

    return GlobalGarmentTypeImageResponse.model_validate(image)


@router.put(
    "/garment-types/{garment_type_id}/images/reorder",
    response_model=list[GlobalGarmentTypeImageResponse],
    dependencies=[Depends(require_superuser)]
)
async def reorder_global_garment_type_images(
    garment_type_id: UUID,
    reorder_data: GlobalGarmentTypeImageReorder,
    db: DatabaseSession
):
    """Reorder images for a global garment type (superuser only)"""
    # Verify garment type exists
    garment_result = await db.execute(
        select(GlobalGarmentType).where(GlobalGarmentType.id == garment_type_id)
    )
    if not garment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de prenda global no encontrado"
        )

    # Get all images
    result = await db.execute(
        select(GlobalGarmentTypeImage).where(
            GlobalGarmentTypeImage.garment_type_id == garment_type_id
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
        select(GlobalGarmentTypeImage)
        .where(GlobalGarmentTypeImage.garment_type_id == garment_type_id)
        .order_by(GlobalGarmentTypeImage.display_order)
    )
    updated_images = updated_result.scalars().all()

    return [GlobalGarmentTypeImageResponse.model_validate(img) for img in updated_images]


# ==========================================
# Global Products
# ==========================================

@router.post(
    "/products",
    response_model=GlobalProductResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_superuser)]
)
async def create_global_product(
    data: GlobalProductCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Create a new global product (superuser only)"""
    service = GlobalProductService(db)

    try:
        product = await service.create(data)
        await db.commit()
        return GlobalProductResponse.model_validate(product)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/products",
    response_model=list[GlobalProductWithInventory]
)
async def list_global_products(
    db: DatabaseSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    with_inventory: bool = Query(True),
    with_images: bool = Query(True, description="Include garment type images for catalog display")
):
    """List all global products with inventory and optionally garment type images"""
    service = GlobalProductService(db)

    if with_inventory:
        return await service.get_with_inventory(skip=skip, limit=limit, with_images=with_images)
    else:
        products = await service.get_all(skip=skip, limit=limit)
        return [GlobalProductResponse.model_validate(p) for p in products]


@router.get(
    "/products/search",
    response_model=list[GlobalProductResponse]
)
async def search_global_products(
    q: str = Query(..., min_length=1),
    db: DatabaseSession = None,
    limit: int = Query(20, ge=1, le=50)
):
    """Search global products"""
    service = GlobalProductService(db)
    products = await service.search(q, limit=limit)
    return [GlobalProductResponse.model_validate(p) for p in products]


@router.get(
    "/products/{product_id}",
    response_model=GlobalProductResponse
)
async def get_global_product(
    product_id: UUID,
    db: DatabaseSession
):
    """Get global product by ID"""
    service = GlobalProductService(db)
    product = await service.get(product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global product not found"
        )

    return GlobalProductResponse.model_validate(product)


@router.put(
    "/products/{product_id}",
    response_model=GlobalProductResponse,
    dependencies=[Depends(require_superuser)]
)
async def update_global_product(
    product_id: UUID,
    data: GlobalProductUpdate,
    db: DatabaseSession
):
    """Update global product (superuser only)"""
    service = GlobalProductService(db)
    product = await service.update(product_id, data)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Global product not found"
        )

    await db.commit()
    return GlobalProductResponse.model_validate(product)


# ==========================================
# Global Inventory
# ==========================================

@router.post(
    "/products/{product_id}/inventory",
    response_model=GlobalInventoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))]
)
async def create_global_inventory(
    product_id: UUID,
    data: GlobalInventoryCreate,
    db: DatabaseSession
):
    """Create inventory for global product (requires global_inventory.adjust permission)"""
    # Ensure product_id matches
    data.product_id = product_id

    service = GlobalInventoryService(db)

    try:
        inventory = await service.create(data)
        await db.commit()
        return GlobalInventoryResponse.model_validate(inventory)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/products/{product_id}/inventory",
    response_model=GlobalInventoryResponse
)
async def get_global_inventory(
    product_id: UUID,
    db: DatabaseSession
):
    """Get inventory for global product"""
    service = GlobalInventoryService(db)
    inventory = await service.get_by_product(product_id)

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found for this product"
        )

    return GlobalInventoryResponse.model_validate(inventory)


@router.put(
    "/products/{product_id}/inventory",
    response_model=GlobalInventoryResponse,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))]
)
async def update_global_inventory(
    product_id: UUID,
    data: GlobalInventoryUpdate,
    db: DatabaseSession
):
    """Update inventory for global product (requires global_inventory.adjust permission)"""
    service = GlobalInventoryService(db)
    inventory = await service.update(product_id, data)

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found for this product"
        )

    await db.commit()
    return GlobalInventoryResponse.model_validate(inventory)


@router.post(
    "/products/{product_id}/inventory/adjust",
    response_model=GlobalInventoryResponse,
    dependencies=[Depends(require_global_permission("global_inventory.adjust"))]
)
async def adjust_global_inventory(
    product_id: UUID,
    data: GlobalInventoryAdjust,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """Adjust global inventory quantity (requires global_inventory.adjust permission)"""
    service = GlobalInventoryService(db)

    try:
        inventory = await service.adjust_quantity(product_id, data)
        await db.commit()
        return GlobalInventoryResponse.model_validate(inventory)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/inventory/low-stock",
    response_model=list[GlobalInventoryResponse]
)
async def get_low_stock_global(
    db: DatabaseSession,
    limit: int = Query(50, ge=1, le=100)
):
    """Get global products with low stock"""
    service = GlobalInventoryService(db)
    low_stock = await service.get_low_stock(limit=limit)
    return [GlobalInventoryResponse.model_validate(inv) for inv in low_stock]
