"""
Seed Data Script for I.E. Caracas - Real production data
Run: python seed_caracas.py

This script creates:
1. School: "Institución Educativa Caracas"
2. Garment Types: Camisetas, Sudaderas, Chompas, Yomber, Jeans, Blusas, Medias, Tennis, Zapatos
3. Products: All sizes and prices from price list
4. Initial Inventory: 20 units per product (adjustable)
"""
import asyncio
from uuid import UUID
from decimal import Decimal

from app.db.session import AsyncSessionLocal
from app.schemas.user import UserCreate
from app.schemas.school import SchoolCreate, SchoolSettings
from app.schemas.product import GarmentTypeCreate, ProductCreate, InventoryCreate
from app.services.user import UserService
from app.services.school import SchoolService
from app.services.product import GarmentTypeService, ProductService
from app.services.inventory import InventoryService
from sqlalchemy import select
from app.models.product import GarmentType as GarmentTypeModel, Product as ProductModel


# ============================================
# PRODUCT DATA FROM PRICE LIST
# ============================================

GARMENT_TYPES = [
    {"name": "Camiseta", "description": "Camisetas escolares tipo polo", "category": "tops", "requires_embroidery": True},
    {"name": "Sudadera", "description": "Sudaderas escolares", "category": "tops", "requires_embroidery": True},
    {"name": "Chompa", "description": "Chompas escolares", "category": "outerwear", "requires_embroidery": True},
    {"name": "Yomber", "description": "Yomber escolar completo", "category": "outerwear", "requires_embroidery": True, "has_custom_measurements": True},
    {"name": "Jean", "description": "Jeans escolares", "category": "bottoms", "requires_embroidery": False},
    {"name": "Blusa", "description": "Blusas escolares", "category": "tops", "requires_embroidery": False},
    {"name": "Medias", "description": "Medias escolares", "category": "accessories", "requires_embroidery": False},
    {"name": "Tennis", "description": "Tennis Air F1", "category": "footwear", "requires_embroidery": False},
    {"name": "Zapatos", "description": "Zapatos de goma", "category": "footwear", "requires_embroidery": False},
]

