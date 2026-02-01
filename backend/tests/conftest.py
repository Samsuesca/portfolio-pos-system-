"""
Pytest Configuration & Fixtures for Uniformes System v2.0

This module provides shared fixtures for both unit and integration tests.
"""
import os

# Set TESTING=True BEFORE importing app modules to disable rate limiting
os.environ["TESTING"] = "true"

import asyncio
from datetime import datetime, date
from decimal import Decimal
from typing import AsyncGenerator, Generator
from uuid import uuid4, UUID
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.db.base import Base
from app.models import (
    User, School, Product, GarmentType, Inventory, Client,
    Sale, SaleItem, SaleChange, Order, OrderItem,
    Transaction, Expense, DailyCashRegister, UserSchoolRole
)
from app.models.sale import SaleStatus, PaymentMethod, ChangeType, ChangeStatus
from app.models.order import OrderStatus
from app.models.user import UserRole
from app.core.config import settings


# ============================================================================
# DATABASE FIXTURES (for integration tests)
# ============================================================================

# Test database URL - uses dedicated PostgreSQL container for tests
# Set TEST_DATABASE_URL env var to override
import os

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    # Default: dedicated test container (postgres-test service on port 5433)
    "postgresql+asyncpg://uniformes_test:test_password@localhost:5433/uniformes_test"
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_engine():
    """Create async PostgreSQL engine for testing."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )

    # Create all tables once at session start
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after all tests complete
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Provide a database session for testing.

    Each test gets a fresh session. Data cleanup happens via
    truncating tables or through test isolation.
    """
    async_session = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
    )

    async with async_session() as session:
        try:
            yield session
        finally:
            # Always rollback at the end to clean up
            await session.rollback()
            await session.close()


