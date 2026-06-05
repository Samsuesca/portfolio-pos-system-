"""
Phase 1C regression guard.

The permission overhaul Phase 1C removed legacy dependencies:
  - require_school_access
  - require_any_school_admin
  - can_manage_users / can_access_accounting / can_modify_inventory
  - can_create_sales / can_delete_records

This test fails CI if any of those reappear in app/api/routes/. Defends
against accidental reintroduction during merges or refactors.
"""
import re
from pathlib import Path

LEGACY_PATTERNS = [
    r"\brequire_school_access\s*\(",
    r"\brequire_any_school_admin\s*\(",
    r"\bcan_manage_users\s*\(",
    r"\bcan_access_accounting\s*\(",
    r"\bcan_modify_inventory\s*\(",
    r"\bcan_create_sales\s*\(",
    r"\bcan_delete_records\s*\(",
]


def test_no_legacy_dependencies_in_routes():
    backend_root = Path(__file__).resolve().parents[2]
    routes_dir = backend_root / "app" / "api" / "routes"
    assert routes_dir.is_dir(), f"routes dir not found: {routes_dir}"

    violations: list[str] = []
    for py_file in routes_dir.rglob("*.py"):
        content = py_file.read_text()
        for pattern in LEGACY_PATTERNS:
            for match in re.finditer(pattern, content):
                line_no = content[: match.start()].count("\n") + 1
                violations.append(f"{py_file.name}:{line_no} matches {pattern}")

    assert not violations, (
        "Legacy permission dependencies found in app/api/routes/ "
        "(Phase 1C overhaul mandates their removal):\n  "
        + "\n  ".join(violations)
    )
