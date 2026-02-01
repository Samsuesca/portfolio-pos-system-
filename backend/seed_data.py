"""
Seed Data Script - Populate database with sample data
Run: python seed_data.py
"""
import asyncio
from uuid import UUID
from decimal import Decimal

from app.db.session import AsyncSessionLocal
from app.schemas.user import UserCreate
from app.schemas.school import SchoolCreate, SchoolSettings
from app.schemas.product import GarmentTypeCreate, ProductCreate
from app.schemas.client import ClientCreate
from app.services.user import UserService
from app.services.school import SchoolService
from app.services.product import GarmentTypeService, ProductService
from app.services.client import ClientService


async def seed_database():
    """Seed database with sample data"""
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding database...")

        # 1. Create Superuser
        print("\n1️⃣ Creating superuser...")
        user_service = UserService(db)

        try:
            superuser = await user_service.create_user(
                UserCreate(
                    username="admin",
                    email="admin@uniformes.com",
                    full_name="Administrador del Sistema",
                    password="Admin123",
                    is_superuser=True
                )
            )
            print(f"   ✅ Superuser created: {superuser.username}")
        except ValueError:
            print("   ℹ️  Superuser already exists")

        # 2. Create Demo School
        print("\n2️⃣ Creating demo school...")
        school_service = SchoolService(db)

        try:
            school = await school_service.create_school(
                SchoolCreate(
                    code="DEMO-001",
                    name="Colegio Demo",
                    email="contacto@colegiodemo.edu.co",
                    phone="3001234567",
                    address="Calle 123 #45-67, Bogotá",
                    primary_color="#1E40AF",
                    secondary_color="#10B981",
                    settings=SchoolSettings(
                        currency="COP",
                        tax_rate=19.0,
                        commission_per_garment=5000,
                        allow_credit_sales=True,
                        max_credit_days=30
                    )
                )
            )
            print(f"   ✅ School created: {school.name} ({school.code})")
            school_id = school.id
        except ValueError:
            print("   ℹ️  School already exists, fetching...")
            school = await school_service.get_by_code("DEMO-001")
            school_id = school.id

        # 3. Create Garment Types
        print("\n3️⃣ Creating garment types...")
        garment_service = GarmentTypeService(db)

        garment_types_data = [
            {"name": "Camisa", "description": "Camisas escolares"},
            {"name": "Pantalón", "description": "Pantalones escolares"},
            {"name": "Falda", "description": "Faldas escolares"},
            {"name": "Chaqueta", "description": "Chaquetas y sacos"},
            {"name": "Medias", "description": "Medias y calcetines"},
        ]

        # Get all existing garment types first
        from sqlalchemy import select
        from app.models.product import GarmentType as GarmentTypeModel

        result = await db.execute(
            select(GarmentTypeModel).where(GarmentTypeModel.school_id == school_id)
        )
        existing_garment_types = {gt.name: gt.id for gt in result.scalars().all()}

        garment_types = {}
        for gt_data in garment_types_data:
            if gt_data["name"] in existing_garment_types:
                # Use existing
                garment_types[gt_data["name"]] = existing_garment_types[gt_data["name"]]
                print(f"   ℹ️  {gt_data['name']} already exists, using existing")
            else:
                # Create new
                try:
                    gt = await garment_service.create(
                        GarmentTypeCreate(
                            school_id=school_id,
                            name=gt_data["name"],
                            description=gt_data["description"]
                        ).model_dump()
                    )
                    garment_types[gt_data["name"]] = gt.id
                    print(f"   ✅ Created: {gt.name}")
                except Exception as e:
                    print(f"   ❌ Error creating {gt_data['name']}: {e}")

        # 4. Create Products
        print("\n4️⃣ Creating sample products...")
        product_service = ProductService(db)

        products_data = [
            # Camisas
            {"garment": "Camisa", "name": "Camisa Polo Azul", "size": "14", "color": "Azul", "gender": "unisex", "price": 40000},
            {"garment": "Camisa", "name": "Camisa Polo Azul", "size": "16", "color": "Azul", "gender": "unisex", "price": 42000},
            {"garment": "Camisa", "name": "Camisa Polo Azul", "size": "18", "color": "Azul", "gender": "unisex", "price": 44000},
            {"garment": "Camisa", "name": "Camisa Blanca", "size": "S", "color": "Blanco", "gender": "unisex", "price": 38000},
            {"garment": "Camisa", "name": "Camisa Blanca", "size": "M", "color": "Blanco", "gender": "unisex", "price": 40000},
            {"garment": "Camisa", "name": "Camisa Blanca", "size": "L", "color": "Blanco", "gender": "unisex", "price": 42000},

            # Pantalones
            {"garment": "Pantalón", "name": "Pantalón Gris", "size": "28", "color": "Gris", "gender": "male", "price": 50000},
            {"garment": "Pantalón", "name": "Pantalón Gris", "size": "30", "color": "Gris", "gender": "male", "price": 52000},
            {"garment": "Pantalón", "name": "Pantalón Gris", "size": "32", "color": "Gris", "gender": "male", "price": 54000},
            {"garment": "Pantalón", "name": "Pantalón Azul", "size": "S", "color": "Azul", "gender": "male", "price": 48000},

            # Faldas
            {"garment": "Falda", "name": "Falda Gris", "size": "S", "color": "Gris", "gender": "female", "price": 45000},
            {"garment": "Falda", "name": "Falda Gris", "size": "M", "color": "Gris", "gender": "female", "price": 47000},
            {"garment": "Falda", "name": "Falda Gris", "size": "L", "color": "Gris", "gender": "female", "price": 49000},

            # Chaquetas
            {"garment": "Chaqueta", "name": "Chaqueta Escolar", "size": "S", "color": "Azul", "gender": "unisex", "price": 80000},
            {"garment": "Chaqueta", "name": "Chaqueta Escolar", "size": "M", "color": "Azul", "gender": "unisex", "price": 85000},
            {"garment": "Chaqueta", "name": "Chaqueta Escolar", "size": "L", "color": "Azul", "gender": "unisex", "price": 90000},

            # Medias
            {"garment": "Medias", "name": "Medias Blancas", "size": "Única", "color": "Blanco", "gender": "unisex", "price": 8000},
            {"garment": "Medias", "name": "Medias Azules", "size": "Única", "color": "Azul", "gender": "unisex", "price": 8000},
        ]

        for prod_data in products_data:
            try:
                if prod_data["garment"] in garment_types:
                    await product_service.create_product(
                        ProductCreate(
                            school_id=school_id,
                            garment_type_id=garment_types[prod_data["garment"]],
                            name=prod_data["name"],
                            size=prod_data["size"],
                            color=prod_data["color"],
                            gender=prod_data["gender"],
                            price=Decimal(str(prod_data["price"]))
                        )
                    )
                    print(f"   ✅ Created: {prod_data['name']} - Talla {prod_data['size']}")
            except Exception as e:
                import traceback
                print(f"   ❌ Error creating {prod_data['name']} - {prod_data['size']}: {e}")
                traceback.print_exc()

        # 5. Create Initial Inventory
        print("\n5️⃣ Creating initial inventory...")
        from app.services.inventory import InventoryService
        from app.schemas.product import InventoryCreate

        inventory_service = InventoryService(db)

        # Get all created products
        from sqlalchemy import select
        from app.models.product import Product as ProductModel

        result = await db.execute(
            select(ProductModel).where(ProductModel.school_id == school_id)
        )
        all_products = result.scalars().all()

        inventory_count = 0
        for product in all_products:
            try:
                # Add initial stock (between 10-50 units per product)
                import random
                initial_quantity = random.randint(10, 50)

                await inventory_service.create_inventory(
                    InventoryCreate(
                        school_id=school_id,
                        product_id=product.id,
                        quantity=initial_quantity,
                        min_stock=5,
                        max_stock=100
                    )
                )
                inventory_count += 1
                if inventory_count <= 5:  # Only print first 5
                    print(f"   ✅ Stock added: {product.code} - {initial_quantity} units")
            except Exception as e:
                if inventory_count <= 5:
                    print(f"   ℹ️  Inventory might already exist for {product.code}")

        print(f"   📦 Total: {inventory_count} products with inventory")

        # 6. Create Sample Clients
        print("\n6️⃣ Creating sample clients...")
        client_service = ClientService(db)

        clients_data = [
            {"name": "María González", "phone": "3001234567", "email": "maria@example.com", "student_name": "Ana González", "student_grade": "5to"},
            {"name": "Carlos Rodríguez", "phone": "3002345678", "email": "carlos@example.com", "student_name": "Juan Rodríguez", "student_grade": "7mo"},
            {"name": "Laura Martínez", "phone": "3003456789", "email": "laura@example.com", "student_name": "Sofia Martínez", "student_grade": "3ro"},
        ]

        # Check existing clients first to avoid duplicates
        from app.models.client import Client as ClientModel
        existing_result = await db.execute(
            select(ClientModel).where(ClientModel.school_id == school_id)
        )
        existing_clients = {c.name: c for c in existing_result.scalars().all()}

        for client_data in clients_data:
            if client_data["name"] in existing_clients:
                print(f"   ℹ️  Cliente ya existe: {client_data['name']}")
                continue

            try:
                await client_service.create_client(
                    ClientCreate(
                        school_id=school_id,
                        name=client_data["name"],
                        phone=client_data["phone"],
                        email=client_data["email"],
                        student_name=client_data["student_name"],
                        student_grade=client_data.get("student_grade")
                    )
                )
                print(f"   ✅ Created client: {client_data['name']}")
            except Exception as e:
                print(f"   ❌ Error creating client {client_data['name']}: {e}")

        await db.commit()

        print("\n✅ Database seeded successfully!")
        print("\n📝 Login credentials:")
        print("   Username: admin")
        print("   Password: Admin123")
        print(f"\n📊 Sample data created:")
        print(f"   - {len(garment_types_data)} garment types")
        print(f"   - {len(products_data)} products")
        print(f"   - {inventory_count} products with inventory")
        print(f"   - {len(clients_data)} clients")
        print("\n🚀 Start the app:")
        print("   Backend:  uvicorn app.main:app --reload")
        print("   Frontend: cd frontend && npm run tauri:dev")


if __name__ == "__main__":
    asyncio.run(seed_database())
