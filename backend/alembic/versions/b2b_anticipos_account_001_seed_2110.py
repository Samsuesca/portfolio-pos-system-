"""B2B (B3) — sembrar cuenta 2110 "Anticipos de Clientes" (pasivo)

El ciclo de vida contable de los contratos B2B made-to-order modela el anticipo
como un PASIVO (ingreso diferido), no como ingreso. Esta migración siembra de
forma idempotente la cuenta global 2110 (LIABILITY_CURRENT, school_id NULL).

GOTCHA ENUM: ``account_type`` se almacena en MAYÚSCULAS ('LIABILITY_CURRENT').
El tipo enum ``account_type_enum`` ya existe — esta migración NO lo crea ni lo
dropea. El INSERT usa el literal 'LIABILITY_CURRENT' (uppercase) para coincidir
con los labels del enum y con el ``CheckConstraint chk_balance_account_sign``
(``account_type::text LIKE 'LIABILITY%'``), que exime al pasivo de balance >= 0.

El servicio ``ContractAccountingMixin._get_or_create_anticipos_account`` crea la
cuenta de forma defensiva en runtime, así que el sistema funciona aunque esta
migración no se aplique; sembrarla aquí garantiza la cuenta en bases existentes.

Revision ID: b2b_anticipos_account_001
Revises: b2b_model_001
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2b_anticipos_account_001"
down_revision: Union[str, Sequence[str], None] = "b2b_model_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: solo inserta si no existe la cuenta 2110 global.
    op.execute(
        """
        INSERT INTO balance_accounts
            (id, school_id, account_type, name, code, description, balance,
             is_active, created_at, updated_at)
        SELECT
            gen_random_uuid(), NULL, 'LIABILITY_CURRENT',
            'Anticipos de Clientes', '2110',
            'Anticipos recibidos de clientes B2B (ingreso diferido)',
            0, true, now(), now()
        WHERE NOT EXISTS (
            SELECT 1 FROM balance_accounts
            WHERE code = '2110' AND school_id IS NULL
        )
        """
    )


def downgrade() -> None:
    # Guard de balance 0: no borra la cuenta si ya tiene movimientos.
    op.execute(
        """
        DELETE FROM balance_accounts
        WHERE code = '2110' AND school_id IS NULL AND balance = 0
        """
    )
