"""
Tests for School Users Management API endpoints.

Tests cover:
- Listing users in a school
- Inviting users to a school
- Changing user roles
- Removing users from a school
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.models.user import UserRole


@pytest.mark.asyncio
async def test_list_school_users(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school,
    test_user_with_school_role
):
    """Test listing users in a school."""
    user, school = test_user_with_school_role

    response = await api_client.get(
        f"/api/v1/schools/{school.id}/users",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert "total" in data
    assert isinstance(data["users"], list)


@pytest.mark.asyncio
async def test_list_school_users_with_pagination(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test listing users with pagination."""
    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users?skip=0&limit=10",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_school_users_with_role_filter(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test filtering users by role."""
    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users?role_filter=admin",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    # All users should have admin role or be empty
    for user in data["users"]:
        if user["role"]:
            assert user["role"] == "admin"


@pytest.mark.asyncio
async def test_list_available_users(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test listing users available to add to school."""
    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users/available",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_available_users_with_search(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test searching available users."""
    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users/available?search=test",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "users" in data


@pytest.mark.asyncio
async def test_invite_user_to_school(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school,
    test_user,
    db_session
):
    """Test inviting a user to a school."""
    # First check if user is already in school by looking at available users
    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users",
        headers=superuser_headers
    )
    existing_users = response.json()["users"]
    existing_emails = [u["email"] for u in existing_users]

    # If user already in school, skip
    if test_user.email in existing_emails:
        pytest.skip("User already has access to this school")

    invite_data = {
        "email": test_user.email,
        "role": "seller",
        "is_primary": False
    }

    response = await api_client.post(
        f"/api/v1/schools/{test_school.id}/users/invite",
        json=invite_data,
        headers=superuser_headers
    )

    # Could be 201 (created) or 409 (already exists)
    assert response.status_code in [201, 409]

    if response.status_code == 201:
        data = response.json()
        assert "user_id" in data
        assert data["email"] == test_user.email
        assert "message" in data


@pytest.mark.asyncio
async def test_invite_user_nonexistent_email(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test inviting a user with nonexistent email fails."""
    invite_data = {
        "email": f"nonexistent_{uuid4().hex[:8]}@test.com",
        "role": "viewer",
        "is_primary": False
    }

    response = await api_client.post(
        f"/api/v1/schools/{test_school.id}/users/invite",
        json=invite_data,
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_invite_user_owner_role_requires_superuser(
    api_client: AsyncClient,
    auth_headers: dict,  # Regular user (non-superuser)
    test_school,
    test_user
):
    """Test that only superusers can assign owner role."""
    invite_data = {
        "email": test_user.email,
        "role": "owner",
        "is_primary": False
    }

    response = await api_client.post(
        f"/api/v1/schools/{test_school.id}/users/invite",
        json=invite_data,
        headers=auth_headers
    )

    # Should be 403 (Forbidden) since non-superuser cannot assign owner
    assert response.status_code in [403, 401]


@pytest.mark.asyncio
async def test_update_user_role(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_user_with_school_role
):
    """Test updating a user's role in a school."""
    user, school = test_user_with_school_role

    update_data = {
        "role": "seller"
    }

    response = await api_client.put(
        f"/api/v1/schools/{school.id}/users/{user.id}/role",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "seller"


@pytest.mark.asyncio
async def test_update_user_role_not_found(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test updating role for nonexistent user in school."""
    fake_user_id = str(uuid4())

    update_data = {
        "role": "seller"
    }

    response = await api_client.put(
        f"/api/v1/schools/{test_school.id}/users/{fake_user_id}/role",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cannot_change_own_role(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_superuser,
    test_school,
    db_session
):
    """Test that users cannot change their own role."""
    from app.models.user import UserSchoolRole, UserRole

    # First add superuser to school
    role = UserSchoolRole(
        id=str(uuid4()),
        user_id=test_superuser.id,
        school_id=test_school.id,
        role=UserRole.OWNER
    )
    db_session.add(role)
    await db_session.flush()

    update_data = {
        "role": "viewer"
    }

    response = await api_client.put(
        f"/api/v1/schools/{test_school.id}/users/{test_superuser.id}/role",
        json=update_data,
        headers=superuser_headers
    )

    assert response.status_code == 403
    assert "Cannot change your own role" in response.json()["detail"]


@pytest.mark.asyncio
async def test_remove_user_from_school(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_user_with_school_role
):
    """Test removing a user from a school."""
    user, school = test_user_with_school_role

    response = await api_client.delete(
        f"/api/v1/schools/{school.id}/users/{user.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert "message" in data


@pytest.mark.asyncio
async def test_remove_user_not_found(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test removing nonexistent user from school."""
    fake_user_id = str(uuid4())

    response = await api_client.delete(
        f"/api/v1/schools/{test_school.id}/users/{fake_user_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_cannot_remove_self_from_school(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_superuser,
    test_school,
    db_session
):
    """Test that users cannot remove themselves from a school."""
    from app.models.user import UserSchoolRole, UserRole

    # Ensure superuser is in school
    existing_result = await db_session.execute(
        __import__('sqlalchemy').select(UserSchoolRole).where(
            UserSchoolRole.user_id == test_superuser.id,
            UserSchoolRole.school_id == test_school.id
        )
    )
    if not existing_result.scalar_one_or_none():
        role = UserSchoolRole(
            id=str(uuid4()),
            user_id=test_superuser.id,
            school_id=test_school.id,
            role=UserRole.ADMIN
        )
        db_session.add(role)
        await db_session.flush()

    response = await api_client.delete(
        f"/api/v1/schools/{test_school.id}/users/{test_superuser.id}",
        headers=superuser_headers
    )

    assert response.status_code == 403
    assert "Cannot remove yourself" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_school_user_details(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_user_with_school_role
):
    """Test getting details of a specific user in a school."""
    user, school = test_user_with_school_role

    response = await api_client.get(
        f"/api/v1/schools/{school.id}/users/{user.id}",
        headers=superuser_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["username"] == user.username
    assert data["email"] == user.email
    assert "role" in data
    assert "joined_at" in data


@pytest.mark.asyncio
async def test_get_school_user_not_found(
    api_client: AsyncClient,
    superuser_headers: dict,
    test_school
):
    """Test getting details of nonexistent user in school."""
    fake_user_id = str(uuid4())

    response = await api_client.get(
        f"/api/v1/schools/{test_school.id}/users/{fake_user_id}",
        headers=superuser_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_school_users_requires_auth(api_client: AsyncClient, test_school):
    """Test that school users endpoints require authentication."""
    response = await api_client.get(f"/api/v1/schools/{test_school.id}/users")

    # Should return 401 or 403 without auth
    assert response.status_code in [401, 403]
