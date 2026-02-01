"""
Test script to verify Pydantic schemas
"""
import asyncio
from uuid import uuid4
from decimal import Decimal
from datetime import date, datetime

# Import schemas
from app.schemas import (
    # School
    SchoolCreate,
    SchoolSettings,
    # User
    UserCreate,
    LoginRequest,
    # Product
    GarmentTypeCreate,
    ProductCreate,
    InventoryCreate,
    # Client
    ClientCreate,
    # Sale
    SaleCreate,
    SaleItemCreate,
    # Order
    OrderCreate,
    OrderItemCreate,
)


def test_school_schemas():
    """Test School schemas"""
    print("\n=== Testing School Schemas ===")

    # Create school with custom settings
    school_data = {
        "code": "COLEGIO-A",
        "name": "Colegio Ejemplo A",
        "email": "info@colegioa.edu.co",
        "phone": "3001234567",
        "address": "Calle 123 #45-67",
        "primary_color": "#FF0000",
        "settings": {
            "currency": "COP",
            "tax_rate": 19.0,
            "commission_per_garment": 5000,
            "allow_credit_sales": True,
            "max_credit_days": 30
        }
    }

    try:
        school = SchoolCreate(**school_data)
        print(f"✅ School created: {school.code} - {school.name}")
        print(f"   Settings: {school.settings}")
    except Exception as e:
        print(f"❌ Error creating school: {e}")


def test_user_schemas():
    """Test User schemas"""
    print("\n=== Testing User Schemas ===")

    # Create user with strong password
    user_data = {
        "username": "admin_user",
        "email": "admin@example.com",
        "full_name": "Admin User",
        "password": "SecurePass123",
        "is_superuser": False
    }

    try:
        user = UserCreate(**user_data)
        print(f"✅ User created: {user.username} ({user.email})")
    except Exception as e:
        print(f"❌ Error creating user: {e}")

    # Test login
    login_data = {
        "username": "admin_user",
        "password": "SecurePass123"
    }

    try:
        login = LoginRequest(**login_data)
        print(f"✅ Login request: {login.username}")
    except Exception as e:
        print(f"❌ Error creating login request: {e}")


def test_product_schemas():
    """Test Product schemas"""
    print("\n=== Testing Product Schemas ===")

    school_id = uuid4()

    # Create garment type
    garment_data = {
        "school_id": school_id,
        "name": "Camisa",
        "description": "Camisa de uniforme",
        "category": "Camisas",
        "requires_embroidery": True,
        "has_custom_measurements": False
    }

    try:
        garment = GarmentTypeCreate(**garment_data)
        print(f"✅ GarmentType created: {garment.name} (Category: {garment.category})")
    except Exception as e:
        print(f"❌ Error creating garment type: {e}")

    # Create product
    product_data = {
        "school_id": school_id,
        "garment_type_id": uuid4(),
        "name": "Camisa Blanca Manga Corta",
        "size": "M",
        "color": "Blanco",
        "gender": "unisex",
        "price": Decimal("45000.00"),
        "cost": Decimal("30000.00")
    }

    try:
        product = ProductCreate(**product_data)
        print(f"✅ Product created: {product.name} - Size {product.size} - ${product.price}")
    except Exception as e:
        print(f"❌ Error creating product: {e}")


def test_client_schemas():
    """Test Client schemas"""
    print("\n=== Testing Client Schemas ===")

    client_data = {
        "school_id": uuid4(),
        "name": "María García",
        "phone": "3009876543",
        "email": "maria@example.com",
        "address": "Calle 45 #12-34",
        "document_type": "CC",
        "document_number": "1234567890",
        "student_name": "Juanito García",
        "student_grade": "5to Grado"
    }

    try:
        client = ClientCreate(**client_data)
        print(f"✅ Client created: {client.name}")
        print(f"   Student: {client.student_name} - {client.student_grade}")
    except Exception as e:
        print(f"❌ Error creating client: {e}")


def test_sale_schemas():
    """Test Sale schemas"""
    print("\n=== Testing Sale Schemas ===")

    school_id = uuid4()

    # Create sale with items
    sale_data = {
        "school_id": school_id,
        "client_id": uuid4(),
        "payment_method": "cash",
        "items": [
            {
                "product_id": uuid4(),
                "quantity": 2
            },
            {
                "product_id": uuid4(),
                "quantity": 1
            }
        ],
        "notes": "Venta de ejemplo"
    }

    try:
        sale = SaleCreate(**sale_data)
        print(f"✅ Sale created with {len(sale.items)} items")
        print(f"   Payment: {sale.payment_method}")
    except Exception as e:
        print(f"❌ Error creating sale: {e}")


def test_order_schemas():
    """Test Order schemas"""
    print("\n=== Testing Order Schemas ===")

    school_id = uuid4()

    # Create order with custom measurements
    order_data = {
        "school_id": school_id,
        "client_id": uuid4(),
        "delivery_date": date(2024, 2, 15),
        "items": [
            {
                "garment_type_id": uuid4(),
                "quantity": 1,
                "size": "Custom",
                "color": "Azul Marino",
                "gender": "male",
                "custom_measurements": {
                    "delantero": 40.5,
                    "trasero": 42.0,
                    "espalda": 35.0,
                    "largo": 75.0
                },
                "embroidery_text": "Juan García - 5B",
                "notes": "Medidas especiales"
            }
        ],
        "advance_payment": Decimal("50000.00"),
        "notes": "Encargo urgente para evento escolar"
    }

    try:
        order = OrderCreate(**order_data)
        print(f"✅ Order created with {len(order.items)} items")
        print(f"   Delivery: {order.delivery_date}")
        print(f"   Advance: ${order.advance_payment}")

        # Check custom measurements
        item = order.items[0]
        if item.custom_measurements:
            print(f"   Custom measurements: {item.custom_measurements}")
    except Exception as e:
        print(f"❌ Error creating order: {e}")


def test_validation_errors():
    """Test validation errors"""
    print("\n=== Testing Validation Errors ===")

    # Weak password
    try:
        UserCreate(
            username="test",
            email="test@example.com",
            password="weak"  # Too short, no uppercase, no digit
        )
        print("❌ Should have raised validation error for weak password")
    except ValueError as e:
        print(f"✅ Password validation working: {str(e)}")

    # Invalid gender
    try:
        ProductCreate(
            school_id=uuid4(),
            garment_type_id=uuid4(),
            size="M",
            gender="invalid",  # Invalid gender
            price=Decimal("45000")
        )
        print("❌ Should have raised validation error for invalid gender")
    except ValueError as e:
        print(f"✅ Gender validation working: {str(e)}")

    # Invalid document type
    try:
        ClientCreate(
            school_id=uuid4(),
            name="Test Client",
            document_type="INVALID"  # Invalid document type
        )
        print("❌ Should have raised validation error for invalid document type")
    except ValueError as e:
        print(f"✅ Document type validation working: {str(e)}")

    # Negative price
    try:
        ProductCreate(
            school_id=uuid4(),
            garment_type_id=uuid4(),
            size="M",
            price=Decimal("-100")  # Negative price
        )
        print("❌ Should have raised validation error for negative price")
    except ValueError as e:
        print(f"✅ Price validation working: {str(e)}")


def main():
    """Run all tests"""
    print("=" * 60)
    print("PYDANTIC SCHEMAS VALIDATION TEST")
    print("=" * 60)

    test_school_schemas()
    test_user_schemas()
    test_product_schemas()
    test_client_schemas()
    test_sale_schemas()
    test_order_schemas()
    test_validation_errors()

    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    main()
