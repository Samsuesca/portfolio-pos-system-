"""Branch retrofit (v3.1 — Fase 0b)

Retrofit ADITIVO Y NULLABLE de la dimensión `branch_id` (sucursales físicas)
sobre las 10 tablas de negocio del sistema EN PRODUCCIÓN, más
`school_identity_id` en `schools`. Diseñado para ser 100% backward-compatible:
con `branch_id = NULL` el sistema se comporta exactamente como hoy.

Reglas duras respetadas:
- CERO columnas NOT NULL nuevas (todas las columnas son nullable).
- CERO backfill destructivo (solo escribe sobre columnas nuevas que están NULL).
- Totalmente reversible (downgrade dropea las columnas).
- Data-migration IDEMPOTENTE (re-ejecutable sin duplicar ni pisar datos).

Columnas añadidas (UUID NULL, FK ON DELETE SET NULL, indexadas):
- `schools.branch_id`, `schools.school_identity_id`
- `sales.branch_id`, `orders.branch_id`, `daily_cash_registers.branch_id`
- `transactions.branch_id`, `expenses.branch_id`, `balance_accounts.branch_id`
- `accounts_receivable.branch_id`, `accounts_payable.branch_id`
- `user_school_roles.branch_id`

Semántica del backfill (a la sucursal "Central" sembrada en Fase 0a):
- schools / sales / orders / daily_cash_registers → TODAS las filas → CENTRAL.
- transactions / expenses / balance_accounts / accounts_receivable /
  accounts_payable → SOLO las filas con `school_id IS NOT NULL`. Las filas
  puramente globales/corporativas quedan `branch_id = NULL` (= consolidado),
  preservando la semántica `school_id`-NULL-global ya establecida.
- user_school_roles → NO se backfillea. `branch_id = NULL` significa "acceso a
  TODAS las sucursales" (admin central), que es el estado de todos los roles
  hoy; backfillearlo a CENTRAL los restringiría = cambio de comportamiento.

Notas de borde:
- `balance_entries` (school_id nullable) NO está en el alcance de esta fase:
  sus saldos se derivan de `balance_accounts`, agregarle `branch_id` sería
  scope creep.
- NO hay `SET NOT NULL` aquí. Promover a NOT NULL las cuatro columnas de
  full-backfill (schools/sales/orders/daily_cash_registers.branch_id) es un
  paso POSTERIOR, tras verificar en prod que no quedan NULL inesperados.
- El downgrade CONSERVA intencionalmente las `school_identities` sembradas en
  3a (son datos, no esquema; borrarlas sería destructivo y podría romper FKs
  si algo las referencia). Eliminarlas es manual y opcional.

Ver `docs/v3/v3-branch-architecture/branch-architecture.md`.

Revision ID: branch_retrofit_001
Revises: b2b_fe_contract_001
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "branch_retrofit_001"
down_revision: Union[str, Sequence[str], None] = "b2b_fe_contract_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Las 10 tablas que reciben branch_id.
_BRANCH_TABLES = [
    "schools", "sales", "orders", "daily_cash_registers",
    "transactions", "expenses", "balance_accounts",
    "accounts_receivable", "accounts_payable", "user_school_roles",
]
# Backfill a CENTRAL solo cuando hay contexto de colegio (school_id NOT NULL);
# las filas globales/corporativas quedan branch_id NULL = consolidado.
_ACCOUNTING_SCOPED = {
    "transactions", "expenses", "balance_accounts",
    "accounts_receivable", "accounts_payable",
}
# Backfill completo a CENTRAL (todas las filas existentes).
_FULL_BACKFILL = {"schools", "sales", "orders", "daily_cash_registers"}


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    # 1) ADD COLUMN branch_id (idempotente: skip si ya existe) + FK + índice.
    for table in _BRANCH_TABLES:
        if not _has_column(table, "branch_id"):
            op.add_column(table, sa.Column("branch_id", UUID(as_uuid=True), nullable=True))
            op.create_foreign_key(
                f"fk_{table}_branch_id", table, "branches",
                ["branch_id"], ["id"], ondelete="SET NULL",
            )
            op.create_index(f"ix_{table}_branch_id", table, ["branch_id"])

    # 2) ADD COLUMN schools.school_identity_id + FK + índice.
    if not _has_column("schools", "school_identity_id"):
        op.add_column("schools", sa.Column("school_identity_id", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_schools_school_identity_id", "schools", "school_identities",
            ["school_identity_id"], ["id"], ondelete="SET NULL",
        )
        op.create_index("ix_schools_school_identity_id", "schools", ["school_identity_id"])

    # 3) DATA MIGRATION (idempotente).
    conn = op.get_bind()

    # 3a) Una school_identity por cada nombre único de school que no exista aún.
    #     INSERT ... SELECT DISTINCT ... WHERE NOT EXISTS → re-ejecutable.
    #     Timestamps en hora local Colombia (naive), igual que branches_foundation_001.
    conn.execute(sa.text("""
        INSERT INTO school_identities
            (id, name, is_active, created_at, updated_at)
        SELECT gen_random_uuid(), s.name, true,
               (now() AT TIME ZONE 'America/Bogota'),
               (now() AT TIME ZONE 'America/Bogota')
        FROM (SELECT DISTINCT name FROM schools) s
        WHERE NOT EXISTS (
            SELECT 1 FROM school_identities si WHERE si.name = s.name
        );
    """))

    # 3b) Linkear schools.school_identity_id por nombre (solo donde aún es NULL).
    conn.execute(sa.text("""
        UPDATE schools s
        SET school_identity_id = si.id
        FROM school_identities si
        WHERE si.name = s.name
          AND s.school_identity_id IS NULL;
    """))

    # 3c) Backfill branch_id = CENTRAL. Resuelve CENTRAL por code; el guard
    #     EXISTS evita tocar filas si por algún motivo no existe la sucursal.
    #     Siempre WHERE branch_id IS NULL ⇒ no re-pisa filas ya asignadas.
    for table in sorted(_FULL_BACKFILL):
        conn.execute(sa.text(f"""
            UPDATE {table}
            SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL')
            WHERE branch_id IS NULL
              AND EXISTS (SELECT 1 FROM branches WHERE code = 'CENTRAL');
        """))

    for table in sorted(_ACCOUNTING_SCOPED):
        conn.execute(sa.text(f"""
            UPDATE {table}
            SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL')
            WHERE branch_id IS NULL
              AND school_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM branches WHERE code = 'CENTRAL');
        """))
    # user_school_roles: NO backfill (NULL = acceso central a todas).


def downgrade() -> None:
    # Drop en orden inverso. Las school_identities sembradas en 3a se CONSERVAN
    # intencionalmente (son datos, no esquema). Eliminarlas es manual y opcional.
    if _has_column("schools", "school_identity_id"):
        op.drop_index("ix_schools_school_identity_id", table_name="schools")
        op.drop_constraint("fk_schools_school_identity_id", "schools", type_="foreignkey")
        op.drop_column("schools", "school_identity_id")

    for table in reversed(_BRANCH_TABLES):
        if _has_column(table, "branch_id"):
            op.drop_index(f"ix_{table}_branch_id", table_name=table)
            op.drop_constraint(f"fk_{table}_branch_id", table, type_="foreignkey")
            op.drop_column(table, "branch_id")
