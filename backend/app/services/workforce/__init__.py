"""
Workforce Management Services
"""
from app.services.workforce.shifts import shift_service
from app.services.workforce.attendance import attendance_service
from app.services.workforce.checklists import checklist_service
from app.services.workforce.performance import performance_service
from app.services.workforce.responsibilities import responsibility_service

__all__ = [
    "shift_service",
    "attendance_service",
    "checklist_service",
    "performance_service",
    "responsibility_service",
]
