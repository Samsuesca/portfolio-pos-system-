"""Invariants for the system role permission sets.

These guard the bug classes surfaced in the permission QA audit:
  - "privilege inversion": a lower role granting something a higher role lacks
    (e.g. viewer seeing a report the seller cannot).
  - typo'd / malformed permission codes leaking into a role (e.g. "acouting.view").
  - non-monotonic discount caps.

Pure unit tests over the canonical SYSTEM_ROLE_PERMISSIONS map — no DB needed.
"""
import re

import pytest

from app.services.permission import (
    SYSTEM_ROLE_MAX_DISCOUNT,
    SYSTEM_ROLE_PERMISSIONS,
)

# viewer < seller < admin < owner
HIERARCHY = ["viewer", "seller", "admin", "owner"]
CODE_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")


def _perms(role: str) -> set[str]:
    """owner is modelled as 'all permissions' (None/empty) -> superset of admin."""
    value = SYSTEM_ROLE_PERMISSIONS.get(role)
    if not value:  # owner: full access
        return set().union(*(set(SYSTEM_ROLE_PERMISSIONS.get(r) or []) for r in HIERARCHY))
    return set(value)


def test_all_codes_well_formed():
    """Every system-role permission code is a lowercase dotted code (no typos)."""
    bad = {
        c
        for role in HIERARCHY
        for c in (SYSTEM_ROLE_PERMISSIONS.get(role) or [])
        if not CODE_RE.match(c)
    }
    assert not bad, f"Malformed permission codes in system roles: {sorted(bad)}"


@pytest.mark.parametrize("lower,higher", list(zip(HIERARCHY, HIERARCHY[1:])))
def test_role_permissions_are_monotonic(lower, higher):
    """A higher role must grant every permission the next-lower role grants.

    Prevents privilege inversion (a 'lower' role able to do something a 'higher'
    role cannot)."""
    missing = _perms(lower) - _perms(higher)
    assert not missing, (
        f"Role '{higher}' is missing permissions held by lower role '{lower}': "
        f"{sorted(missing)}"
    )


def test_discount_caps_are_monotonic():
    caps = [SYSTEM_ROLE_MAX_DISCOUNT.get(r, 0) for r in HIERARCHY]
    assert caps == sorted(caps), (
        f"Discount caps must be non-decreasing across {HIERARCHY}, got {caps}"
    )
