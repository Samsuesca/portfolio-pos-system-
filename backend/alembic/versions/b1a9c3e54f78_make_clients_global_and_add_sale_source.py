"""Make clients global and add sale source tracking

Revision ID: b1a9c3e54f78
Revises: 60744af94978
Create Date: 2025-12-09 12:00:00.000000

Changes:
- Make clients table global (remove school_id requirement)
- Add web authentication fields to clients (optional, for web portal users)
- Add source enum to sales table (desktop_app, web_portal, api)
- Add source enum to orders table
- Create client_students table for student-school relationships
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'b1a9c3e54f78'
down_revision = '60744af94978'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create sale_source enum
    op.execute("CREATE TYPE sale_source_enum AS ENUM ('desktop_app', 'web_portal', 'api')")

    # 2. Add source column to sales table
    op.add_column('sales', sa.Column(
        'source',
        sa.Enum('desktop_app', 'web_portal', 'api', name='sale_source_enum'),
        nullable=True
    ))
    # Set default for existing records
    op.execute("UPDATE sales SET source = 'desktop_app' WHERE source IS NULL")
    # Make non-nullable after setting defaults
    op.alter_column('sales', 'source', nullable=False)

    # 3. Add source column to orders table (reuse same enum)
    op.add_column('orders', sa.Column(
        'source',
        sa.Enum('desktop_app', 'web_portal', 'api', name='sale_source_enum'),
        nullable=True
    ))
    # Set default for existing records
    op.execute("UPDATE orders SET source = 'desktop_app' WHERE source IS NULL")
    # Make non-nullable after setting defaults
    op.alter_column('orders', 'source', nullable=False)

    # 4. Create client_type enum
    op.execute("CREATE TYPE client_type_enum AS ENUM ('regular', 'web')")

    # 5. Add web authentication fields to clients (all optional for regular clients)
    op.add_column('clients', sa.Column(
        'client_type',
        sa.Enum('regular', 'web', name='client_type_enum'),
        server_default='regular',
        nullable=False
    ))
    op.add_column('clients', sa.Column('password_hash', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('clients', sa.Column('verification_token', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('verification_token_expires', sa.DateTime(), nullable=True))
    op.add_column('clients', sa.Column('last_login', sa.DateTime(), nullable=True))

    # 6. Make school_id nullable in clients (transition step)
    op.alter_column('clients', 'school_id', nullable=True)

    # 7. Drop the unique constraint that includes school_id
    op.drop_constraint('uq_school_client_code', 'clients', type_='unique')

    # 8. Create new unique constraint on code only (global uniqueness)
    op.create_unique_constraint('uq_client_code', 'clients', ['code'])

    # 9. Create unique constraint on email for web clients (partial index in PostgreSQL)
    # We use a unique index with a WHERE clause for web clients only
    op.execute("""
        CREATE UNIQUE INDEX ix_clients_email_unique_web
        ON clients (email)
        WHERE client_type = 'web' AND email IS NOT NULL
    """)

    # 10. Create client_students table for student-school relationships
    op.create_table(
        'client_students',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('client_id', UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('school_id', UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_name', sa.String(255), nullable=False),
        sa.Column('student_grade', sa.String(50), nullable=True),
        sa.Column('student_section', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('client_id', 'school_id', 'student_name', name='uq_client_school_student')
    )

    # 11. Create indexes for client_students
    op.create_index('ix_client_students_client_id', 'client_students', ['client_id'])
    op.create_index('ix_client_students_school_id', 'client_students', ['school_id'])

    # 12. Migrate existing student data from clients to client_students
    # Only for clients that have student_name and school_id
    op.execute("""
        INSERT INTO client_students (client_id, school_id, student_name, student_grade, created_at, updated_at)
        SELECT id, school_id, student_name, student_grade, created_at, updated_at
        FROM clients
        WHERE student_name IS NOT NULL AND school_id IS NOT NULL
    """)


def downgrade() -> None:
    # 1. Drop client_students table
    op.drop_index('ix_client_students_school_id', table_name='client_students')
    op.drop_index('ix_client_students_client_id', table_name='client_students')
    op.drop_table('client_students')

    # 2. Drop the web email unique index
    op.execute("DROP INDEX IF EXISTS ix_clients_email_unique_web")

    # 3. Drop the global code unique constraint
    op.drop_constraint('uq_client_code', 'clients', type_='unique')

    # 4. Restore school_id as not nullable (only if data allows)
    # First set school_id to a default for any NULL values
    op.execute("""
        UPDATE clients
        SET school_id = (SELECT id FROM schools LIMIT 1)
        WHERE school_id IS NULL
    """)
    op.alter_column('clients', 'school_id', nullable=False)

    # 5. Recreate the original unique constraint
    op.create_unique_constraint('uq_school_client_code', 'clients', ['school_id', 'code'])

    # 6. Remove web authentication fields from clients
    op.drop_column('clients', 'last_login')
    op.drop_column('clients', 'verification_token_expires')
    op.drop_column('clients', 'verification_token')
    op.drop_column('clients', 'is_verified')
    op.drop_column('clients', 'password_hash')
    op.drop_column('clients', 'client_type')

    # 7. Drop client_type enum
    op.execute("DROP TYPE IF EXISTS client_type_enum")

    # 8. Remove source from orders
    op.drop_column('orders', 'source')

    # 9. Remove source from sales
    op.drop_column('sales', 'source')

    # 10. Drop sale_source enum
    op.execute("DROP TYPE IF EXISTS sale_source_enum")
