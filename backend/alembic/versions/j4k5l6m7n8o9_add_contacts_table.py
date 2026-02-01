"""add contacts table

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2025-12-16 16:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'j4k5l6m7n8o9'
down_revision = 'i3j4k5l6m7n8'
branch_labels = None
depends_on = None


def upgrade():
    # Create ContactType enum (IF NOT EXISTS)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE contacttype AS ENUM (
                'inquiry', 'request', 'complaint', 'claim', 'suggestion'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create ContactStatus enum (IF NOT EXISTS)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE contactstatus AS ENUM (
                'pending', 'in_review', 'resolved', 'closed'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create contacts table using raw SQL to avoid enum recreation issues
    op.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL,
            phone VARCHAR(20),
            contact_type contacttype NOT NULL,
            subject VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            status contactstatus NOT NULL DEFAULT 'pending',
            is_read BOOLEAN NOT NULL DEFAULT false,
            admin_response TEXT,
            admin_response_date TIMESTAMP,
            responded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
    """)

    # Create indexes
    op.create_index('idx_contacts_status', 'contacts', ['status'])
    op.create_index('idx_contacts_is_read', 'contacts', ['is_read'])
    op.create_index('idx_contacts_created_at', 'contacts', ['created_at'])
    op.create_index('idx_contacts_school_id', 'contacts', ['school_id'])
    op.create_index('idx_contacts_contact_type', 'contacts', ['contact_type'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_contacts_contact_type', table_name='contacts')
    op.drop_index('idx_contacts_school_id', table_name='contacts')
    op.drop_index('idx_contacts_created_at', table_name='contacts')
    op.drop_index('idx_contacts_is_read', table_name='contacts')
    op.drop_index('idx_contacts_status', table_name='contacts')

    # Drop table
    op.drop_table('contacts')

    # Drop enums
    op.execute("DROP TYPE contacttype")
    op.execute("DROP TYPE contactstatus")
