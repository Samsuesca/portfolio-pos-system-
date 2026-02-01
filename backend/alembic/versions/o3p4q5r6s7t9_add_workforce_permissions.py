"""Add workforce management micro-permissions

Inserts 12 granular permissions for the workforce module:
- workforce.view_shifts, workforce.manage_shifts
- workforce.view_attendance, workforce.manage_attendance
- workforce.view_absences, workforce.manage_absences
- workforce.view_checklists, workforce.manage_checklists
- workforce.view_performance, workforce.manage_performance
- workforce.view_deductions
- workforce.self_checklist

Revision ID: o3p4q5r6s7t9
Revises: o3p4q5r6s7t8
Create Date: 2026-01-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision: str = 'o3p4q5r6s7t9'
down_revision: Union[str, None] = 'o3p4q5r6s7t8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = [
    {"code": "workforce.view_shifts", "name": "Ver turnos", "description": "Ver plantillas de turno y horarios asignados", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.manage_shifts", "name": "Gestionar turnos", "description": "Crear, editar y eliminar plantillas de turno y asignar horarios", "category": "workforce", "is_sensitive": True},
    {"code": "workforce.view_attendance", "name": "Ver asistencia", "description": "Ver registros de asistencia y resumen diario", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.manage_attendance", "name": "Registrar asistencia", "description": "Loguear y editar registros de asistencia de empleados", "category": "workforce", "is_sensitive": True},
    {"code": "workforce.view_absences", "name": "Ver faltas", "description": "Ver registros de faltas y ausencias", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.manage_absences", "name": "Gestionar faltas", "description": "Crear, editar y aprobar registros de faltas", "category": "workforce", "is_sensitive": True},
    {"code": "workforce.view_checklists", "name": "Ver checklists", "description": "Ver plantillas de checklist y checklists diarios", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.manage_checklists", "name": "Gestionar checklists", "description": "Crear plantillas, generar checklists diarios y verificar completitud", "category": "workforce", "is_sensitive": True},
    {"code": "workforce.view_performance", "name": "Ver rendimiento", "description": "Ver metricas y resumen de rendimiento de empleados", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.manage_performance", "name": "Gestionar evaluaciones", "description": "Generar y editar evaluaciones de rendimiento", "category": "workforce", "is_sensitive": True},
    {"code": "workforce.view_deductions", "name": "Ver deducciones", "description": "Ver faltas deducibles para integracion con nomina", "category": "workforce", "is_sensitive": False},
    {"code": "workforce.self_checklist", "name": "Auto-checklist", "description": "Empleado puede marcar sus propios items de checklist diario", "category": "workforce", "is_sensitive": False},
]


def upgrade() -> None:
    conn = op.get_bind()

    for perm in NEW_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]}
        ).fetchone()

        if not existing:
            conn.execute(
                sa.text("""
                    INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
                    VALUES (:id, :code, :name, :description, :category, :is_sensitive, NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "code": perm["code"],
                    "name": perm["name"],
                    "description": perm["description"],
                    "category": perm["category"],
                    "is_sensitive": perm["is_sensitive"],
                }
            )


def downgrade() -> None:
    conn = op.get_bind()
    for perm in NEW_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM permissions WHERE code = :code"),
            {"code": perm["code"]}
        )
