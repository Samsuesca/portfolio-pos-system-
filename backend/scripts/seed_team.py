"""Alinea el equipo UCR en el módulo de nómina con el roadmap de formalización (Fase 1).

Refleja docs/v3/formalization/equipo-roadmap-2026.md (Fase 1, cifras de mayo 2026).
NO crea empleados duplicados: matchea los registros REALES existentes por su
documento de identidad y los actualiza, preservando la cédula real y vinculando
cada empleado a su cuenta de usuario del sistema (employees.user_id).

Idempotente — re-ejecutable sin duplicar. Claves naturales:
- positions          → `code`
- employees          → `document_id` real (o el de creación para quien no exista)
- employee_bonuses   → (employee_id, name)

Modelado (decisiones del owner):
- Sobrescribe posición + base_salary + bonos con los valores del roadmap Fase 1.
- Preserva user_id y la cédula real de cada empleado.
- Felipe se vincula a la cuenta 'felipe' (admin del sistema = Felipe persona).
- Santiago es MEDIO TIEMPO → compensación a la mitad.
- Angel (CTO) mantiene salario simbólico ($10k): su compensación real es equity,
  no nómina. El modelo tiene CHECK base_salary > 0, por eso no puede ser 0.
- Salomé no tenía empleado → se crea, vinculado a la cuenta 'salome'.
- Fase 1 informal: deducciones salud/pensión = 0 (sin contrato laboral aún).

Uso:
    cd backend
    venv/bin/python -m scripts.seed_team            # dry-run (rollback, no persiste)
    venv/bin/python -m scripts.seed_team --commit   # persiste en la DB configurada
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.payroll import (
    BonusType,
    Employee,
    EmployeeBonus,
    PaymentFrequency,
    Position,
)
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger("seed_team")

PHASE_1_START = date(2026, 5, 1)


# ----------------------------------------------------------------------------
# Catálogo de posiciones del roadmap
# ----------------------------------------------------------------------------
POSITIONS: list[dict[str, str | int]] = [
    {"code": "OWNER_CEO", "name": "Owner / CEO", "sort_order": 1,
     "description": "Dueña del negocio. Representante legal de la SAS, líder operativa, cofundadora."},
    {"code": "CTO", "name": "CTO / Cofundador tech", "sort_order": 2,
     "description": "Responsable de la plataforma tecnológica y dirección estratégica."},
    {"code": "LIDER_OP", "name": "Líder operativo", "sort_order": 3,
     "description": "Operación general, rumbo gerente de sucursal."},
    {"code": "MKT_CX", "name": "Marketing y Experiencia Cliente", "sort_order": 4,
     "description": "Marca, canales digitales y experiencia del cliente."},
    {"code": "ANALISTA_FIN", "name": "Analista financiero", "sort_order": 5,
     "description": "Modelo financiero, presupuesto, costeo y reportes."},
]


# ----------------------------------------------------------------------------
# Equipo — alineación con roadmap Fase 1 (mayo 2026)
# ----------------------------------------------------------------------------
# match_document: cédula del empleado REAL existente a actualizar (None → crear).
# create_document: cédula a usar si hay que crear el empleado (placeholder editable).
# username: cuenta de usuario del sistema a la que se vincula employees.user_id.
# bonuses: lista de (name, amount, BonusType).
TeamMember = dict[str, object]

TEAM: list[TeamMember] = [
    {
        "match_document": "42799422",
        "username": "chelorios",
        "full_name": "Consuelo Ríos",
        "position": "Owner / CEO",
        "base_salary": Decimal("3500000"),
        "bonuses": [],
    },
    {
        "match_document": "10038086",
        "username": "felipe",  # cuenta admin = Felipe persona (decisión owner)
        "full_name": "Felipe Suesca",
        "position": "Líder operativo",
        "base_salary": Decimal("1000000"),
        "bonuses": [
            ("Bono de estudio", Decimal("300000"), BonusType.FIXED),
            ("Auxilio alimentación", Decimal("200000"), BonusType.FIXED),
        ],
    },
    {
        "match_document": None,  # Salomé no tenía empleado → crear
        "create_document": "SALOME-PENDIENTE",  # reemplazar con cédula real desde la UI
        "username": "salome",
        "full_name": "Salomé F",
        "position": "Marketing y Experiencia Cliente",
        "base_salary": Decimal("1000000"),
        "bonuses": [
            ("Bono de estudio", Decimal("300000"), BonusType.FIXED),
            ("Auxilio alimentación", Decimal("200000"), BonusType.FIXED),
        ],
    },
    {
        "match_document": "102310129",
        "username": "santimazo",
        "full_name": "Santiago Mazo",
        "position": "Analista financiero",
        "base_salary": Decimal("500000"),  # medio tiempo
        "bonuses": [
            ("Bono de estudio", Decimal("150000"), BonusType.FIXED),
            ("Auxilio alimentación", Decimal("100000"), BonusType.FIXED),
        ],
    },
    {
        "match_document": "1051065798",
        "username": "samuel",
        "full_name": "Angel Samuel Suesca Rios",
        "position": "CTO / Cofundador tech",
        "base_salary": Decimal("10000"),  # simbólico: comp real es equity (CHECK base_salary > 0)
        "bonuses": [],
    },
]


async def seed_positions(db: AsyncSession) -> int:
    changed = 0
    for spec in POSITIONS:
        existing = (
            await db.execute(select(Position).where(Position.code == spec["code"]))
        ).scalar_one_or_none()
        if existing is None:
            db.add(Position(
                code=str(spec["code"]), name=str(spec["name"]),
                description=str(spec["description"]), sort_order=int(spec["sort_order"]),
                is_active=True,
            ))
            logger.info("  + position %s (%s)", spec["code"], spec["name"])
            changed += 1
        else:
            existing.name = str(spec["name"])
            existing.description = str(spec["description"])
            existing.sort_order = int(spec["sort_order"])
            existing.is_active = True
            logger.info("  ~ position %s (actualizada)", spec["code"])
    return changed


async def _resolve_user_id(db: AsyncSession, username: str) -> tuple[str | None, str]:
    """Devuelve (user_id, nota) para el username dado."""
    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if user is None:
        return None, f"usuario '{username}' NO encontrado — se deja sin vínculo"
    return user.id, f"vinculado a usuario '{username}'"


async def seed_team(db: AsyncSession) -> int:
    changed = 0
    for member in TEAM:
        username = str(member["username"])
        user_id, user_note = await _resolve_user_id(db, username)

        match_document = member["match_document"]
        employee: Employee | None = None
        if match_document is not None:
            employee = (
                await db.execute(
                    select(Employee).where(Employee.document_id == str(match_document))
                )
            ).scalar_one_or_none()

        if employee is None:
            # Crear (caso Salomé, o si el documento real no estaba)
            doc = str(member.get("create_document") or match_document)
            employee = Employee(
                full_name=str(member["full_name"]),
                document_type="CC",
                document_id=doc,
                position=str(member["position"]),
                hire_date=PHASE_1_START,
                is_active=True,
                base_salary=member["base_salary"],  # type: ignore[arg-type]
                payment_frequency=PaymentFrequency.MONTHLY,
                payment_method="transfer",
                health_deduction=Decimal("0"),
                pension_deduction=Decimal("0"),
                other_deductions=Decimal("0"),
                user_id=user_id,
            )
            db.add(employee)
            await db.flush()
            logger.info("  + empleado %s (doc %s) — %s, base %s — %s",
                        member["full_name"], doc, member["position"], member["base_salary"], user_note)
            changed += 1
        else:
            # Actualizar el registro REAL, preservando su cédula real
            employee.full_name = str(member["full_name"])
            employee.position = str(member["position"])
            employee.base_salary = member["base_salary"]  # type: ignore[assignment]
            employee.is_active = True
            if user_id is not None:
                employee.user_id = user_id
            logger.info("  ~ empleado %s (doc %s) — %s, base %s — %s",
                        member["full_name"], employee.document_id, member["position"],
                        member["base_salary"], user_note)
            changed += 1

        for bonus_name, amount, bonus_type in member["bonuses"]:  # type: ignore[attr-defined]
            existing_bonus = (
                await db.execute(
                    select(EmployeeBonus).where(
                        EmployeeBonus.employee_id == employee.id,
                        EmployeeBonus.name == bonus_name,
                    )
                )
            ).scalar_one_or_none()
            if existing_bonus is None:
                db.add(EmployeeBonus(
                    employee_id=employee.id, name=bonus_name, bonus_type=bonus_type,
                    amount=amount, is_recurring=True, start_date=PHASE_1_START,
                    end_date=None, is_active=True,
                    notes="Seed Fase 1 — ajustar al pasar a Fase 2 (contrato formal)",
                ))
                logger.info("      + bono %s: %s", bonus_name, amount)
                changed += 1
            else:
                existing_bonus.amount = amount
                existing_bonus.is_active = True
                logger.info("      ~ bono %s (actualizado): %s", bonus_name, amount)

    return changed


async def main(commit: bool) -> None:
    mode = "COMMIT (persiste)" if commit else "DRY-RUN (rollback)"
    logger.info("=== Alineación equipo UCR — módulo nómina — %s ===", mode)

    async with AsyncSessionLocal() as db:
        logger.info("Posiciones:")
        n_pos = await seed_positions(db)
        logger.info("Empleados y bonos:")
        n_team = await seed_team(db)

        total = n_pos + n_team
        if commit:
            await db.commit()
            logger.info("=== OK — %d registros nuevos/actualizados persistidos ===", total)
        else:
            await db.rollback()
            logger.info("=== DRY-RUN — %d cambios simulados (rollback). "
                        "Re-ejecuta con --commit para aplicar. ===", total)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alinea el equipo UCR en el módulo de nómina.")
    parser.add_argument("--commit", action="store_true", help="Persiste los cambios (sin esto es dry-run).")
    args = parser.parse_args()
    asyncio.run(main(commit=args.commit))