# Prices in COP
PRODUCTS = [
    # ===== CAMISETAS =====
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "6", "price": 33000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "8", "price": 34000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "10", "price": 35000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "12", "price": 35000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "14", "price": 37000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "16", "price": 37000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "S", "price": 39000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "M", "price": 40000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "L", "price": 40000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "XL", "price": 42000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Camiseta", "name": "Camiseta Escolar", "size": "XXL", "price": 45000, "gender": "unisex", "color": "Blanco/Azul"},

    # ===== SUDADERAS =====
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "6", "price": 36000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "8", "price": 36000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "10", "price": 37000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "12", "price": 37000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "14", "price": 39000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "16", "price": 39000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "S", "price": 40000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "M", "price": 41000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "L", "price": 42000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "XL", "price": 44000, "gender": "unisex", "color": "Azul"},
    {"garment": "Sudadera", "name": "Sudadera Escolar", "size": "XXL", "price": 45000, "gender": "unisex", "color": "Azul"},

    # ===== CHOMPAS =====
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "6", "price": 45000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "8", "price": 45000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "10", "price": 47000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "12", "price": 47000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "14", "price": 49000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "16", "price": 49000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "S", "price": 50000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "M", "price": 52000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "L", "price": 52000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "XL", "price": 54000, "gender": "unisex", "color": "Azul"},
    {"garment": "Chompa", "name": "Chompa Escolar", "size": "XXL", "price": 56000, "gender": "unisex", "color": "Azul"},

    # ===== YOMBER =====
    {"garment": "Yomber", "name": "Yomber Completo", "size": "6", "price": 100000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "8", "price": 105000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "10", "price": 110000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "12", "price": 115000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "14", "price": 120000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "16", "price": 125000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "S", "price": 130000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "M", "price": 135000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "L", "price": 135000, "gender": "unisex", "color": "Azul"},
    {"garment": "Yomber", "name": "Yomber Completo", "size": "XL", "price": 140000, "gender": "unisex", "color": "Azul"},

    # ===== JEANS =====
    {"garment": "Jean", "name": "Jean Escolar Niño", "size": "6-16", "price": 38000, "gender": "unisex", "color": "Azul"},
    {"garment": "Jean", "name": "Jean Escolar Adulto", "size": "S-XL", "price": 40000, "gender": "unisex", "color": "Azul"},

    # ===== BLUSAS =====
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "6", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "8", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "10", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "12", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "14", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "16", "price": 15000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "S", "price": 18000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "M", "price": 18000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "L", "price": 18000, "gender": "female", "color": "Blanco"},
    {"garment": "Blusa", "name": "Blusa Escolar", "size": "XL", "price": 18000, "gender": "female", "color": "Blanco"},

    # ===== MEDIAS =====
    {"garment": "Medias", "name": "Medias Natalia", "size": "Única", "price": 10000, "gender": "female", "color": "Blanco"},
    {"garment": "Medias", "name": "Medias Hombre", "size": "Única", "price": 5000, "gender": "male", "color": "Blanco"},

    # ===== TENNIS AIR F1 =====
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "27", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "28", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "29", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "30", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "31", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "32", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "33", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "34", "price": 70000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "35", "price": 75000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "36", "price": 75000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "37", "price": 75000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "38", "price": 75000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "39", "price": 75000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "40", "price": 80000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "41", "price": 80000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "42", "price": 80000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "43", "price": 80000, "gender": "unisex", "color": "Blanco/Azul"},
    {"garment": "Tennis", "name": "Tennis Air F1", "size": "44", "price": 80000, "gender": "unisex", "color": "Blanco/Azul"},

    # ===== ZAPATOS GOMA =====
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "27", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "28", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "29", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "30", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "31", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "32", "price": 75000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "33", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "34", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "35", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "36", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "37", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "38", "price": 80000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "39", "price": 85000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "40", "price": 85000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "41", "price": 85000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "42", "price": 85000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "43", "price": 85000, "gender": "unisex", "color": "Negro"},
    {"garment": "Zapatos", "name": "Zapatos Goma", "size": "44", "price": 85000, "gender": "unisex", "color": "Negro"},
]

# Initial stock per product
DEFAULT_STOCK = 20
MIN_STOCK_ALERT = 5


