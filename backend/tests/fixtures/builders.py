"""
Request payload builders for API tests.

These builders create valid request payloads that can be customized
with overrides for testing different scenarios.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4


# ============================================================================
# SALE BUILDERS
# ============================================================================

def build_sale_request(
    school_id: UUID | str | None = None,
    client_id: UUID | str | None = None,
    items: list[dict] | None = None,
    payment_method: str = "cash",
    paid_amount: Decimal | float | None = None,
    notes: str | None = None,
    is_historical: bool = False,
    sale_date: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a SaleCreate request payload.

    Args:
        school_id: School ID (required)
        client_id: Optional client ID
        items: List of sale items (uses default if not provided)
        payment_method: Payment method (cash, nequi, transfer, card, credit)
        paid_amount: Amount paid (defaults to total if not specified)
        notes: Optional notes
        is_historical: Whether this is a historical sale
        sale_date: Date string for historical sales (ISO format with time)
        **overrides: Additional fields to override

    Returns:
        Sale request payload dictionary
    """
    payload = {
        "school_id": str(school_id) if school_id else str(uuid4()),
        "client_id": str(client_id) if client_id else None,
        "items": items or [build_sale_item()],
        "payment_method": payment_method,
        "notes": notes,
        "is_historical": is_historical,
    }

    if paid_amount is not None:
        payload["paid_amount"] = float(paid_amount)

    if sale_date:
        # Ensure sale_date includes time for datetime parsing
        if "T" not in sale_date and " " not in sale_date:
            sale_date = f"{sale_date}T00:00:00"
        payload["sale_date"] = sale_date

    payload.update(overrides)
    return payload


