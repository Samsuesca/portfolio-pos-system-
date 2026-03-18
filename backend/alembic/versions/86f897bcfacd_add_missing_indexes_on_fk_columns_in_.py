"""add missing indexes on FK columns in accounting tables

Revision ID: 86f897bcfacd
Revises: 768f87bbdaf5
Create Date: 2026-03-15 04:57:00.628850

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "86f897bcfacd"
down_revision = "768f87bbdaf5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------
    # Add missing indexes on FK columns in accounting tables
    # for query performance (JOINs, WHERE clauses)
    # -------------------------------------------------------

    # -- transactions table --
    op.create_index(op.f("ix_transactions_sale_id"), "transactions", ["sale_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_transactions_order_id"), "transactions", ["order_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_transactions_expense_id"), "transactions", ["expense_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_transactions_transfer_to_account_id"), "transactions", ["transfer_to_account_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_transactions_created_by"), "transactions", ["created_by"], unique=False, if_not_exists=True)

    # -- expenses table --
    op.create_index(op.f("ix_expenses_created_by"), "expenses", ["created_by"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_expenses_payment_account_id"), "expenses", ["payment_account_id"], unique=False, if_not_exists=True)

    # -- daily_cash_registers table --
    op.create_index(op.f("ix_daily_cash_registers_closed_by"), "daily_cash_registers", ["closed_by"], unique=False, if_not_exists=True)

    # -- balance_accounts table --
    op.create_index(op.f("ix_balance_accounts_created_by"), "balance_accounts", ["created_by"], unique=False, if_not_exists=True)

    # -- balance_entries table --
    op.create_index(op.f("ix_balance_entries_created_by"), "balance_entries", ["created_by"], unique=False, if_not_exists=True)

    # -- accounts_receivable table --
    op.create_index(op.f("ix_accounts_receivable_sale_id"), "accounts_receivable", ["sale_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_accounts_receivable_created_by"), "accounts_receivable", ["created_by"], unique=False, if_not_exists=True)

    # -- accounts_payable table --
    op.create_index(op.f("ix_accounts_payable_created_by"), "accounts_payable", ["created_by"], unique=False, if_not_exists=True)

    # -- expense_adjustments table --
    op.create_index(op.f("ix_expense_adjustments_previous_payment_account_id"), "expense_adjustments", ["previous_payment_account_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_expense_adjustments_new_payment_account_id"), "expense_adjustments", ["new_payment_account_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_expense_adjustments_refund_entry_id"), "expense_adjustments", ["refund_entry_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_expense_adjustments_new_payment_entry_id"), "expense_adjustments", ["new_payment_entry_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_expense_adjustments_adjusted_by"), "expense_adjustments", ["adjusted_by"], unique=False, if_not_exists=True)

    # -- debt_payment_schedule table --
    op.create_index(op.f("ix_debt_payment_schedule_payment_account_id"), "debt_payment_schedule", ["payment_account_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_debt_payment_schedule_balance_account_id"), "debt_payment_schedule", ["balance_account_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_debt_payment_schedule_accounts_payable_id"), "debt_payment_schedule", ["accounts_payable_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_debt_payment_schedule_created_by"), "debt_payment_schedule", ["created_by"], unique=False, if_not_exists=True)

    # -- caja_menor_config table --
    op.create_index(op.f("ix_caja_menor_config_updated_by"), "caja_menor_config", ["updated_by"], unique=False, if_not_exists=True)

    # -- financial_snapshots table --
    op.create_index(op.f("ix_financial_snapshots_created_by"), "financial_snapshots", ["created_by"], unique=False, if_not_exists=True)


def downgrade() -> None:
    # -- financial_snapshots table --
    op.drop_index(op.f("ix_financial_snapshots_created_by"), table_name="financial_snapshots")

    # -- caja_menor_config table --
    op.drop_index(op.f("ix_caja_menor_config_updated_by"), table_name="caja_menor_config")

    # -- debt_payment_schedule table --
    op.drop_index(op.f("ix_debt_payment_schedule_created_by"), table_name="debt_payment_schedule")
    op.drop_index(op.f("ix_debt_payment_schedule_accounts_payable_id"), table_name="debt_payment_schedule")
    op.drop_index(op.f("ix_debt_payment_schedule_balance_account_id"), table_name="debt_payment_schedule")
    op.drop_index(op.f("ix_debt_payment_schedule_payment_account_id"), table_name="debt_payment_schedule")

    # -- expense_adjustments table --
    op.drop_index(op.f("ix_expense_adjustments_adjusted_by"), table_name="expense_adjustments")
    op.drop_index(op.f("ix_expense_adjustments_new_payment_entry_id"), table_name="expense_adjustments")
    op.drop_index(op.f("ix_expense_adjustments_refund_entry_id"), table_name="expense_adjustments")
    op.drop_index(op.f("ix_expense_adjustments_new_payment_account_id"), table_name="expense_adjustments")
    op.drop_index(op.f("ix_expense_adjustments_previous_payment_account_id"), table_name="expense_adjustments")

    # -- accounts_payable table --
    op.drop_index(op.f("ix_accounts_payable_created_by"), table_name="accounts_payable")

    # -- accounts_receivable table --
    op.drop_index(op.f("ix_accounts_receivable_created_by"), table_name="accounts_receivable")
    op.drop_index(op.f("ix_accounts_receivable_sale_id"), table_name="accounts_receivable")

    # -- balance_entries table --
    op.drop_index(op.f("ix_balance_entries_created_by"), table_name="balance_entries")

    # -- balance_accounts table --
    op.drop_index(op.f("ix_balance_accounts_created_by"), table_name="balance_accounts")

    # -- daily_cash_registers table --
    op.drop_index(op.f("ix_daily_cash_registers_closed_by"), table_name="daily_cash_registers")

    # -- expenses table --
    op.drop_index(op.f("ix_expenses_payment_account_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_created_by"), table_name="expenses")

    # -- transactions table --
    op.drop_index(op.f("ix_transactions_created_by"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_transfer_to_account_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_expense_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_order_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_sale_id"), table_name="transactions")