async def seed_caracas():
    """Seed database with I.E. Caracas data"""
    async with AsyncSessionLocal() as db:
        print("🏫 Seeding I.E. Caracas data...")
        print("=" * 60)

        # 1. Create or get School
        print("\n1️⃣ Creating school: I.E. Caracas...")
        school_service = SchoolService(db)

        try:
            school = await school_service.create_school(
                SchoolCreate(
                    code="CARACAS-001",
                    name="Institución Educativa Caracas",
                    email="contacto@iecaracas.edu.co",
                    phone="3001234567",
                    address="Bogotá, Colombia",
                    primary_color="#1E3A8A",  # Azul oscuro
                    secondary_color="#FFFFFF",  # Blanco
                    settings=SchoolSettings(
                        currency="COP",
                        tax_rate=0.0,  # No IVA for schools
                        commission_per_garment=0,
                        allow_credit_sales=True,
                        max_credit_days=30
                    )
                )
            )
            print(f"   ✅ School created: {school.name} ({school.code})")
            school_id = school.id
        except ValueError as e:
            if "ya existe" in str(e).lower() or "already exists" in str(e).lower():
                print("   ℹ️  School already exists, fetching...")
                school = await school_service.get_by_code("CARACAS-001")
                if not school:
                    # Try to find by name
                    from app.models.school import School as SchoolModel
                    result = await db.execute(
                        select(SchoolModel).where(SchoolModel.code == "CARACAS-001")
                    )
                    school = result.scalar_one_or_none()
                school_id = school.id
                print(f"   ✅ Using existing school: {school.name}")
            else:
                raise

        # 2. Create Garment Types
        print("\n2️⃣ Creating garment types...")
        garment_service = GarmentTypeService(db)

        # Get existing garment types
        result = await db.execute(
            select(GarmentTypeModel).where(GarmentTypeModel.school_id == school_id)
        )
        existing_garment_types = {gt.name: gt.id for gt in result.scalars().all()}

        garment_type_ids = {}
        created_count = 0
        existing_count = 0

        for gt_data in GARMENT_TYPES:
            if gt_data["name"] in existing_garment_types:
                garment_type_ids[gt_data["name"]] = existing_garment_types[gt_data["name"]]
                existing_count += 1
            else:
                try:
                    # Create directly with model
                    gt = GarmentTypeModel(
                        school_id=school_id,
                        name=gt_data["name"],
                        description=gt_data.get("description"),
                        category=gt_data.get("category"),
                        requires_embroidery=gt_data.get("requires_embroidery", False),
                        has_custom_measurements=gt_data.get("has_custom_measurements", False),
                    )
                    db.add(gt)
                    await db.flush()
                    garment_type_ids[gt_data["name"]] = gt.id
                    created_count += 1
                    print(f"   ✅ Created: {gt.name}")
                except Exception as e:
                    print(f"   ❌ Error creating {gt_data['name']}: {e}")

        print(f"   📊 {created_count} created, {existing_count} already existed")

        # 3. Create Products
        print("\n3️⃣ Creating products...")
        product_service = ProductService(db)
        inventory_service = InventoryService(db)

        # Get existing products
        result = await db.execute(
            select(ProductModel).where(ProductModel.school_id == school_id)
        )
        existing_products = {f"{p.name}-{p.size}": p.id for p in result.scalars().all()}

        products_created = 0
        products_existed = 0
        inventory_created = 0

        for prod_data in PRODUCTS:
            product_key = f"{prod_data['name']}-{prod_data['size']}"
            garment_type_id = garment_type_ids.get(prod_data["garment"])

            if not garment_type_id:
                print(f"   ⚠️  Skipping {product_key}: garment type '{prod_data['garment']}' not found")
                continue

            if product_key in existing_products:
                products_existed += 1
                continue

            try:
                product = await product_service.create_product(
                    ProductCreate(
                        school_id=school_id,
                        garment_type_id=garment_type_id,
                        name=prod_data["name"],
                        size=prod_data["size"],
                        color=prod_data.get("color", ""),
                        gender=prod_data.get("gender", "unisex"),
                        price=Decimal(str(prod_data["price"]))
                    )
                )
                products_created += 1

                # Create inventory
                try:
                    await inventory_service.create_inventory(
                        InventoryCreate(
                            school_id=school_id,
                            product_id=product.id,
                            quantity=DEFAULT_STOCK,
                            min_stock_alert=MIN_STOCK_ALERT,
                        )
                    )
                    inventory_created += 1
                except Exception:
                    pass  # Inventory might already exist

                if products_created <= 10:
                    print(f"   ✅ {product.code}: {prod_data['name']} T{prod_data['size']} - ${prod_data['price']:,}")

            except Exception as e:
                print(f"   ❌ Error creating {product_key}: {e}")

        if products_created > 10:
            print(f"   ... and {products_created - 10} more products")

        print(f"\n   📊 Products: {products_created} created, {products_existed} already existed")
        print(f"   📦 Inventory: {inventory_created} entries created")

        # Commit all changes
        await db.commit()

        # Summary
        print("\n" + "=" * 60)
        print("✅ I.E. Caracas data seeded successfully!")
        print("=" * 60)
        print(f"\n📊 Summary:")
        print(f"   🏫 School: Institución Educativa Caracas")
        print(f"   👕 Garment Types: {len(garment_type_ids)}")
        print(f"   📦 Products: {products_created + products_existed}")
        print(f"   📈 Initial Stock: {DEFAULT_STOCK} units per product")
        print(f"\n📱 Contact: Consuelo Rios - 300 123 4567")
        print("\n🚀 Ready to use!")


if __name__ == "__main__":
    asyncio.run(seed_caracas())