def build_sale_item(
    product_id: UUID | str | None = None,
    quantity: int = 1,
    unit_price: Decimal | float | None = None,
    size: str | None = None,
    color: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a SaleItemCreate payload.

    Args:
        product_id: Product ID (generated if not provided)
        quantity: Quantity to sell
        unit_price: Unit price (uses product price if not specified)
        size: Size override
        color: Color override
        **overrides: Additional fields

    Returns:
        Sale item payload dictionary
    """
    payload = {
        "product_id": str(product_id) if product_id else str(uuid4()),
        "quantity": quantity,
    }

    if unit_price is not None:
        payload["unit_price"] = float(unit_price)

    if size:
        payload["size"] = size

    if color:
        payload["color"] = color

    payload.update(overrides)
    return payload


def build_sale_change_request(
    original_item_id: UUID | str | None = None,
    change_type: str = "return",
    returned_quantity: int = 1,
    reason: str = "Cambio de talla",
    new_product_id: UUID | str | None = None,
    new_quantity: int = 0,
    **overrides
) -> dict[str, Any]:
    """
    Build a SaleChangeCreate request payload.

    Args:
        original_item_id: Original sale item ID
        change_type: Type of change (size_change, product_change, return, defect)
        returned_quantity: Quantity being returned/changed
        reason: Reason for change
        new_product_id: New product ID for exchanges (required for size_change, product_change, defect)
        new_quantity: Quantity of new product (required for non-return changes)
        **overrides: Additional fields

    Returns:
        Sale change request payload
    """
    payload = {
        "original_item_id": str(original_item_id) if original_item_id else str(uuid4()),
        "change_type": change_type,
        "returned_quantity": returned_quantity,
        "reason": reason,
    }

    # For non-return changes, new_product_id and new_quantity are required
    if change_type != "return":
        if new_product_id:
            payload["new_product_id"] = str(new_product_id)
        if new_quantity > 0:
            payload["new_quantity"] = new_quantity

    payload.update(overrides)
    return payload


# ============================================================================
# ORDER BUILDERS
# ============================================================================

def build_order_request(
    client_id: UUID | str | None = None,
    items: list[dict] | None = None,
    advance_payment: Decimal | float | None = None,
    advance_payment_method: str | None = None,
    delivery_date: str | None = None,
    notes: str | None = None,
    source: str = "desktop_app",
    **overrides
) -> dict[str, Any]:
    """
    Build an OrderCreate request payload.

    Note: school_id is set from URL path, not in body.

    Args:
        client_id: Client ID (required)
        items: List of order items (each with garment_type_id, quantity, unit_price)
        advance_payment: Initial payment amount
        advance_payment_method: Payment method for advance (cash, nequi, transfer, card)
        delivery_date: Expected delivery date (YYYY-MM-DD)
        notes: Optional notes
        source: Order source (desktop_app, web_portal, api)
        **overrides: Additional fields

    Returns:
        Order request payload
    """
    payload = {
        "client_id": str(client_id) if client_id else str(uuid4()),
        "items": items or [build_order_item()],
        "notes": notes,
        "source": source,
    }

    if advance_payment is not None and advance_payment > 0:
        payload["advance_payment"] = float(advance_payment)
        payload["advance_payment_method"] = advance_payment_method or "cash"

    if delivery_date:
        payload["delivery_date"] = delivery_date

    payload.update(overrides)
    return payload


def build_order_item(
    garment_type_id: UUID | str | None = None,
    product_id: UUID | str | None = None,
    quantity: int = 1,
    unit_price: Decimal | float = 50000,
    order_type: str = "custom",
    size: str = "M",
    color: str | None = None,
    custom_measurements: dict | None = None,
    notes: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build an OrderItemCreate payload.

    Args:
        garment_type_id: Garment type ID (required for custom orders)
        product_id: Product ID (for catalog/yomber orders)
        quantity: Quantity
        unit_price: Price per unit
        order_type: Order type (custom, catalog, yomber, web_custom)
        size: Size
        color: Color
        custom_measurements: Custom measurements dict
        notes: Item notes
        **overrides: Additional fields

    Returns:
        Order item payload
    """
    payload = {
        "quantity": quantity,
        "unit_price": float(unit_price),
        "order_type": order_type,
    }

    if garment_type_id:
        payload["garment_type_id"] = str(garment_type_id)

    if product_id:
        payload["product_id"] = str(product_id)

    if size:
        payload["size"] = size

    if color:
        payload["color"] = color

    if custom_measurements:
        payload["custom_measurements"] = custom_measurements

    if notes:
        payload["notes"] = notes

    payload.update(overrides)
    return payload


def build_web_order_request(
    school_slug: str = "test-school",
    client_name: str = "Test Client",
    client_phone: str = "3001234567",
    client_email: str = "test@example.com",
    student_name: str = "Test Student",
    student_grade: str = "5A",
    items: list[dict] | None = None,
    notes: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a web portal order request.

    Args:
        school_slug: School slug/code
        client_name: Client name
        client_phone: Client phone
        client_email: Client email
        student_name: Student name
        student_grade: Student grade
        items: Order items
        notes: Order notes
        **overrides: Additional fields

    Returns:
        Web order request payload
    """
    payload = {
        "school_slug": school_slug,
        "client_name": client_name,
        "client_phone": client_phone,
        "client_email": client_email,
        "student_name": student_name,
        "student_grade": student_grade,
        "items": items or [build_order_item()],
        "notes": notes,
    }

    payload.update(overrides)
    return payload


def build_order_payment(
    amount: Decimal | float,
    payment_method: str = "cash",
    notes: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build an order payment request.

    Args:
        amount: Payment amount
        payment_method: Payment method
        notes: Payment notes
        **overrides: Additional fields

    Returns:
        Payment request payload
    """
    payload = {
        "amount": float(amount),
        "payment_method": payment_method,
    }

    if notes:
        payload["notes"] = notes

    payload.update(overrides)
    return payload


# ============================================================================
# ACCOUNTING BUILDERS
# ============================================================================

def build_expense_request(
    description: str = "Test Expense",
    amount: Decimal | float = 100000,
    category: str = "servicios",
    payment_method: str | None = None,
    is_paid: bool = False,
    due_date: str | None = None,
    school_id: UUID | str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build an ExpenseCreate request.

    Args:
        description: Expense description
        amount: Expense amount
        category: Expense category
        payment_method: Payment method (if paid immediately)
        is_paid: Whether expense is already paid
        due_date: Due date for unpaid expenses
        school_id: Optional school ID
        **overrides: Additional fields

    Returns:
        Expense request payload
    """
    payload = {
        "description": description,
        "amount": float(amount),
        "category": category,
        "is_paid": is_paid,
    }

    if payment_method:
        payload["payment_method"] = payment_method

    if due_date:
        payload["due_date"] = due_date

    if school_id:
        payload["school_id"] = str(school_id)

    payload.update(overrides)
    return payload


def build_balance_account_request(
    name: str = "Test Account",
    account_type: str = "asset_current",
    code: str | None = None,
    description: str | None = None,
    balance: Decimal | float = 0,
    school_id: UUID | str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a BalanceAccountCreate request.

    Args:
        name: Account name
        account_type: Account type (asset_current, liability_current, etc.)
        code: Account code
        description: Account description
        balance: Initial balance
        school_id: Optional school ID (None for global)
        **overrides: Additional fields

    Returns:
        Balance account request payload
    """
    payload = {
        "name": name,
        "account_type": account_type,
        "balance": float(balance),
    }

    if code:
        payload["code"] = code

    if description:
        payload["description"] = description

    if school_id:
        payload["school_id"] = str(school_id)

    payload.update(overrides)
    return payload


def build_receivable_request(
    client_id: UUID | str | None = None,
    client_name: str = "Test Client",
    amount: Decimal | float = 50000,
    description: str = "Cuenta por cobrar de prueba",
    due_date: str | None = None,
    school_id: UUID | str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build an AccountsReceivableCreate request.

    Args:
        client_id: Optional client ID
        client_name: Client name (if no client_id)
        amount: Amount owed
        description: Description
        due_date: Due date
        school_id: Optional school ID
        **overrides: Additional fields

    Returns:
        Receivable request payload
    """
    payload = {
        "amount": float(amount),
        "description": description,
    }

    if client_id:
        payload["client_id"] = str(client_id)
    else:
        payload["client_name"] = client_name

    if due_date:
        payload["due_date"] = due_date

    if school_id:
        payload["school_id"] = str(school_id)

    payload.update(overrides)
    return payload


def build_payable_request(
    supplier_name: str = "Proveedor Test",
    amount: Decimal | float = 100000,
    description: str = "Cuenta por pagar de prueba",
    due_date: str | None = None,
    school_id: UUID | str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build an AccountsPayableCreate request.

    Args:
        supplier_name: Supplier/creditor name
        amount: Amount owed
        description: Description
        due_date: Due date
        school_id: Optional school ID
        **overrides: Additional fields

    Returns:
        Payable request payload
    """
    payload = {
        "supplier_name": supplier_name,
        "amount": float(amount),
        "description": description,
    }

    if due_date:
        payload["due_date"] = due_date

    if school_id:
        payload["school_id"] = str(school_id)

    payload.update(overrides)
    return payload


# ============================================================================
# PRODUCT BUILDERS
# ============================================================================

def build_product_request(
    name: str = "Test Product",
    school_id: UUID | str | None = None,
    garment_type_id: UUID | str | None = None,
    size: str = "M",
    color: str = "Blanco",
    price: Decimal | float = 50000,
    code: str | None = None,
    barcode: str | None = None,
    is_active: bool = True,
    **overrides
) -> dict[str, Any]:
    """
    Build a ProductCreate request.

    Args:
        name: Product name
        school_id: School ID (required)
        garment_type_id: Garment type ID
        size: Size
        color: Color
        price: Price
        code: Product code
        barcode: Barcode
        is_active: Active status
        **overrides: Additional fields

    Returns:
        Product request payload
    """
    payload = {
        "name": name,
        "school_id": str(school_id) if school_id else str(uuid4()),
        "garment_type_id": str(garment_type_id) if garment_type_id else str(uuid4()),
        "size": size,
        "color": color,
        "price": float(price),
        "is_active": is_active,
    }

    if code:
        payload["code"] = code

    if barcode:
        payload["barcode"] = barcode

    payload.update(overrides)
    return payload


def build_garment_type_request(
    name: str = "Camisa",
    school_id: UUID | str | None = None,
    category: str = "uniforme_diario",
    description: str | None = None,
    requires_embroidery: bool = False,
    has_custom_measurements: bool = False,
    is_active: bool = True,
    **overrides
) -> dict[str, Any]:
    """
    Build a GarmentTypeCreate request.

    Args:
        name: Garment type name
        school_id: School ID (required)
        category: Category (uniforme_diario, uniforme_deportivo, etc.)
        description: Description
        requires_embroidery: Whether requires embroidery
        has_custom_measurements: Whether has custom measurements
        is_active: Active status
        **overrides: Additional fields

    Returns:
        Garment type request payload
    """
    payload = {
        "name": name,
        "school_id": str(school_id) if school_id else str(uuid4()),
        "category": category,
        "is_active": is_active,
        "requires_embroidery": requires_embroidery,
        "has_custom_measurements": has_custom_measurements,
    }

    if description:
        payload["description"] = description

    payload.update(overrides)
    return payload


# ============================================================================
# CLIENT BUILDERS
# ============================================================================

def build_client_request(
    name: str = "Test Client",
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    student_name: str | None = None,
    student_grade: str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a ClientCreate request.

    Args:
        name: Client name
        phone: Phone number
        email: Email address
        address: Physical address
        student_name: Student name
        student_grade: Student grade
        **overrides: Additional fields

    Returns:
        Client request payload
    """
    payload = {
        "name": name,
    }

    if phone:
        payload["phone"] = phone

    if email:
        payload["email"] = email

    if address:
        payload["address"] = address

    if student_name:
        payload["student_name"] = student_name

    if student_grade:
        payload["student_grade"] = student_grade

    payload.update(overrides)
    return payload


# ============================================================================
# USER & AUTH BUILDERS
# ============================================================================

def build_login_request(
    username: str = "admin",
    password: str = "password123",
    **overrides
) -> dict[str, Any]:
    """
    Build a login request.

    Args:
        username: Username
        password: Password
        **overrides: Additional fields

    Returns:
        Login request payload
    """
    payload = {
        "username": username,
        "password": password,
    }
    payload.update(overrides)
    return payload


def build_user_request(
    username: str | None = None,
    email: str | None = None,
    password: str = "TestPassword123!",
    full_name: str = "Test User",
    is_active: bool = True,
    is_superuser: bool = False,
    **overrides
) -> dict[str, Any]:
    """
    Build a UserCreate request.

    Args:
        username: Username (generated if not provided)
        email: Email (generated if not provided)
        password: Password
        full_name: Full name
        is_active: Active status
        is_superuser: Superuser status
        **overrides: Additional fields

    Returns:
        User request payload
    """
    unique = uuid4().hex[:6]
    payload = {
        "username": username or f"user_{unique}",
        "email": email or f"user_{unique}@test.com",
        "password": password,
        "full_name": full_name,
        "is_active": is_active,
        "is_superuser": is_superuser,
    }
    payload.update(overrides)
    return payload


# ============================================================================
# SCHOOL BUILDERS
# ============================================================================

def build_school_request(
    name: str = "Test School",
    code: str | None = None,
    slug: str | None = None,
    address: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    is_active: bool = True,
    **overrides
) -> dict[str, Any]:
    """
    Build a SchoolCreate request.

    Args:
        name: School name
        code: School code
        slug: URL slug
        address: Address
        phone: Phone
        email: Email
        is_active: Active status
        **overrides: Additional fields

    Returns:
        School request payload
    """
    unique = uuid4().hex[:4].upper()
    payload = {
        "name": name,
        "code": code or f"TST-{unique}",
        "is_active": is_active,
    }

    if slug:
        payload["slug"] = slug

    if address:
        payload["address"] = address

    if phone:
        payload["phone"] = phone

    if email:
        payload["email"] = email

    payload.update(overrides)
    return payload


# ============================================================================
# CONTACT/PQRS BUILDERS
# ============================================================================

def build_contact_request(
    name: str = "Test Contact",
    email: str = "contact@test.com",
    phone: str | None = None,
    contact_type: str = "inquiry",
    subject: str = "Test Subject",
    message: str = "Test message content",
    school_id: UUID | str | None = None,
    **overrides
) -> dict[str, Any]:
    """
    Build a ContactCreate (PQRS) request.

    Args:
        name: Contact name
        email: Email address
        phone: Phone number
        contact_type: Type (inquiry, request, complaint, claim, suggestion)
        subject: Subject line
        message: Message content
        school_id: Optional school ID
        **overrides: Additional fields

    Returns:
        Contact request payload
    """
    payload = {
        "name": name,
        "email": email,
        "contact_type": contact_type,
        "subject": subject,
        "message": message,
    }

    if phone:
        payload["phone"] = phone

    if school_id:
        payload["school_id"] = str(school_id)

    payload.update(overrides)
    return payload


# ============================================================================
# PAYMENT ACCOUNT BUILDERS
# ============================================================================

def build_payment_account_request(
    account_type: str = "bank",
    bank_name: str | None = None,
    account_number: str | None = None,
    account_holder: str | None = None,
    phone_number: str | None = None,
    is_active: bool = True,
    **overrides
) -> dict[str, Any]:
    """
    Build a PaymentAccountCreate request.

    Args:
        account_type: Type (bank, nequi, daviplata)
        bank_name: Bank name
        account_number: Account number
        account_holder: Account holder name
        phone_number: Phone for mobile payments
        is_active: Active status
        **overrides: Additional fields

    Returns:
        Payment account request payload
    """
    payload = {
        "account_type": account_type,
        "is_active": is_active,
    }

    if bank_name:
        payload["bank_name"] = bank_name

    if account_number:
        payload["account_number"] = account_number

    if account_holder:
        payload["account_holder"] = account_holder

    if phone_number:
        payload["phone_number"] = phone_number

    payload.update(overrides)
    return payload
