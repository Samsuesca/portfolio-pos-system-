"""
Unit tests for User Service.

Tests for user management and authentication including:
- User CRUD operations
- Password hashing and verification
- Authentication (login)
- JWT token creation and validation
- User-School role management
- Password change
"""
import pytest
from datetime import datetime, timedelta
from uuid import uuid4

pytestmark = pytest.mark.unit


class TestUserServicePasswordOperations:
    """Tests for password hashing and verification."""

    def test_hash_password(self):
        """Test password hashing."""
        from app.services.user import UserService

        password = "mySecurePassword123"
        hashed = UserService.hash_password(password)

        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        from app.services.user import UserService

        password = "CorrectPassword1"
        hashed = UserService.hash_password(password)

        assert UserService.verify_password(password, hashed) == True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        from app.services.user import UserService

        password = "CorrectPassword1"
        hashed = UserService.hash_password(password)

        assert UserService.verify_password("wrongPassword1", hashed) == False

    def test_different_hashes_for_same_password(self):
        """Test that same password produces different hashes (salting)."""
        from app.services.user import UserService

        password = "TestPassword1"
        hash1 = UserService.hash_password(password)
        hash2 = UserService.hash_password(password)

        assert hash1 != hash2
        assert UserService.verify_password(password, hash1) == True
        assert UserService.verify_password(password, hash2) == True


class TestUserServiceCreate:
    """Tests for user creation."""

    async def test_create_user_success(self, db_session):
        """Test successful user creation."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="securePassword123",
            full_name="Test User"
        )

        user = await service.create_user(user_data)

        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active == True
        assert user.hashed_password is not None
        assert user.hashed_password != "securePassword123"

    async def test_create_user_duplicate_username_fails(self, db_session):
        """Test that duplicate username raises error."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="duplicate",
            email="first@example.com",
            password="Password123"
        )
        await service.create_user(user_data)

        duplicate_data = UserCreate(
            username="duplicate",
            email="second@example.com",
            password="Password456"
        )

        with pytest.raises(ValueError, match="Username .* already exists"):
            await service.create_user(duplicate_data)

    async def test_create_user_duplicate_email_fails(self, db_session):
        """Test that duplicate email raises error."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="user1",
            email="duplicate@example.com",
            password="Password123"
        )
        await service.create_user(user_data)

        duplicate_data = UserCreate(
            username="user2",
            email="duplicate@example.com",
            password="Password456"
        )

        with pytest.raises(ValueError, match="Email .* already exists"):
            await service.create_user(duplicate_data)

    async def test_create_superuser(self, db_session):
        """Test creating a superuser."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="superadmin",
            email="super@example.com",
            password="AdminPassword1",
            is_superuser=True
        )

        user = await service.create_user(user_data)

        assert user.is_superuser == True


class TestUserServiceLookup:
    """Tests for user lookup methods."""

    async def test_get_by_username(self, db_session):
        """Test getting user by username."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="findme",
            email="findme@example.com",
            password="Password1"
        )
        created = await service.create_user(user_data)

        found = await service.get_by_username("findme")

        assert found is not None
        assert found.id == created.id

    async def test_get_by_username_case_insensitive(self, db_session):
        """Test username lookup is case insensitive."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="CaseTest",
            email="case@example.com",
            password="Password1"
        )
        await service.create_user(user_data)

        found = await service.get_by_username("casetest")

        assert found is not None

    async def test_get_by_email(self, db_session):
        """Test getting user by email."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="emailuser",
            email="specific@example.com",
            password="Password1"
        )
        created = await service.create_user(user_data)

        found = await service.get_by_email("specific@example.com")

        assert found is not None
        assert found.id == created.id

    async def test_get_user_with_roles(self, db_session, test_school):
        """Test getting user with school roles loaded."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="roleuser",
            email="role@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        # Add role
        await service.add_school_role(user.id, test_school.id, UserRole.SELLER)

        # Get with roles
        user_with_roles = await service.get_user_with_roles(user.id)

        assert user_with_roles is not None
        assert len(user_with_roles.school_roles) >= 1


