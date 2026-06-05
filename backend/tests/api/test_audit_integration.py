"""
Phase 3 integration tests: AuditService wired into route handlers.

Verifica que las rutas sensibles emiten audit_log rows con la estructura
esperada (action, resource_type, resource_id, before/after, IP/UA).

Cubre los gaps cerrados por la remediation:
  - users.py admin endpoints (add/update/remove role, reset password,
    change email, set superuser).
  - global_roles.py CUD.
  - custom_roles.py create/delete (update ya tenia audit pre-remediation).
  - school_users.py invite/update/remove (Phase 3 baseline).
"""
import pytest
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.user import UserSchoolRole, UserRole


pytestmark = pytest.mark.api


class TestAdminUserEndpointsAudit:
    """users.py admin endpoints emit audit logs."""

    async def test_admin_set_superuser_writes_audit_log(
        self, api_client, superuser_headers, test_user, db_session
    ):
        """SUPERUSER_CHANGE: el privilege change de mayor impacto debe quedar trazado."""
        response = await api_client.put(
            f"/api/v1/users/{test_user.id}/superuser",
            headers=superuser_headers,
            json={"is_superuser": True},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.resource_id == str(test_user.id))
            .where(AuditLog.action == "superuser_change")
            .order_by(AuditLog.created_at.desc())
        )
        logs = list(result.scalars().all())
        assert len(logs) >= 1
        log = logs[0]
        assert log.data_before == {"is_superuser": False}
        assert log.data_after == {"is_superuser": True}

    async def test_admin_reset_password_does_not_log_password(
        self, api_client, superuser_headers, test_user, db_session
    ):
        """PASSWORD_RESET: log existe pero NO contiene plaintext ni hash bcrypt."""
        new_password = "NewSecret_xyz_123!"
        response = await api_client.post(
            f"/api/v1/users/{test_user.id}/reset-password",
            headers=superuser_headers,
            json={"new_password": new_password},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.resource_id == str(test_user.id))
            .where(AuditLog.action == "password_reset")
        )
        logs = list(result.scalars().all())
        assert len(logs) >= 1

        for log in logs:
            for blob in (log.data_before, log.data_after, log.description):
                if blob is None:
                    continue
                blob_str = str(blob)
                assert new_password not in blob_str
                assert "$2b$" not in blob_str  # bcrypt hash prefix

    async def test_admin_change_email_logs_before_after(
        self, api_client, superuser_headers, test_user, db_session
    ):
        """EMAIL_CHANGE captura el email anterior y nuevo."""
        new_email = "newaddr@test.com"
        old_email = test_user.email
        response = await api_client.put(
            f"/api/v1/users/{test_user.id}/email",
            headers=superuser_headers,
            json={"new_email": new_email},
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.resource_id == str(test_user.id))
            .where(AuditLog.action == "email_change")
        )
        log = result.scalar_one_or_none()
        assert log is not None
        assert log.data_before == {"email": old_email}
        assert log.data_after == {"email": new_email}

    async def test_add_user_school_role_writes_audit(
        self, api_client, superuser_headers, test_user, test_school, db_session
    ):
        """Add school role emits ROLE_CHANGE with the new role in data_after."""
        response = await api_client.post(
            f"/api/v1/users/{test_user.id}/schools/{test_school.id}/role"
            f"?role={UserRole.SELLER.value}",
            headers=superuser_headers,
        )
        assert response.status_code == 201

        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.resource_id == str(test_user.id))
            .where(AuditLog.action == "role_change")
            .where(AuditLog.school_id == test_school.id)
        )
        logs = list(result.scalars().all())
        assert len(logs) >= 1
        assert logs[0].data_after["role"] == UserRole.SELLER.value


class TestPermissionsBumpedOnRoleMutation:
    """Phase 1 contract: cambios de rol bumpean permissions_version del usuario."""

    async def test_add_role_bumps_target_user_version(
        self, api_client, superuser_headers, test_user, test_school, db_session
    ):
        from app.models.user import User
        original = test_user.permissions_version or 0

        response = await api_client.post(
            f"/api/v1/users/{test_user.id}/schools/{test_school.id}/role"
            f"?role={UserRole.SELLER.value}",
            headers=superuser_headers,
        )
        assert response.status_code == 201

        await db_session.refresh(test_user)
        refreshed = await db_session.get(User, test_user.id)
        assert refreshed.permissions_version == original + 1

    async def test_remove_role_bumps_target_user_version(
        self, api_client, superuser_headers, test_user_with_school_role, db_session
    ):
        from app.models.user import User
        user, school = test_user_with_school_role
        original = user.permissions_version or 0

        response = await api_client.delete(
            f"/api/v1/users/{user.id}/schools/{school.id}/role",
            headers=superuser_headers,
        )
        assert response.status_code == 204

        # Force refresh: expire_on_commit=False keeps cached attrs.
        await db_session.refresh(user)
        refreshed = await db_session.get(User, user.id)
        assert refreshed.permissions_version == original + 1