@pytest.fixture
def mock_db_session():
    """Create a mock database session for unit tests."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    return session


# ============================================================================
# FACTORY FIXTURES - Generate test data
# ============================================================================

@pytest.fixture
def school_factory():
    """Factory for creating School instances."""
    def _create(
        id: str = None,
        code: str = None,
        name: str = "Test School",
        slug: str = None,
        is_active: bool = True,
        **kwargs
    ) -> School:
        unique = uuid4().hex[:6]
        return School(
            id=id or str(uuid4()),
            code=code or f"TST-{unique.upper()}",
            name=name,
            slug=slug or f"test-school-{unique}",
            is_active=is_active,
            **kwargs
        )
    return _create


@pytest.fixture
def user_factory():
    """Factory for creating User instances."""
    def _create(
        id: str = None,
        username: str = None,
        email: str = None,
        is_active: bool = True,
        is_superuser: bool = False,
        **kwargs
    ) -> User:
        unique = uuid4().hex[:6]
        return User(
            id=id or str(uuid4()),
            username=username or f"user_{unique}",
            email=email or f"user_{unique}@test.com",
            hashed_password="hashed_password",
            is_active=is_active,
            is_superuser=is_superuser,
            **kwargs
        )
    return _create


@pytest.fixture
def garment_type_factory():
    """Factory for creating GarmentType instances."""
    def _create(
        id: str = None,
        school_id: str = None,
        name: str = None,
        category: str = "uniforme_diario",
        description: str = None,
        requires_embroidery: bool = False,
        has_custom_measurements: bool = False,
        is_active: bool = True,
        **kwargs
    ) -> GarmentType:
        unique = uuid4().hex[:6]
        return GarmentType(
            id=id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            name=name or f"Camisa {unique}",
            category=category,
            description=description,
            requires_embroidery=requires_embroidery,
            has_custom_measurements=has_custom_measurements,
            is_active=is_active,
            **kwargs
        )
    return _create


@pytest.fixture
def product_factory():
    """Factory for creating Product instances."""
    def _create(
        id: str = None,
        school_id: str = None,
        garment_type_id: str = None,
        code: str = None,
        name: str = "Test Product",
        size: str = "M",
        color: str = "Blanco",
        price: Decimal = Decimal("50000"),
        is_active: bool = True,
        **kwargs
    ) -> Product:
        return Product(
            id=id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            garment_type_id=garment_type_id or str(uuid4()),
            code=code or f"PRD-{uuid4().hex[:4].upper()}",
            name=name,
            size=size,
            color=color,
            price=price,
            is_active=is_active,
            **kwargs
        )
    return _create


@pytest.fixture
def inventory_factory():
    """Factory for creating Inventory instances."""
    def _create(
        id: str = None,
        product_id: str = None,
        school_id: str = None,
        quantity: int = 100,
        min_stock_alert: int = 10,
        **kwargs
    ) -> Inventory:
        return Inventory(
            id=id or str(uuid4()),
            product_id=product_id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            quantity=quantity,
            min_stock_alert=min_stock_alert,
            **kwargs
        )
    return _create


@pytest.fixture
def client_factory():
    """Factory for creating Client instances."""
    def _create(
        id: str = None,
        school_id: str = None,
        code: str = None,
        name: str = "Test Client",
        is_active: bool = True,
        **kwargs
    ) -> Client:
        return Client(
            id=id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            code=code or f"CLI-{uuid4().hex[:4].upper()}",
            name=name,
            is_active=is_active,
            **kwargs
        )
    return _create


@pytest.fixture
def sale_factory():
    """Factory for creating Sale instances."""
    def _create(
        id: str = None,
        school_id: str = None,
        client_id: str = None,
        user_id: str = None,
        code: str = None,
        status: SaleStatus = SaleStatus.COMPLETED,
        total: Decimal = Decimal("100000"),
        paid_amount: Decimal = Decimal("100000"),
        payment_method: PaymentMethod = PaymentMethod.CASH,
        **kwargs
    ) -> Sale:
        return Sale(
            id=id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            client_id=client_id,
            user_id=user_id or str(uuid4()),
            code=code or f"VNT-2025-{uuid4().hex[:4].upper()}",
            status=status,
            total=total,
            paid_amount=paid_amount,
            payment_method=payment_method,
            **kwargs
        )
    return _create


@pytest.fixture
def sale_item_factory():
    """Factory for creating SaleItem instances."""
    def _create(
        id: str = None,
        sale_id: str = None,
        product_id: str = None,
        quantity: int = 1,
        unit_price: Decimal = Decimal("50000"),
        **kwargs
    ) -> SaleItem:
        subtotal = unit_price * quantity
        return SaleItem(
            id=id or str(uuid4()),
            sale_id=sale_id or str(uuid4()),
            product_id=product_id or str(uuid4()),
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal,
            **kwargs
        )
    return _create


@pytest.fixture
def order_factory():
    """Factory for creating Order instances."""
    from app.models.sale import SaleSource

    def _create(
        id: str = None,
        school_id: str = None,
        client_id: str = None,
        user_id: str = None,
        code: str = None,
        status: OrderStatus = OrderStatus.PENDING,
        subtotal: Decimal = Decimal("100000"),
        tax: Decimal = Decimal("19000"),
        total: Decimal = Decimal("119000"),
        paid_amount: Decimal = Decimal("0"),
        source: SaleSource = SaleSource.DESKTOP_APP,
        **kwargs
    ) -> Order:
        # Note: balance is a computed column, don't set it
        return Order(
            id=id or str(uuid4()),
            school_id=school_id or str(uuid4()),
            client_id=client_id or str(uuid4()),
            user_id=user_id or str(uuid4()),
            code=code or f"ENC-2025-{uuid4().hex[:4].upper()}",
            status=status,
            subtotal=subtotal,
            tax=tax,
            total=total,
            paid_amount=paid_amount,
            source=source,
            **kwargs
        )
    return _create


# ============================================================================
# SAMPLE DATA FIXTURES - Pre-created test data
# ============================================================================

@pytest.fixture
def sample_school(school_factory) -> School:
    """Provide a sample school for testing."""
    return school_factory(
        id=str(uuid4()),
        code="IE-CARACAS",
        name="I.E. Caracas"
    )


@pytest.fixture
def sample_user(user_factory) -> User:
    """Provide a sample user for testing."""
    return user_factory(
        id="user-001",
        username="admin",
        email="admin@test.com",
        is_superuser=True
    )


@pytest.fixture
def sample_products(product_factory, sample_school) -> list[Product]:
    """Provide sample products for testing."""
    return [
        product_factory(
            id="prod-001",
            school_id=sample_school.id,
            code="PRD-0001",
            name="Camisa Blanca T12",
            size="T12",
            price=Decimal("45000")
        ),
        product_factory(
            id="prod-002",
            school_id=sample_school.id,
            code="PRD-0002",
            name="Camisa Blanca T14",
            size="T14",
            price=Decimal("48000")
        ),
        product_factory(
            id="prod-003",
            school_id=sample_school.id,
            code="PRD-0003",
            name="Pantalón Azul T12",
            size="T12",
            price=Decimal("55000")
        ),
    ]


@pytest.fixture
def sample_inventories(inventory_factory, sample_products, sample_school) -> list[Inventory]:
    """Provide sample inventories for testing."""
    return [
        inventory_factory(
            id=f"inv-{prod.id}",
            product_id=prod.id,
            school_id=sample_school.id,
            quantity=50,
            min_stock_alert=5
        )
        for prod in sample_products
    ]


@pytest.fixture
def sample_client(client_factory, sample_school) -> Client:
    """Provide a sample client for testing."""
    return client_factory(
        id="client-001",
        school_id=sample_school.id,
        code="CLI-0001",
        name="María García",
        email="maria@test.com",
        phone="3001234567",
        student_name="Juan García",
        student_grade="5A"
    )


# ============================================================================
# MOCK SERVICE FIXTURES - For unit tests
# ============================================================================

@pytest.fixture
def mock_inventory_service():
    """Create a mock InventoryService for unit tests."""
    service = AsyncMock()
    service.check_availability = AsyncMock(return_value=True)
    service.reserve_stock = AsyncMock()
    service.release_stock = AsyncMock()
    service.add_stock = AsyncMock()
    service.remove_stock = AsyncMock()
    service.get_by_product = AsyncMock()
    return service


@pytest.fixture
def mock_transaction_service():
    """Create a mock TransactionService for unit tests."""
    service = AsyncMock()
    service.create_sale_transaction = AsyncMock()
    service.create_order_transaction = AsyncMock()
    service.create_transaction = AsyncMock()
    service.get_daily_totals = AsyncMock()
    return service


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def assert_decimal_equal(actual: Decimal, expected: Decimal, places: int = 2):
    """Assert two decimals are equal within precision."""
    assert round(actual, places) == round(expected, places), \
        f"Expected {expected}, got {actual}"


def create_sale_data(
    client_id: str = None,
    items: list = None,
    payment_method: str = "cash",
    notes: str = None
) -> dict:
    """Helper to create sale request data."""
    return {
        "client_id": client_id,
        "items": items or [],
        "payment_method": payment_method,
        "notes": notes
    }


def create_sale_item_data(
    product_id: str,
    quantity: int = 1
) -> dict:
    """Helper to create sale item data."""
    return {
        "product_id": product_id,
        "quantity": quantity
    }


# ============================================================================
# API CLIENT FIXTURES (for API endpoint tests)
# ============================================================================

@pytest.fixture
async def app():
    """Get FastAPI application instance."""
    from app.main import app as fastapi_app
    return fastapi_app


@pytest.fixture
async def api_client(app, db_session) -> AsyncGenerator[AsyncClient, None]:
    """
    Create async HTTP client for API testing.

    This client is configured to:
    - Use the FastAPI app directly (no real network)
    - Override database dependency to use test session
    - Include proper base URL for testing

    Usage:
        async def test_endpoint(api_client):
            response = await api_client.get("/api/v1/health")
            assert response.status_code == 200
    """
    from app.db.session import get_db

    # Override database dependency
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Clear overrides after test
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session) -> User:
    """Create a test user in the database."""
    from app.services.user import UserService

    unique_id = uuid4().hex[:8]
    user = User(
        id=str(uuid4()),
        username=f"testuser_{unique_id}",
        email=f"testuser_{unique_id}@test.com",
        hashed_password=UserService.hash_password("TestPassword123!"),
        full_name="Test User",
        is_active=True,
        is_superuser=False
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def test_superuser(db_session) -> User:
    """Create a test superuser in the database."""
    from app.services.user import UserService

    unique_id = uuid4().hex[:8]
    user = User(
        id=str(uuid4()),
        username=f"admin_{unique_id}",
        email=f"admin_{unique_id}@test.com",
        hashed_password=UserService.hash_password("AdminPassword123!"),
        full_name="Admin User",
        is_active=True,
        is_superuser=True
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def test_school(db_session) -> School:
    """Create a test school in the database."""
    unique_id = uuid4().hex[:8]
    school = School(
        id=str(uuid4()),
        code=f"TST-{unique_id}",
        name=f"Test School {unique_id}",
        slug=f"test-school-{unique_id}",
        is_active=True
    )
    db_session.add(school)
    await db_session.flush()
    return school


@pytest.fixture
async def test_user_with_school_role(db_session, test_user, test_school) -> tuple[User, School]:
    """Create a test user with ADMIN role in test school."""
    role = UserSchoolRole(
        id=str(uuid4()),
        user_id=test_user.id,
        school_id=test_school.id,
        role=UserRole.ADMIN
    )
    db_session.add(role)
    await db_session.flush()
    return test_user, test_school


@pytest.fixture
def auth_headers(test_user) -> dict[str, str]:
    """
    Generate JWT authentication headers for test user.

    Usage:
        async def test_protected_endpoint(api_client, auth_headers):
            response = await api_client.get("/api/v1/protected", headers=auth_headers)
    """
    from app.services.user import UserService
    from unittest.mock import MagicMock

    # Create a mock DB session (we just need to generate token, not query DB)
    mock_db = MagicMock()
    user_service = UserService(mock_db)

    token = user_service.create_access_token(
        user_id=UUID(test_user.id),
        username=test_user.username
    )

    return {"Authorization": f"Bearer {token.access_token}"}


@pytest.fixture
def superuser_headers(test_superuser) -> dict[str, str]:
    """
    Generate JWT authentication headers for superuser.

    Usage:
        async def test_admin_endpoint(api_client, superuser_headers):
            response = await api_client.get("/api/v1/admin", headers=superuser_headers)
    """
    from app.services.user import UserService
    from unittest.mock import MagicMock

    mock_db = MagicMock()
    user_service = UserService(mock_db)

    token = user_service.create_access_token(
        user_id=UUID(test_superuser.id),
        username=test_superuser.username
    )

    return {"Authorization": f"Bearer {token.access_token}"}


@pytest.fixture
async def test_garment_type(db_session, test_school) -> GarmentType:
    """Create a test garment type."""
    unique_id = uuid4().hex[:8]
    garment_type = GarmentType(
        id=str(uuid4()),
        school_id=test_school.id,
        name=f"Camisa {unique_id}",
        category="uniforme_diario",
        description="Test garment type",
        requires_embroidery=False,
        has_custom_measurements=False,
        is_active=True
    )
    db_session.add(garment_type)
    await db_session.flush()
    return garment_type


@pytest.fixture
async def test_product(db_session, test_school, test_garment_type) -> Product:
    """Create a test product."""
    unique_id = uuid4().hex[:8]
    product = Product(
        id=str(uuid4()),
        school_id=test_school.id,
        garment_type_id=test_garment_type.id,
        code=f"PRD-{unique_id}",
        name=f"Camisa Blanca T12 {unique_id}",
        size="T12",
        color="Blanco",
        price=Decimal("45000"),
        is_active=True
    )
    db_session.add(product)
    await db_session.flush()
    return product


@pytest.fixture
async def test_inventory(db_session, test_product, test_school) -> Inventory:
    """Create test inventory for a product."""
    inventory = Inventory(
        id=str(uuid4()),
        product_id=test_product.id,
        school_id=test_school.id,
        quantity=100,
        min_stock_alert=10
    )
    db_session.add(inventory)
    await db_session.flush()
    return inventory


@pytest.fixture
async def test_client(db_session) -> Client:
    """Create a test client (global - not tied to school)."""
    from app.models.client import ClientType

    unique_id = uuid4().hex[:8]
    client = Client(
        id=str(uuid4()),
        # school_id is optional for global clients
        code=f"CLI-{unique_id}",
        name=f"María García {unique_id}",
        email=f"maria_{unique_id}@test.com",
        phone="3001234567",
        student_name="Juan García",
        student_grade="5A",
        client_type=ClientType.REGULAR,
        is_active=True
    )
    db_session.add(client)
    await db_session.flush()
    return client


@pytest.fixture
async def test_sale(
    db_session,
    test_school,
    test_user,
    test_client,
    test_product
) -> Sale:
    """Create a test sale with one item."""
    unique_id = uuid4().hex[:8]
    sale = Sale(
        id=str(uuid4()),
        school_id=test_school.id,
        user_id=test_user.id,
        client_id=test_client.id,
        code=f"VNT-2025-{unique_id}",
        status=SaleStatus.COMPLETED,
        total=Decimal("45000"),
        paid_amount=Decimal("45000"),
        payment_method=PaymentMethod.CASH
    )
    db_session.add(sale)
    await db_session.flush()

    sale_item = SaleItem(
        id=str(uuid4()),
        sale_id=sale.id,
        product_id=test_product.id,
        quantity=1,
        unit_price=Decimal("45000"),
        subtotal=Decimal("45000")
    )
    db_session.add(sale_item)
    await db_session.flush()
    return sale


@pytest.fixture
async def test_order(
    db_session,
    test_school,
    test_user,
    test_client,
    test_garment_type
) -> Order:
    """Create a test order with one item."""
    from app.models.sale import SaleSource

    unique_id = uuid4().hex[:8]
    order = Order(
        id=str(uuid4()),
        school_id=test_school.id,
        user_id=test_user.id,
        client_id=test_client.id,
        code=f"ENC-2025-{unique_id}",
        status=OrderStatus.PENDING,
        subtotal=Decimal("50000"),
        tax=Decimal("9500"),
        total=Decimal("59500"),
        paid_amount=Decimal("20000"),
        # balance is a computed column (total - paid_amount), don't set it
        source=SaleSource.DESKTOP_APP
    )
    db_session.add(order)
    await db_session.flush()

    order_item = OrderItem(
        id=str(uuid4()),
        order_id=order.id,
        school_id=test_school.id,
        garment_type_id=test_garment_type.id,
        quantity=1,
        unit_price=Decimal("50000"),
        subtotal=Decimal("50000"),
        size="M"
    )
    db_session.add(order_item)
    await db_session.flush()
    return order


# ============================================================================
# COMPLETE TEST DATA FIXTURES
# ============================================================================

@pytest.fixture
async def complete_test_setup(
    db_session,
    test_superuser,
    test_school,
    test_garment_type,
    test_product,
    test_inventory,
    test_client
) -> dict:
    """
    Create a complete test environment with all necessary data.

    Returns a dictionary with:
    - superuser: Admin user with full access
    - school: Test school
    - garment_type: Test garment type
    - product: Test product
    - inventory: Test inventory
    - client: Test client

    This fixture is useful for integration tests that need
    a fully configured environment.
    """
    # Add user role to school
    role = UserSchoolRole(
        id=str(uuid4()),
        user_id=test_superuser.id,
        school_id=test_school.id,
        role=UserRole.OWNER
    )
    db_session.add(role)
    await db_session.flush()

    return {
        "superuser": test_superuser,
        "school": test_school,
        "garment_type": test_garment_type,
        "product": test_product,
        "inventory": test_inventory,
        "client": test_client,
    }


# ============================================================================
# NEW FEATURE FIXTURES - Alterations, Employees, Payroll, Fixed Expenses, Notifications
# ============================================================================

@pytest.fixture
async def test_employee(db_session) -> "Employee":
    """Create a test employee for payroll tests."""
    from app.models.payroll import Employee, PaymentFrequency

    unique_id = uuid4().hex[:8]
    employee = Employee(
        id=uuid4(),
        full_name=f"María García {unique_id}",
        document_type="CC",
        document_id=f"1234{unique_id}",
        phone="3001234567",
        email=f"maria_{unique_id}@test.com",
        address="Calle 123 #45-67",
        position="Costurera",
        hire_date=date.today(),
        base_salary=Decimal("1500000"),
        payment_frequency=PaymentFrequency.BIWEEKLY,
        is_active=True,
        health_deduction=Decimal("60000"),
        pension_deduction=Decimal("60000"),
        other_deductions=Decimal("0")
    )
    db_session.add(employee)
    await db_session.flush()
    return employee


@pytest.fixture
async def test_alteration(db_session, test_user) -> "Alteration":
    """Create a test alteration."""
    from app.models.alteration import Alteration, AlterationStatus, AlterationType

    unique_id = uuid4().hex[:8]
    alteration = Alteration(
        id=uuid4(),
        code=f"ARR-2026-{unique_id}",
        external_client_name=f"Cliente Prueba {unique_id}",
        external_client_phone="3001234567",
        garment_name="Pantalón azul talla 12",
        alteration_type=AlterationType.HEM,
        description="Subir bota 3cm",
        cost=Decimal("15000"),
        amount_paid=Decimal("5000"),
        status=AlterationStatus.PENDING,
        received_date=date.today(),
        created_by=test_user.id
    )
    db_session.add(alteration)
    await db_session.flush()
    return alteration


@pytest.fixture
async def test_fixed_expense(db_session) -> "FixedExpense":
    """Create a test fixed expense."""
    from app.models.fixed_expense import FixedExpense, FixedExpenseType, RecurrenceFrequency
    from app.models.accounting import ExpenseCategory

    unique_id = uuid4().hex[:8]
    fixed_expense = FixedExpense(
        id=uuid4(),
        name=f"Arriendo Local {unique_id}",
        category=ExpenseCategory.RENT,
        description="Arriendo mensual del local",
        expense_type=FixedExpenseType.EXACT,
        amount=Decimal("2000000"),
        recurrence_frequency=RecurrenceFrequency.MONTHLY,
        day_of_month=5,
        is_active=True
    )
    db_session.add(fixed_expense)
    await db_session.flush()
    return fixed_expense


@pytest.fixture
async def test_notification(db_session, test_user, test_school) -> "Notification":
    """Create a test notification."""
    from app.models.notification import Notification, NotificationType, ReferenceType

    notification = Notification(
        id=uuid4(),
        user_id=test_user.id,
        school_id=test_school.id,
        type=NotificationType.NEW_WEB_ORDER,
        title="Nuevo Pedido Web",
        message="Se ha recibido un nuevo pedido desde el portal web",
        reference_type=ReferenceType.ORDER,
        reference_id=uuid4(),
        is_read=False
    )
    db_session.add(notification)
    await db_session.flush()
    return notification


@pytest.fixture
async def test_payroll_run(db_session, test_employee, test_user) -> "PayrollRun":
    """Create a test payroll run with items."""
    from app.models.payroll import PayrollRun, PayrollItem, PayrollStatus
    from datetime import timedelta

    payroll_run = PayrollRun(
        id=uuid4(),
        period_start=date.today() - timedelta(days=15),
        period_end=date.today(),
        status=PayrollStatus.DRAFT,
        total_base_salary=Decimal("1500000"),
        total_bonuses=Decimal("100000"),
        total_deductions=Decimal("120000"),
        total_net=Decimal("1480000"),
        employee_count=1,
        created_by=test_user.id
    )
    db_session.add(payroll_run)
    await db_session.flush()

    # Create payroll item for the employee
    payroll_item = PayrollItem(
        id=uuid4(),
        payroll_run_id=payroll_run.id,
        employee_id=test_employee.id,
        base_salary=Decimal("1500000"),
        total_bonuses=Decimal("100000"),
        total_deductions=Decimal("120000"),
        net_amount=Decimal("1480000"),
        is_paid=False
    )
    db_session.add(payroll_item)
    await db_session.flush()

    return payroll_run


@pytest.fixture
def alteration_factory():
    """Factory for creating Alteration instances."""
    def _create(
        id: UUID = None,
        external_client_name: str = None,
        external_client_phone: str = "3001234567",
        garment_name: str = "Pantalón azul",
        alteration_type = None,
        description: str = "Arreglo de dobladillo",
        cost: Decimal = Decimal("15000"),
        amount_paid: Decimal = Decimal("0"),
        status = None,
        **kwargs
    ):
        from app.models.alteration import Alteration, AlterationStatus, AlterationType

        unique_id = uuid4().hex[:6]
        return Alteration(
            id=id or uuid4(),
            code=f"ARR-2026-{unique_id}",
            external_client_name=external_client_name or f"Cliente {unique_id}",
            external_client_phone=external_client_phone,
            garment_name=garment_name,
            description=description,
            alteration_type=alteration_type or AlterationType.HEM,
            cost=cost,
            amount_paid=amount_paid,
            status=status or AlterationStatus.PENDING,
            received_date=date.today(),
            **kwargs
        )
    return _create


@pytest.fixture
def employee_factory():
    """Factory for creating Employee instances."""
    def _create(
        id: UUID = None,
        full_name: str = None,
        document_id: str = None,
        position: str = "Vendedora",
        base_salary: Decimal = Decimal("1300000"),
        **kwargs
    ):
        from app.models.payroll import Employee, PaymentFrequency

        unique_id = uuid4().hex[:6]
        return Employee(
            id=id or uuid4(),
            full_name=full_name or f"Empleado Test {unique_id}",
            document_type="CC",
            document_id=document_id or f"123456{unique_id}",
            position=position,
            hire_date=date.today(),
            base_salary=base_salary,
            payment_frequency=PaymentFrequency.BIWEEKLY,
            is_active=True,
            health_deduction=Decimal("0"),
            pension_deduction=Decimal("0"),
            other_deductions=Decimal("0"),
            **kwargs
        )
    return _create


@pytest.fixture
def fixed_expense_factory():
    """Factory for creating FixedExpense instances."""
    def _create(
        id: UUID = None,
        name: str = None,
        category = None,
        amount: Decimal = Decimal("1000000"),
        **kwargs
    ):
        from app.models.fixed_expense import FixedExpense, FixedExpenseType, RecurrenceFrequency
        from app.models.accounting import ExpenseCategory

        unique_id = uuid4().hex[:6]
        return FixedExpense(
            id=id or uuid4(),
            name=name or f"Gasto Fijo {unique_id}",
            category=category or ExpenseCategory.RENT,
            expense_type=FixedExpenseType.EXACT,
            amount=amount,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            day_of_month=1,
            is_active=True,
            **kwargs
        )
    return _create


@pytest.fixture
def notification_factory():
    """Factory for creating Notification instances."""
    def _create(
        id: UUID = None,
        user_id: UUID = None,
        school_id: UUID = None,
        title: str = None,
        message: str = "Test notification message",
        **kwargs
    ):
        from app.models.notification import Notification, NotificationType, ReferenceType

        unique_id = uuid4().hex[:6]
        return Notification(
            id=id or uuid4(),
            user_id=user_id,
            school_id=school_id,
            type=NotificationType.NEW_WEB_ORDER,
            title=title or f"Notification {unique_id}",
            message=message,
            is_read=False,
            **kwargs
        )
    return _create