class TestUserServiceAuthentication:
    """Tests for user authentication."""

    async def test_authenticate_with_username_success(self, db_session):
        """Test successful authentication with username."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="authuser",
            email="auth@example.com",
            password="MyPassword1"
        )
        await service.create_user(user_data)

        user = await service.authenticate("authuser", "MyPassword1")

        assert user is not None
        assert user.username == "authuser"
        assert user.last_login is not None

    async def test_authenticate_with_email_success(self, db_session):
        """Test successful authentication with email."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="emailauth",
            email="emailauth@example.com",
            password="EmailPass1"
        )
        await service.create_user(user_data)

        user = await service.authenticate("emailauth@example.com", "EmailPass1")

        assert user is not None

    async def test_authenticate_wrong_password(self, db_session):
        """Test authentication fails with wrong password."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="wrongpass",
            email="wrongpass@example.com",
            password="CorrectPass1"
        )
        await service.create_user(user_data)

        user = await service.authenticate("wrongpass", "WrongPassword1")

        assert user is None

    async def test_authenticate_nonexistent_user(self, db_session):
        """Test authentication fails for nonexistent user."""
        from app.services.user import UserService

        service = UserService(db_session)

        user = await service.authenticate("nobody", "anypassword")

        assert user is None

    async def test_authenticate_inactive_user(self, db_session):
        """Test authentication fails for inactive user."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="inactive",
            email="inactive@example.com",
            password="Password1",
            is_active=False
        )
        await service.create_user(user_data)

        user = await service.authenticate("inactive", "password1")

        assert user is None


class TestUserServiceJWT:
    """Tests for JWT token operations."""

    async def test_create_access_token(self, db_session):
        """Test creating access token."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="tokenuser",
            email="token@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        token = service.create_access_token(user.id, user.username)

        assert token.access_token is not None
        assert token.token_type == "bearer"
        assert token.expires_in > 0

    async def test_create_token_with_school_and_role(self, db_session, test_school):
        """Test creating token with school context."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="schooltoken",
            email="schooltoken@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        token = service.create_access_token(
            user.id,
            user.username,
            school_id=test_school.id,
            role=UserRole.ADMIN
        )

        assert token.access_token is not None

    async def test_decode_token_success(self, db_session):
        """Test decoding valid token."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate

        service = UserService(db_session)

        user_data = UserCreate(
            username="decodeuser",
            email="decode@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        token = service.create_access_token(user.id, user.username)
        decoded = service.decode_token(token.access_token)

        assert decoded is not None
        assert decoded.user_id == user.id
        assert decoded.username == user.username

    async def test_decode_token_with_school(self, db_session, test_school):
        """Test decoding token with school context."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="decodeschool",
            email="decodeschool@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        token = service.create_access_token(
            user.id,
            user.username,
            school_id=test_school.id,
            role=UserRole.SELLER
        )
        decoded = service.decode_token(token.access_token)

        assert decoded is not None
        assert str(decoded.school_id) == str(test_school.id)
        assert decoded.role == UserRole.SELLER

    def test_decode_invalid_token(self, db_session):
        """Test decoding invalid token returns None."""
        from app.services.user import UserService

        service = UserService(db_session)

        decoded = service.decode_token("invalid.token.here")

        assert decoded is None


class TestUserServicePasswordChange:
    """Tests for password change."""

    async def test_change_password_success(self, db_session):
        """Test successful password change."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate, PasswordChange

        service = UserService(db_session)

        user_data = UserCreate(
            username="changepass",
            email="changepass@example.com",
            password="OldPassword1"
        )
        user = await service.create_user(user_data)

        password_change = PasswordChange(
            old_password="OldPassword1",
            new_password="NewPassword123"
        )
        result = await service.change_password(user.id, password_change)

        assert result == True

        # Verify can login with new password
        auth_user = await service.authenticate("changepass", "NewPassword123")
        assert auth_user is not None

    async def test_change_password_wrong_old(self, db_session):
        """Test password change fails with wrong old password."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate, PasswordChange

        service = UserService(db_session)

        user_data = UserCreate(
            username="wrongold",
            email="wrongold@example.com",
            password="CorrectOld1"
        )
        user = await service.create_user(user_data)

        password_change = PasswordChange(
            old_password="WrongOld1",
            new_password="NewPassword1"
        )

        with pytest.raises(ValueError, match="Old password is incorrect"):
            await service.change_password(user.id, password_change)

    async def test_change_password_nonexistent_user(self, db_session):
        """Test password change for nonexistent user."""
        from app.services.user import UserService
        from app.schemas.user import PasswordChange

        service = UserService(db_session)

        password_change = PasswordChange(
            old_password="AnyTest1",
            new_password="AnyTest1"
        )
        result = await service.change_password(uuid4(), password_change)

        assert result == False


