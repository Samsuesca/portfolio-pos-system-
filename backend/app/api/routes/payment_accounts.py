"""
Payment Accounts Endpoints

API routes for managing payment account information (bank accounts, QR codes).
Admin can configure these, and they're displayed publicly in the web portal.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.api.dependencies import DatabaseSession, CurrentUser
from app.models.payment_account import PaymentAccount
from app.schemas.payment_account import (
    PaymentAccountCreate,
    PaymentAccountUpdate,
    PaymentAccountResponse,
    PaymentAccountPublic
)

router = APIRouter(prefix="/payment-accounts", tags=["Payment Accounts"])


# ==========================================
# Public Endpoints (for web portal)
# ==========================================

@router.get(
    "/public",
    response_model=List[PaymentAccountPublic],
    summary="Get active payment accounts (PUBLIC)"
)
async def get_public_payment_accounts(db: DatabaseSession):
    """
    Get all active payment accounts for display in web portal.
    NO authentication required - this is public information.

    Returns only active accounts, ordered by display_order.

    Example:
        ```
        GET /api/v1/payment-accounts/public
        ```
    """
    query = (
        select(PaymentAccount)
        .where(PaymentAccount.is_active == True)
        .order_by(PaymentAccount.display_order.asc())
    )

    result = await db.execute(query)
    accounts = result.scalars().all()

    return [PaymentAccountPublic.model_validate(acc) for acc in accounts]


# ==========================================
# Admin Endpoints (authentication required)
# ==========================================

@router.get(
    "",
    response_model=List[PaymentAccountResponse],
    summary="List all payment accounts (ADMIN)"
)
async def list_payment_accounts(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    List all payment accounts (active and inactive).

    Requires authentication. Returns all accounts ordered by display_order.

    Args:
        db: Database session
        current_user: Current authenticated user

    Returns:
        List[PaymentAccountResponse]: List of all payment accounts
    """
    query = select(PaymentAccount).order_by(PaymentAccount.display_order.asc())

    result = await db.execute(query)
    accounts = result.scalars().all()

    return [PaymentAccountResponse.model_validate(acc) for acc in accounts]


@router.post(
    "",
    response_model=PaymentAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create payment account (ADMIN)"
)
async def create_payment_account(
    account_data: PaymentAccountCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Create a new payment account.

    Requires authentication (admin/superuser).

    Args:
        account_data: Payment account data
        db: Database session
        current_user: Current authenticated user

    Returns:
        PaymentAccountResponse: The created payment account

    Example:
        ```
        POST /api/v1/payment-accounts
        {
            "method_type": "nequi",
            "account_name": "Nequi Consuelo Ríos",
            "account_number": "3001234567",
            "account_holder": "Consuelo Ríos",
            "qr_code_url": "/uploads/qr/nequi.png",
            "display_order": 0,
            "is_active": true
        }
        ```
    """
    account = PaymentAccount(
        method_type=account_data.method_type,
        account_name=account_data.account_name,
        account_number=account_data.account_number,
        account_holder=account_data.account_holder,
        bank_name=account_data.bank_name,
        account_type=account_data.account_type,
        qr_code_url=account_data.qr_code_url,
        instructions=account_data.instructions,
        display_order=account_data.display_order,
        is_active=account_data.is_active
    )

    db.add(account)
    await db.commit()
    await db.refresh(account)

    return PaymentAccountResponse.model_validate(account)


@router.get(
    "/{account_id}",
    response_model=PaymentAccountResponse,
    summary="Get payment account by ID (ADMIN)"
)
async def get_payment_account(
    account_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Get payment account by ID.

    Requires authentication.

    Args:
        account_id: Payment account ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        PaymentAccountResponse: Payment account details

    Raises:
        HTTPException: 404 if account not found
    """
    query = select(PaymentAccount).where(PaymentAccount.id == account_id)

    result = await db.execute(query)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment account not found"
        )

    return PaymentAccountResponse.model_validate(account)


@router.put(
    "/{account_id}",
    response_model=PaymentAccountResponse,
    summary="Update payment account (ADMIN)"
)
async def update_payment_account(
    account_id: UUID,
    update_data: PaymentAccountUpdate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Update payment account.

    Requires authentication (admin/superuser).

    Args:
        account_id: Payment account ID
        update_data: Fields to update
        db: Database session
        current_user: Current authenticated user

    Returns:
        PaymentAccountResponse: Updated payment account

    Raises:
        HTTPException: 404 if account not found
    """
    query = select(PaymentAccount).where(PaymentAccount.id == account_id)

    result = await db.execute(query)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment account not found"
        )

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)

    return PaymentAccountResponse.model_validate(account)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete payment account (ADMIN)"
)
async def delete_payment_account(
    account_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Delete payment account.

    Requires authentication (admin/superuser).

    Args:
        account_id: Payment account ID
        db: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: 404 if account not found
    """
    query = select(PaymentAccount).where(PaymentAccount.id == account_id)

    result = await db.execute(query)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment account not found"
        )

    await db.delete(account)
    await db.commit()
