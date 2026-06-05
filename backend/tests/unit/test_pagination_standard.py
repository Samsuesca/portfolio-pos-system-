"""
Pagination Standard Enforcement Test

Ensures all list endpoints use PaginatedResponse[T] unless explicitly allowlisted.
This prevents regression — new endpoints returning list[T] will fail this test.
"""
import re
from pathlib import Path

import pytest


ROUTES_DIR = Path(__file__).resolve().parents[2] / "app" / "api" / "routes"

ALLOWLIST = {
    # Bounded datasets (max ~10-20 items) — no pagination needed
    "delivery_zones.py:list[DeliveryZonePublic]",
    "delivery_zones.py:list[DeliveryZoneResponse]",
    "workforce_shifts.py:list[ShiftTemplateResponse]",
    "workforce_checklists.py:list[ChecklistTemplateResponse]",
    "telegram_alerts.py:list[AlertTypeInfo]",
    "telegram_alerts.py:list[UserTelegramInfo]",
    "global_roles.py:list[CustomRoleResponse]",
    "cost_components.py:list[CostComponentTemplateResponse]",
    "workforce_responsibilities.py:list[PositionResponsibilityResponse]",
    "accounting.py:list[BalanceAccountListResponse]",
    "global_accounting.py:list[GlobalBalanceAccountResponse]",
    "documents.py:list[DocumentFolderResponse]",
    "financial_model.py:list[BudgetResponse]",
    "users.py:list[UserSchoolRoleWithSchool]",
    # Garment type images (max ~10 per type)
    "products.py:list[GarmentTypeImageResponse]",
    "global_products.py:list[GarmentTypeImageResponse]",
    # Bounded catalog endpoints (positions, vendor search)
    "catalog.py:list[PositionResponse]",
    "vendors.py:list[VendorSearchResult]",
    # Aggregation endpoints (GROUP BY, not individual records)
    "accounting.py:list[ExpensesByCategory]",
    "global_accounting.py:list[ExpenseCategorySummary]",
    # Action returns (POST/PUT that return the result set)
    "schools.py:list[SchoolListResponse]",  # PUT /reorder
    "workforce_shifts.py:list[ScheduleResponse]",  # POST /schedules/generate
    "workforce_checklists.py:list[DailyChecklistResponse]",  # POST /checklists/generate
    # Public search (scoped by email, typically few results)
    "contacts.py:list[ContactResponse]",
    # Analytics / reports — bounded aggregations (top-N, distributions, GROUP BY),
    # not record listings; pagination would be meaningless.
    "cost_insights.py:list[SchoolCostBreakdown]",
    "cost_insights.py:list[TopMarginProduct]",
    "cost_insights.py:list[ComponentDistribution]",
    "global_reports.py:list[OrdersCumplimientoRow]",
    "global_reports.py:list[OrdersTopProduct]",
    "global_reports.py:list[OrdersTopClient]",
    "global_reports.py:list[AlterationsTopType]",
}

RESPONSE_MODEL_RE = re.compile(r"response_model=list\[(\w+)\]")


def _collect_list_endpoints():
    violations = []
    for route_file in sorted(ROUTES_DIR.glob("*.py")):
        filename = route_file.name
        for lineno, line in enumerate(route_file.read_text().splitlines(), 1):
            match = RESPONSE_MODEL_RE.search(line)
            if match:
                schema = match.group(1)
                key = f"{filename}:list[{schema}]"
                if key not in ALLOWLIST:
                    violations.append(f"{filename}:{lineno} — response_model=list[{schema}]")
    return violations


def test_no_unallowlisted_list_endpoints():
    """Every endpoint returning list[T] must be in the pagination allowlist or use PaginatedResponse."""
    violations = _collect_list_endpoints()
    if violations:
        msg = "Endpoints returning list[T] not in allowlist (should use PaginatedResponse[T]):\n"
        msg += "\n".join(f"  - {v}" for v in violations)
        pytest.fail(msg)
