"""
User and Authentication Service
"""
from datetime import datetime, timedelta
from uuid import UUID
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_now_naive
from app.core.config import settings
from app.models.user import User, UserSchoolRole, UserRole
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    Token,
    TokenData,
    PasswordChange,
)
from app.services.base import BaseService


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService(BaseService[User]):
    """Service for User operations and authentication"""

    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    # ==========================================
    # Password Operations
    # ==========================================

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a password

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash

        Args:
            plain_password: Plain text password
            hashed_password: Hashed password

        Returns:
            True if password matches
        """
        return pwd_context.verify(plain_password, hashed_password)

    # ==========================================
    # User CRUD
    # ==========================================

    async def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user

        Args:
            user_data: User creation data

        Returns:
            Created user

        Raises:
            ValueError: If username or email already exists
        """
        # Check if username exists
        existing_username = await self.get_by_username(user_data.username)
        if existing_username:
            raise ValueError(f"Username '{user_data.username}' already exists")

        # Check if email exists
        existing_email = await self.get_by_email(user_data.email)
        if existing_email:
            raise ValueError(f"Email '{user_data.email}' already exists")

        # Create user with hashed password
        user_dict = user_data.model_dump(exclude={'password'})
        user_dict['hashed_password'] = self.hash_password(user_data.password)

        return await self.create(user_dict)

    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> User | None:
        """
        Update user information

        Args:
            user_id: User UUID
            user_data: User update data

        Returns:
            Updated user or None
        """
        update_dict = user_data.model_dump(exclude_unset=True, exclude={'password'})

        # Handle password separately
        if user_data.password:
            update_dict['hashed_password'] = self.hash_password(user_data.password)

        return await self.update(user_id, update_dict)

    async def get_by_username(self, username: str) -> User | None:
        """
        Get user by username

        Args:
            username: Username (case-insensitive)

        Returns:
            User or None
        """
        result = await self.db.execute(
            select(User).where(User.username == username.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """
        Get user by email

        Args:
            email: Email address

        Returns:
            User or None
        """
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_user_with_roles(self, user_id: UUID) -> User | None:
        """
        Get user with school roles loaded

        Args:
            user_id: User UUID

        Returns:
            User with roles or None
        """
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.school_roles))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    # ==========================================
    # Authentication
    # ==========================================

    async def authenticate(self, username: str, password: str) -> User | None:
        """
        Authenticate user with username and password

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            User if authenticated, None otherwise
        """
        # Try username first, then email
        user = await self.get_by_username(username)
        if not user:
            user = await self.get_by_email(username)

        if not user:
            return None

        if not user.is_active:
            return None

        if not self.verify_password(password, user.hashed_password):
            return None

        # Update last login
        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login=get_colombia_now_naive())
        )
        await self.db.flush()

        return user

    def create_access_token(
        self,
        user_id: UUID,
        username: str,
        school_id: UUID | None = None,
        role: UserRole | None = None
    ) -> Token:
        """
        Create JWT access token

        Args:
            user_id: User UUID
            username: Username
            school_id: Active school ID (optional)
            role: User role in school (optional)

        Returns:
            Token with access_token and expiration
        """
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        # JWT exp MUST use UTC - python-jose validates against UTC timestamps
        expire = datetime.utcnow() + expires_delta

        to_encode = {
            "sub": str(user_id),
            "username": username,
            "exp": expire,
        }

        if school_id:
            to_encode["school_id"] = str(school_id)
        if role:
            to_encode["role"] = role.value

        access_token = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=int(expires_delta.total_seconds())
        )

    def decode_token(self, token: str) -> TokenData | None:
        """
        Decode and validate JWT token

        Args:
            token: JWT token string

        Returns:
            TokenData or None if invalid
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )

            user_id = UUID(payload.get("sub"))
            username = payload.get("username")

            if not user_id or not username:
                return None

            school_id = payload.get("school_id")
            role = payload.get("role")

            return TokenData(
                user_id=user_id,
                username=username,
                school_id=UUID(school_id) if school_id else None,
                role=UserRole(role) if role else None
            )

        except (JWTError, ValueError):
            return None

    async def change_password(
        self,
        user_id: UUID,
        password_data: PasswordChange
    ) -> bool:
        """
        Change user password

        Args:
            user_id: User UUID
            password_data: Old and new password

        Returns:
            True if changed successfully

        Raises:
            ValueError: If old password is incorrect
        """
        user = await self.get(user_id)
        if not user:
            return False

        # Verify old password
        if not self.verify_password(password_data.old_password, user.hashed_password):
            raise ValueError("Old password is incorrect")

        # Update with new password
        await self.update(
            user_id,
            {"hashed_password": self.hash_password(password_data.new_password)}
        )

        return True

    # ==========================================
    # User-School Roles
    # ==========================================

    async def add_school_role(
        self,
        user_id: UUID,
        school_id: UUID,
        role: UserRole | None = None,
        custom_role_id: UUID | None = None
    ) -> UserSchoolRole:
        """
        Add user role for a school

        Args:
            user_id: User UUID
            school_id: School UUID
            role: System role (mutually exclusive with custom_role_id)
            custom_role_id: Custom role ID (mutually exclusive with role)

        Returns:
            Created UserSchoolRole

        Raises:
            ValueError: If role already exists or no role specified

        Note:
            Role and custom_role_id are mutually exclusive.
            Must provide either role OR custom_role_id.
        """
        if not role and not custom_role_id:
            raise ValueError("Must provide either role or custom_role_id")

        # Check if role already exists
        existing = await self.db.execute(
            select(UserSchoolRole).where(
                UserSchoolRole.user_id == user_id,
                UserSchoolRole.school_id == school_id
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User already has a role in this school")

        # Create role - system role OR custom role, not both
        school_role = UserSchoolRole(
            user_id=user_id,
            school_id=school_id,
            role=role if not custom_role_id else None,
            custom_role_id=custom_role_id if custom_role_id else None
        )
        self.db.add(school_role)
        await self.db.flush()
        await self.db.refresh(school_role)

        return school_role

    async def update_school_role(
        self,
        user_id: UUID,
        school_id: UUID,
        role: UserRole | None = None,
        custom_role_id: UUID | None = None
    ) -> UserSchoolRole | None:
        """
        Update user role for a school

        Args:
            user_id: User UUID
            school_id: School UUID
            role: System role (mutually exclusive with custom_role_id)
            custom_role_id: Custom role ID (mutually exclusive with role)

        Returns:
            Updated UserSchoolRole or None

        Note:
            Role and custom_role_id are mutually exclusive.
            If custom_role_id is provided, role will be set to NULL.
            If role is provided, custom_role_id will be set to NULL.
        """
        # Roles are mutually exclusive: system role OR custom role, not both
        if custom_role_id:
            update_values = {"role": None, "custom_role_id": custom_role_id}
        else:
            update_values = {"role": role, "custom_role_id": None}
        await self.db.execute(
            update(UserSchoolRole)
            .where(
                UserSchoolRole.user_id == user_id,
                UserSchoolRole.school_id == school_id
            )
            .values(**update_values)
        )
        await self.db.flush()

        result = await self.db.execute(
            select(UserSchoolRole).where(
                UserSchoolRole.user_id == user_id,
                UserSchoolRole.school_id == school_id
            )
        )
        return result.scalar_one_or_none()

    async def remove_school_role(
        self,
        user_id: UUID,
        school_id: UUID
    ) -> bool:
        """
        Remove user role from a school

        Args:
            user_id: User UUID
            school_id: School UUID

        Returns:
            True if removed
        """
        from sqlalchemy import delete as sql_delete

        result = await self.db.execute(
            sql_delete(UserSchoolRole).where(
                UserSchoolRole.user_id == user_id,
                UserSchoolRole.school_id == school_id
            )
        )
        await self.db.flush()
        return result.rowcount > 0

    async def get_user_schools(self, user_id: UUID, include_school: bool = False) -> list[UserSchoolRole]:
        """
        Get all schools where user has access

        Args:
            user_id: User UUID
            include_school: If True, eagerly load school relationship

        Returns:
            List of UserSchoolRole
        """
        from sqlalchemy.orm import joinedload

        query = select(UserSchoolRole).where(UserSchoolRole.user_id == user_id)

        if include_school:
            query = query.options(
                joinedload(UserSchoolRole.school),
                joinedload(UserSchoolRole.custom_role)
            )
        else:
            query = query.options(joinedload(UserSchoolRole.custom_role))

        query = query.order_by(UserSchoolRole.created_at)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_school_users(self, school_id: UUID) -> list[UserSchoolRole]:
        """
        Get all users in a school

        Args:
            school_id: School UUID

        Returns:
            List of UserSchoolRole
        """
        result = await self.db.execute(
            select(UserSchoolRole)
            .where(UserSchoolRole.school_id == school_id)
            .order_by(UserSchoolRole.role, UserSchoolRole.created_at)
        )
        return list(result.scalars().all())
