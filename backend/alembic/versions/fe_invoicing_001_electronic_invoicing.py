"""Electronic invoicing (Facturacion Electronica DIAN via Alegra)

Adds:
- clients.identification_type / identification_number  (DIAN buyer identity)
- electronic_invoices table                            (one row per emission)
- invoicing.* permission catalog rows bound to ADMIN + OWNER system roles

The permission rows are required: routes guard with
require_global_permission("invoicing.*") and the startup validator raises in
production if a referenced code is missing from the permissions table.

Revision ID: fe_invoicing_001
Revises: v3_school_global_gt_excl_001
Create Date: 2026-05-30
"""
from typing import Sequence, Union
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "fe_invoicing_001"
down_revision: Union[str, Sequence[str], None] = "v3_school_global_gt_excl_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    {
        "code": "invoicing.emit",
        "name": "Emitir factura electronica",
        "description": (
            "Emitir facturas electronicas DIAN (via Alegra) para ventas, "
            "encargos y arreglos."
        ),
        "category": "invoicing",
        "is_sensitive": True,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "invoicing.view",
        "name": "Ver facturas electronicas",
        "description": (
            "Consultar el estado, numero, CUFE y archivos PDF/XML de las "
            "facturas electronicas emitidas."
        ),
        "category": "invoicing",
        "is_sensitive": False,
        "default_system_roles": ["admin", "owner"],
    },
    {
        "code": "invoicing.void",
        "name": "Anular factura electronica",
        "description": (
            "Anular una factura electronica ya timbrada emitiendo una nota "
            "credito DIAN."
        ),
        "category": "invoicing",
        "is_sensitive": True,
        "default_system_roles": ["admin", "owner"],
    },
]


def upgrade() -> None:
    # ── Enums ────────────────────────────────────────────────────────
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE identification_type_enum AS ENUM ('CC', 'NIT', 'CE', 'TI', 'PA');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE invoice_document_type_enum AS ENUM ('sale', 'order', 'alteration');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE electronic_invoice_status_enum AS ENUM ('pending', 'emitted', 'failed', 'voided');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # ── clients identification columns ───────────────────────────────
    op.add_column(
        "clients",
        sa.Column(
            "identification_type",
            postgresql.ENUM(
                "CC", "NIT", "CE", "TI", "PA",
                name="identification_type_enum",
                create_type=False,
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "clients",
        sa.Column("identification_number", sa.String(length=30), nullable=True),
    )
    op.create_index(
        "ix_clients_identification_number", "clients", ["identification_number"]
    )

    # ── electronic_invoices table ────────────────────────────────────
    op.create_table(
        "electronic_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_type",
            postgresql.ENUM(
                "sale", "order", "alteration",
                name="invoice_document_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("alteration_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending", "emitted", "failed", "voided",
                name="electronic_invoice_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("alegra_invoice_id", sa.String(length=50), nullable=True),
        sa.Column("full_number", sa.String(length=50), nullable=True),
        sa.Column("cufe", sa.String(length=120), nullable=True),
        sa.Column("legal_status", sa.String(length=60), nullable=True),
        sa.Column("pdf_url", sa.Text(), nullable=True),
        sa.Column("xml_url", sa.Text(), nullable=True),
        sa.Column("total", sa.Numeric(12, 2), nullable=True),
        sa.Column("client_name", sa.String(length=255), nullable=True),
        sa.Column("client_identification", sa.String(length=30), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("credit_note_alegra_id", sa.String(length=50), nullable=True),
        sa.Column("credit_note_number", sa.String(length=50), nullable=True),
        sa.Column("credit_note_cufe", sa.String(length=120), nullable=True),
        sa.Column("void_reason", sa.Text(), nullable=True),
        sa.Column("voided_at", sa.DateTime(), nullable=True),
        sa.Column("emitted_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["alteration_id"], ["alterations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "(CASE WHEN sale_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN alteration_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="chk_electronic_invoice_single_document",
        ),
    )
    op.create_index("ix_electronic_invoices_document_type", "electronic_invoices", ["document_type"])
    op.create_index("ix_electronic_invoices_status", "electronic_invoices", ["status"])
    op.create_index("ix_electronic_invoices_sale_id", "electronic_invoices", ["sale_id"])
    op.create_index("ix_electronic_invoices_order_id", "electronic_invoices", ["order_id"])
    op.create_index("ix_electronic_invoices_alteration_id", "electronic_invoices", ["alteration_id"])
    op.create_index("ix_electronic_invoices_alegra_invoice_id", "electronic_invoices", ["alegra_invoice_id"])

    # ── Seed permissions + bind to system roles ──────────────────────
    _seed_permissions()


def _seed_permissions() -> None:
    conn = op.get_bind()
    now = datetime.utcnow()

    for perm in NEW_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]},
        ).fetchone()
        if existing:
            perm_id = existing[0]
        else:
            perm_id = str(uuid.uuid4())
            conn.execute(
                sa.text(
                    """
                    INSERT INTO permissions
                        (id, code, name, description, category, is_sensitive, created_at)
                    VALUES
                        (:id, :code, :name, :description, :category, :is_sensitive, :created_at)
                    """
                ),
                {
                    "id": perm_id,
                    "code": perm["code"],
                    "name": perm["name"],
                    "description": perm["description"],
                    "category": perm["category"],
                    "is_sensitive": perm["is_sensitive"],
                    "created_at": now,
                },
            )

        for role_code in perm["default_system_roles"]:
            role = conn.execute(
                sa.text(
                    "SELECT id FROM custom_roles "
                    "WHERE code = :code AND is_system = true AND school_id IS NULL"
                ),
                {"code": role_code},
            ).fetchone()
            if not role:
                continue

            already = conn.execute(
                sa.text(
                    "SELECT 1 FROM role_permissions "
                    "WHERE role_id = :role_id AND permission_id = :perm_id"
                ),
                {"role_id": role[0], "perm_id": perm_id},
            ).fetchone()
            if already:
                continue

            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions
                        (id, role_id, permission_id, requires_approval, created_at)
                    VALUES
                        (:id, :role_id, :perm_id, false, :created_at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "role_id": role[0],
                    "perm_id": perm_id,
                    "created_at": now,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()

    # Remove seeded permissions (+ their role bindings)
    for perm in NEW_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]},
        ).fetchone()
        if not existing:
            continue
        perm_id = existing[0]
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )

    op.drop_index("ix_electronic_invoices_alegra_invoice_id", table_name="electronic_invoices")
    op.drop_index("ix_electronic_invoices_alteration_id", table_name="electronic_invoices")
    op.drop_index("ix_electronic_invoices_order_id", table_name="electronic_invoices")
    op.drop_index("ix_electronic_invoices_sale_id", table_name="electronic_invoices")
    op.drop_index("ix_electronic_invoices_status", table_name="electronic_invoices")
    op.drop_index("ix_electronic_invoices_document_type", table_name="electronic_invoices")
    op.drop_table("electronic_invoices")

    op.drop_index("ix_clients_identification_number", table_name="clients")
    op.drop_column("clients", "identification_number")
    op.drop_column("clients", "identification_type")

    op.execute("DROP TYPE IF EXISTS electronic_invoice_status_enum")
    op.execute("DROP TYPE IF EXISTS invoice_document_type_enum")
    op.execute("DROP TYPE IF EXISTS identification_type_enum")
