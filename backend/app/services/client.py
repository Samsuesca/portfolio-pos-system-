"""
Client Service

Clients are GLOBAL - they can purchase from multiple schools.
This service handles both regular clients (created by staff) and
web clients (self-registered via web portal).
"""
import logging
from uuid import UUID
from datetime import datetime, timedelta
import secrets
from typing import Optional

logger = logging.getLogger(__name__)

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from passlib.context import CryptContext
from jose import jwt

from app.utils.timezone import get_colombia_now_naive
from app.core.config import settings
from app.models.client import Client, ClientStudent, ClientType
from app.models.sale import Sale
from app.models.order import Order
from app.models.school import School
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientSummary,
    ClientStudentCreate,
    ClientStudentUpdate,
    ClientWebRegister,
)
from app.services.base import BaseService


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ClientService(BaseService[Client]):
    """
    Service for Client operations.

    Clients are GLOBAL - not tied to a specific school.
    Authentication is only required for web portal clients.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(Client, db)

    # ==========================================================================
    # CRUD Operations (Global - no school_id filtering)
    # ==========================================================================

    async def create_client(
        self,
        client_data: ClientCreate,
        created_by_user_id: Optional[UUID] = None
    ) -> Client:
        """
        Create a new regular client (by staff).
        If email provided, sends activation link.

        If a client with the same email exists but is inactive (soft deleted),
        the existing client will be reactivated with the new data.

        Args:
            client_data: Client creation data
            created_by_user_id: ID of the user creating the client (optional)

        Returns:
            Created or reactivated client
        """
        # Check if there's an inactive client with the same email
        if client_data.email:
            existing = await self.get_by_email(client_data.email)
            if existing:
                if existing.is_active:
                    raise ValueError("Ya existe un cliente activo con este email")
                # Reactivate the existing client with new data
                return await self._reactivate_client(existing, client_data)

        # Check if there's an inactive client with the same phone
        if client_data.phone:
            existing_by_phone = await self.get_by_phone(client_data.phone)
            if existing_by_phone and not existing_by_phone.is_active:
                # Reactivate the existing client with new data
                return await self._reactivate_client(existing_by_phone, client_data)

        # Generate global client code
        code = await self._generate_client_code()

        client_dict = client_data.model_dump(exclude={'students'})
        client_dict['code'] = code
        client_dict['client_type'] = ClientType.REGULAR

        # Generate activation token if email provided
        activation_token = None
        if client_data.email:
            activation_token = secrets.token_urlsafe(32)
            client_dict['verification_token'] = activation_token
            client_dict['verification_token_expires'] = get_colombia_now_naive() + timedelta(days=7)

        # Create the client
        client = await self.create(client_dict)

        # Create students if provided
        if client_data.students:
            for student_data in client_data.students:
                await self.add_student(client.id, student_data)

        # Refresh to load relationships
        await self.db.refresh(client, ['students'])

        # NOTE: Welcome email with activation link is now sent on first transaction
        # (order or sale), not on client creation. See order.py and sale.py routes.

        return client

    async def _reactivate_client(
        self,
        existing_client: Client,
        client_data: ClientCreate
    ) -> Client:
        """
        Reactivate an inactive (soft deleted) client with new data.

        This preserves the client's purchase history while updating their info.

        Args:
            existing_client: The inactive client to reactivate
            client_data: New client data

        Returns:
            Reactivated client
        """
        # Update client with new data
        update_dict = client_data.model_dump(exclude={'students'}, exclude_unset=True)

        for key, value in update_dict.items():
            if value is not None:
                setattr(existing_client, key, value)

        # Reactivate
        existing_client.is_active = True

        # Reset welcome email flag so they get a new activation email on first transaction
        existing_client.welcome_email_sent = False
        existing_client.welcome_email_sent_at = None

        # Generate new activation token if email provided
        if client_data.email:
            existing_client.verification_token = secrets.token_urlsafe(32)
            existing_client.verification_token_expires = get_colombia_now_naive() + timedelta(days=7)
            existing_client.is_verified = False

        await self.db.flush()

        # Handle students - deactivate old ones and create new ones if provided
        if client_data.students:
            # Deactivate existing students
            for student in existing_client.students:
                student.is_active = False

            # Add new students
            for student_data in client_data.students:
                await self.add_student(existing_client.id, student_data)

        await self.db.refresh(existing_client, ['students'])

        logger.info(f"Reactivated client {existing_client.code} ({existing_client.name})")
        return existing_client

    async def register_web_client(
        self,
        registration_data: ClientWebRegister
    ) -> Client:
        """
        Register a new web portal client.

        Args:
            registration_data: Web registration data

        Returns:
            Created client (unverified)

        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists (only check active clients)
        existing = await self.get_by_email(registration_data.email)
        if existing and existing.is_active:
            raise ValueError("Email already registered")

        # Generate code and verification token
        code = await self._generate_client_code()
        verification_token = secrets.token_urlsafe(32)
        token_expires = get_colombia_now_naive() + timedelta(hours=24)

        # Hash password
        password_hash = pwd_context.hash(registration_data.password)

        # Create client
        client = Client(
            code=code,
            name=registration_data.name,
            email=registration_data.email,
            phone=registration_data.phone,
            password_hash=password_hash,
            client_type=ClientType.WEB,
            is_verified=False,
            verification_token=verification_token,
            verification_token_expires=token_expires,
        )
        self.db.add(client)
        await self.db.flush()
        await self.db.refresh(client)

        # Create students
        for student_data in registration_data.students:
            await self.add_student(client.id, student_data)

        await self.db.refresh(client, ['students'])
        return client

    async def verify_email(self, token: str) -> Client | None:
        """
        Verify client email with token.

        Args:
            token: Verification token

        Returns:
            Verified client or None if token invalid/expired
        """
        result = await self.db.execute(
            select(Client).where(
                Client.verification_token == token,
                Client.verification_token_expires > get_colombia_now_naive(),
                Client.is_verified == False
            )
        )
        client = result.scalar_one_or_none()

        if client:
            client.is_verified = True
            client.verification_token = None
            client.verification_token_expires = None
            await self.db.flush()
            await self.db.refresh(client)

        return client

    async def authenticate_web_client(
        self,
        email: str,
        password: str
    ) -> Client | None:
        """
        Authenticate a web client.

        Args:
            email: Client email
            password: Client password

        Returns:
            Client if authenticated, None otherwise
        """
        client = await self.get_by_email(email)
        if not client:
            return None

        # Check if client is active
        if not client.is_active:
            return None

        # Allow both WEB and REGULAR clients with password_hash to login
        if not client.password_hash:
            return None
        if not pwd_context.verify(password, client.password_hash):
            return None

        # Update last login
        client.last_login = get_colombia_now_naive()
        await self.db.flush()

        return client

    async def update_client(
        self,
        client_id: UUID,
        client_data: ClientUpdate
    ) -> Client | None:
        """
        Update a client.

        Args:
            client_id: Client UUID
            client_data: Update data

        Returns:
            Updated client or None if not found
        """
        update_dict = client_data.model_dump(exclude_unset=True)
        return await self.update(client_id, update_dict)

    async def get_with_students(self, client_id: UUID) -> Client | None:
        """
        Get client with all students loaded.

        Args:
            client_id: Client UUID

        Returns:
            Client with students or None
        """
        result = await self.db.execute(
            select(Client)
            .options(selectinload(Client.students).selectinload(ClientStudent.school))
            .where(Client.id == client_id)
        )
        return result.scalar_one_or_none()

    async def get_all_clients(
        self,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        client_type: ClientType | None = None,
        is_active: bool | None = True
    ) -> list[Client]:
        """
        Get all clients (global).

        Args:
            skip: Pagination offset
            limit: Maximum results
            search: Search term (code, name, email, phone)
            client_type: Filter by client type
            is_active: Filter by active status

        Returns:
            List of clients
        """
        query = select(Client).options(selectinload(Client.students))

        # Apply filters
        if is_active is not None:
            query = query.where(Client.is_active == is_active)

        if client_type is not None:
            query = query.where(Client.client_type == client_type)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Client.code.ilike(search_term),
                    Client.name.ilike(search_term),
                    Client.email.ilike(search_term),
                    Client.phone.ilike(search_term),
                    Client.student_name.ilike(search_term)
                )
            )

        query = query.offset(skip).limit(limit).order_by(Client.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def search_clients(
        self,
        search_term: str,
        limit: int = 20
    ) -> list[Client]:
        """
        Search clients by code, name, email, phone, or student name.

        Args:
            search_term: Search term
            limit: Maximum results

        Returns:
            List of matching clients
        """
        result = await self.db.execute(
            select(Client)
            .options(selectinload(Client.students))
            .where(
                Client.is_active == True,
                or_(
                    Client.code.ilike(f"%{search_term}%"),
                    Client.name.ilike(f"%{search_term}%"),
                    Client.email.ilike(f"%{search_term}%"),
                    Client.phone.ilike(f"%{search_term}%"),
                    Client.student_name.ilike(f"%{search_term}%")
                )
            )
            .limit(limit)
            .order_by(Client.name)
        )
        return list(result.scalars().all())

    async def get_by_code(self, code: str) -> Client | None:
        """Get client by code (globally unique)."""
        result = await self.db.execute(
            select(Client).where(Client.code == code)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Client | None:
        """Get client by email."""
        result = await self.db.execute(
            select(Client).where(func.lower(Client.email) == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Client | None:
        """Get client by phone number."""
        result = await self.db.execute(
            select(Client).where(Client.phone == phone)
        )
        return result.scalar_one_or_none()

    # ==========================================================================
    # Student Management
    # ==========================================================================

    async def add_student(
        self,
        client_id: UUID,
        student_data: ClientStudentCreate
    ) -> ClientStudent:
        """
        Add a student to a client.

        Args:
            client_id: Client UUID
            student_data: Student data

        Returns:
            Created student
        """
        student = ClientStudent(
            client_id=client_id,
            school_id=student_data.school_id,
            student_name=student_data.student_name,
            student_grade=student_data.student_grade,
            student_section=student_data.student_section,
            notes=student_data.notes,
        )
        self.db.add(student)
        await self.db.flush()
        await self.db.refresh(student)
        return student

    async def update_student(
        self,
        student_id: UUID,
        student_data: ClientStudentUpdate
    ) -> ClientStudent | None:
        """
        Update a client student.

        Args:
            student_id: Student UUID
            student_data: Update data

        Returns:
            Updated student or None
        """
        result = await self.db.execute(
            select(ClientStudent).where(ClientStudent.id == student_id)
        )
        student = result.scalar_one_or_none()

        if not student:
            return None

        update_dict = student_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                setattr(student, key, value)

        await self.db.flush()
        await self.db.refresh(student)
        return student

    async def remove_student(self, student_id: UUID) -> bool:
        """
        Remove a student from a client.

        Args:
            student_id: Student UUID

        Returns:
            True if removed
        """
        result = await self.db.execute(
            select(ClientStudent).where(ClientStudent.id == student_id)
        )
        student = result.scalar_one_or_none()

        if student:
            await self.db.delete(student)
            await self.db.flush()
            return True
        return False

    async def get_students_by_school(
        self,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> list[ClientStudent]:
        """
        Get all students for a specific school.

        Args:
            school_id: School UUID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of students
        """
        result = await self.db.execute(
            select(ClientStudent)
            .options(selectinload(ClientStudent.client))
            .where(
                ClientStudent.school_id == school_id,
                ClientStudent.is_active == True
            )
            .offset(skip)
            .limit(limit)
            .order_by(ClientStudent.student_name)
        )
        return list(result.scalars().all())

    # ==========================================================================
    # Client Summary & Statistics
    # ==========================================================================

    async def get_client_summary(self, client_id: UUID) -> ClientSummary | None:
        """
        Get client with purchase statistics across all schools.

        Args:
            client_id: Client UUID

        Returns:
            ClientSummary or None
        """
        client = await self.get_with_students(client_id)
        if not client:
            return None

        # Count total purchases (completed sales across all schools)
        total_purchases_result = await self.db.execute(
            select(func.count(Sale.id)).where(
                Sale.client_id == client_id,
                Sale.status == "completed"
            )
        )

        # Sum total spent
        total_spent_result = await self.db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.client_id == client_id,
                Sale.status == "completed"
            )
        )

        # Count pending orders
        pending_orders_result = await self.db.execute(
            select(func.count(Order.id)).where(
                Order.client_id == client_id,
                Order.status.in_(["pending", "in_production"])
            )
        )

        # Get last purchase date
        last_purchase_result = await self.db.execute(
            select(Sale.created_at).where(
                Sale.client_id == client_id,
                Sale.status == "completed"
            ).order_by(Sale.created_at.desc()).limit(1)
        )

        # Get schools where client has students
        schools_result = await self.db.execute(
            select(School.name)
            .join(ClientStudent, ClientStudent.school_id == School.id)
            .where(ClientStudent.client_id == client_id, ClientStudent.is_active == True)
            .distinct()
        )

        last_purchase_date = last_purchase_result.scalar_one_or_none()

        return ClientSummary(
            id=client.id,
            code=client.code,
            name=client.name,
            phone=client.phone,
            email=client.email,
            student_name=client.student_name,
            client_type=client.client_type,
            total_purchases=total_purchases_result.scalar_one(),
            total_spent=float(total_spent_result.scalar_one()),
            pending_orders=pending_orders_result.scalar_one(),
            last_purchase_date=last_purchase_date.isoformat() if last_purchase_date else None,
            schools=list(schools_result.scalars().all())
        )

    async def get_top_clients(self, limit: int = 10) -> list[ClientSummary]:
        """
        Get top clients by total spent (global).

        Args:
            limit: Number of clients to return

        Returns:
            List of top clients
        """
        result = await self.db.execute(
            select(
                Client.id,
                Client.code,
                Client.name,
                Client.phone,
                Client.email,
                Client.student_name,
                Client.client_type,
                func.coalesce(func.sum(Sale.total), 0).label('total_spent'),
                func.count(Sale.id).label('total_purchases')
            )
            .outerjoin(Sale, Sale.client_id == Client.id)
            .where(Client.is_active == True)
            .group_by(Client.id)
            .order_by(func.coalesce(func.sum(Sale.total), 0).desc())
            .limit(limit)
        )

        return [
            ClientSummary(
                id=row.id,
                code=row.code,
                name=row.name,
                phone=row.phone,
                email=row.email,
                student_name=row.student_name,
                client_type=row.client_type,
                total_purchases=row.total_purchases,
                total_spent=float(row.total_spent),
                pending_orders=0,
                last_purchase_date=None,
                schools=[]
            )
            for row in result.all()
        ]

    # ==========================================================================
    # Password Management (Web Clients)
    # ==========================================================================

    async def request_password_reset(self, email: str) -> str | None:
        """
        Generate password reset token.

        Args:
            email: Client email

        Returns:
            Reset token or None if client not found
        """
        client = await self.get_by_email(email)
        if not client or client.client_type != ClientType.WEB:
            return None

        token = secrets.token_urlsafe(32)
        client.verification_token = token
        client.verification_token_expires = get_colombia_now_naive() + timedelta(hours=1)
        await self.db.flush()

        return token

    async def reset_password(self, token: str, new_password: str) -> bool:
        """
        Reset password with token.

        Args:
            token: Reset token
            new_password: New password

        Returns:
            True if password reset successfully
        """
        result = await self.db.execute(
            select(Client).where(
                Client.verification_token == token,
                Client.verification_token_expires > get_colombia_now_naive()
            )
        )
        client = result.scalar_one_or_none()

        if not client:
            return False

        client.password_hash = pwd_context.hash(new_password)
        client.verification_token = None
        client.verification_token_expires = None
        await self.db.flush()

        return True

    async def change_password(
        self,
        client_id: UUID,
        current_password: str,
        new_password: str
    ) -> bool:
        """
        Change client password (authenticated).

        Args:
            client_id: Client UUID
            current_password: Current password
            new_password: New password

        Returns:
            True if password changed successfully
        """
        client = await self.get(client_id)
        if not client or not client.password_hash:
            return False

        if not pwd_context.verify(current_password, client.password_hash):
            return False

        client.password_hash = pwd_context.hash(new_password)
        await self.db.flush()

        return True

    # ==========================================================================
    # Helpers
    # ==========================================================================

    async def _generate_client_code(self) -> str:
        """
        Generate globally unique client code.

        Format: CLI-{sequence:05d}
        Example: CLI-00001, CLI-00002, etc.

        Returns:
            Generated client code
        """
        # Get total count of clients
        count_result = await self.db.execute(
            select(func.count(Client.id))
        )
        count = count_result.scalar_one()

        # Generate code with padding
        sequence = count + 1
        code = f"CLI-{sequence:05d}"

        # Verify uniqueness
        existing = await self.get_by_code(code)
        if existing:
            # Find next available number
            result = await self.db.execute(
                select(func.max(Client.code)).where(
                    Client.code.like("CLI-%")
                )
            )
            max_code = result.scalar_one_or_none()

            if max_code:
                try:
                    last_num = int(max_code.split('-')[1])
                    code = f"CLI-{last_num + 1:05d}"
                except (IndexError, ValueError):
                    code = f"CLI-{sequence:05d}"

        return code

    async def count_all(self, is_active: bool | None = None) -> int:
        """
        Count all clients.

        Args:
            is_active: Filter by active status

        Returns:
            Count of clients
        """
        query = select(func.count(Client.id))
        if is_active is not None:
            query = query.where(Client.is_active == is_active)

        result = await self.db.execute(query)
        return result.scalar_one()

    # ==========================================================================
    # JWT Token Generation for Web Clients
    # ==========================================================================

    def create_client_token(self, client: Client) -> str:
        """
        Create JWT access token for web portal client.

        Args:
            client: Client entity

        Returns:
            JWT access token string
        """
        expires_delta = timedelta(days=7)  # Longer expiration for clients
        # JWT exp MUST use UTC - python-jose validates against UTC timestamps
        expire = datetime.utcnow() + expires_delta

        to_encode = {
            "sub": str(client.id),
            "email": client.email,
            "client_type": "web_client",
            "exp": expire,
        }

        access_token = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        return access_token

    async def get_client_orders(
        self,
        client_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> list[Order]:
        """
        Get all orders for a client.

        Args:
            client_id: Client UUID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of orders
        """
        from sqlalchemy.orm import selectinload

        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.client_id == client_id)
            .order_by(Order.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def soft_delete(self, client_id: UUID) -> None:
        """
        Soft delete a client by setting is_active=False.

        Args:
            client_id: Client UUID to soft delete
        """
        client = await self.get(client_id)
        if client:
            client.is_active = False
            await self.db.flush()