class TestUserServiceSchoolRoles:
    """Tests for user-school role management."""

    async def test_add_school_role(self, db_session, test_school):
        """Test adding user role for school."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="addrole",
            email="addrole@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        role = await service.add_school_role(
            user.id,
            test_school.id,
            UserRole.SELLER
        )

        assert role is not None
        assert str(role.user_id) == str(user.id)
        assert str(role.school_id) == str(test_school.id)
        assert role.role == UserRole.SELLER

    async def test_add_duplicate_school_role_fails(self, db_session, test_school):
        """Test adding duplicate role raises error."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="duprole",
            email="duprole@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        await service.add_school_role(user.id, test_school.id, UserRole.SELLER)

        with pytest.raises(ValueError, match="already has a role"):
            await service.add_school_role(user.id, test_school.id, UserRole.ADMIN)

    async def test_update_school_role(self, db_session, test_school):
        """Test updating user role for school."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="updaterole",
            email="updaterole@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        await service.add_school_role(user.id, test_school.id, UserRole.SELLER)
        updated = await service.update_school_role(
            user.id,
            test_school.id,
            UserRole.ADMIN
        )

        assert updated is not None
        assert updated.role == UserRole.ADMIN

    async def test_remove_school_role(self, db_session, test_school):
        """Test removing user role from school."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="removerole",
            email="removerole@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        await service.add_school_role(user.id, test_school.id, UserRole.SELLER)
        result = await service.remove_school_role(user.id, test_school.id)

        assert result == True

        # Verify role is removed
        roles = await service.get_user_schools(user.id)
        assert all(r.school_id != test_school.id for r in roles)

    async def test_get_user_schools(self, db_session, test_school):
        """Test getting all schools for a user."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        user_data = UserCreate(
            username="userschools",
            email="userschools@example.com",
            password="Password1"
        )
        user = await service.create_user(user_data)

        await service.add_school_role(user.id, test_school.id, UserRole.SELLER)

        schools = await service.get_user_schools(user.id)

        assert len(schools) >= 1
        assert any(str(r.school_id) == str(test_school.id) for r in schools)

    async def test_get_school_users(self, db_session, test_school):
        """Test getting all users in a school."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole

        service = UserService(db_session)

        # Create users and add to school
        for i in range(3):
            user_data = UserCreate(
                username=f"schooluser{i}",
                email=f"schooluser{i}@example.com",
                password="Password1"
            )
            user = await service.create_user(user_data)
            await service.add_school_role(user.id, test_school.id, UserRole.SELLER)

        users = await service.get_school_users(test_school.id)

        assert len(users) >= 3


class TestUserServiceUpdate:
    """Tests for user updates."""

    async def test_update_user_info(self, db_session):
        """Test updating user information."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate, UserUpdate

        service = UserService(db_session)

        user_data = UserCreate(
            username="updateinfo",
            email="updateinfo@example.com",
            password="Password1",
            full_name="Original Name"
        )
        user = await service.create_user(user_data)

        update_data = UserUpdate(full_name="Updated Name")
        updated = await service.update_user(user.id, update_data)

        assert updated is not None
        assert updated.full_name == "Updated Name"

    async def test_update_user_password(self, db_session):
        """Test updating user password via update."""
        from app.services.user import UserService
        from app.schemas.user import UserCreate, UserUpdate

        service = UserService(db_session)

        user_data = UserCreate(
            username="updatepassword",
            email="updatepassword@example.com",
            password="OriginalPassword1"
        )
        user = await service.create_user(user_data)

        update_data = UserUpdate(password="NewPassword1")
        await service.update_user(user.id, update_data)

        # Verify can login with new password
        auth_user = await service.authenticate("updatepassword", "NewPassword1")
        assert auth_user is not None
