"""Unit tests de la dependency get_user_branch_ids (v3.1 — Fase 0b).

Semántica clave (distinta a get_user_school_ids):
``None`` = acceso a TODAS las sucursales (admin central), NO lista vacía.
Esto preserva el backward-compat: hoy ningún UserSchoolRole tiene branch_id
poblado, así que todos los usuarios son centrales y el caller no filtra.
"""
from uuid import uuid4

from app.api.dependencies import get_user_branch_ids
from app.models.branch import Branch
from app.models.school import School
from app.models.user import User, UserRole, UserSchoolRole


async def _make_user(db_session, *, is_superuser: bool = False) -> User:
    unique = uuid4().hex[:8]
    user = User(
        id=uuid4(),
        username=f"branchuser_{unique}",
        email=f"branchuser_{unique}@test.com",
        hashed_password="x",
        is_active=True,
        is_superuser=is_superuser,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _make_school(db_session) -> School:
    unique = uuid4().hex[:8]
    school = School(
        id=uuid4(),
        code=f"BR-{unique}",
        name=f"Branch School {unique}",
        slug=f"branch-school-{unique}",
        is_active=True,
    )
    db_session.add(school)
    await db_session.flush()
    return school


async def _make_branch(db_session, code: str) -> Branch:
    branch = Branch(id=uuid4(), name=f"Sucursal {code}", code=f"{code}-{uuid4().hex[:6]}")
    db_session.add(branch)
    await db_session.flush()
    return branch


async def test_superuser_returns_none(db_session):
    """Superuser ⇒ None (acceso total, sin filtro)."""
    user = await _make_user(db_session, is_superuser=True)

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result is None


async def test_user_without_roles_returns_none(db_session):
    """Usuario sin roles ⇒ None (no se restringe; mismo trato que hoy)."""
    user = await _make_user(db_session)

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result is None


async def test_role_with_null_branch_returns_none(db_session):
    """Un rol con branch_id NULL = acceso central ⇒ None.

    Es el estado de TODOS los roles hoy: el retrofit no los backfillea.
    """
    user = await _make_user(db_session)
    school = await _make_school(db_session)
    db_session.add(UserSchoolRole(
        id=uuid4(), user_id=user.id, school_id=school.id,
        role=UserRole.ADMIN, branch_id=None,
    ))
    await db_session.flush()

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result is None


async def test_mixed_roles_with_one_central_returns_none(db_session):
    """Si AL MENOS un rol es central (branch_id NULL), acceso a todas ⇒ None."""
    user = await _make_user(db_session)
    school_a = await _make_school(db_session)
    school_b = await _make_school(db_session)
    branch = await _make_branch(db_session, "NORTE")
    db_session.add_all([
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_a.id,
            role=UserRole.SELLER, branch_id=branch.id,
        ),
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_b.id,
            role=UserRole.ADMIN, branch_id=None,  # rol central
        ),
    ])
    await db_session.flush()

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result is None


async def test_all_roles_restricted_returns_branch_list(db_session):
    """Todos los roles restringidos a sucursales ⇒ lista de esos UUIDs."""
    user = await _make_user(db_session)
    school_a = await _make_school(db_session)
    school_b = await _make_school(db_session)
    branch_norte = await _make_branch(db_session, "NORTE")
    branch_sur = await _make_branch(db_session, "SUR")
    db_session.add_all([
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_a.id,
            role=UserRole.SELLER, branch_id=branch_norte.id,
        ),
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_b.id,
            role=UserRole.SELLER, branch_id=branch_sur.id,
        ),
    ])
    await db_session.flush()

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result is not None
    assert set(result) == {branch_norte.id, branch_sur.id}


async def test_duplicate_branch_ids_deduplicated(db_session):
    """Dos roles a la misma sucursal ⇒ un solo UUID (sin duplicados)."""
    user = await _make_user(db_session)
    school_a = await _make_school(db_session)
    school_b = await _make_school(db_session)
    branch = await _make_branch(db_session, "CENTRO")
    db_session.add_all([
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_a.id,
            role=UserRole.SELLER, branch_id=branch.id,
        ),
        UserSchoolRole(
            id=uuid4(), user_id=user.id, school_id=school_b.id,
            role=UserRole.VIEWER, branch_id=branch.id,
        ),
    ])
    await db_session.flush()

    result = await get_user_branch_ids(current_user=user, db=db_session)

    assert result == [branch.id]
