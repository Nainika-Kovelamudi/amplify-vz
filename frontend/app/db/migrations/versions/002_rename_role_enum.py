"""rename role enum values to match Azure AD App Roles

Revision ID: 002
Revises: 001
Create Date: 2026-07-02
"""
from alembic import op

revision = "003_rename_role_enum"
down_revision = "002_submission_extended_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'guest' TO 'Aimplify.User'")
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'admin' TO 'Aimplify.Admin'")
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'super_admin' TO 'Amplify.Owner'")


def downgrade() -> None:
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'Aimplify.User' TO 'guest'")
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'Aimplify.Admin' TO 'admin'")
    op.execute("ALTER TYPE user_role_enum RENAME VALUE 'Amplify.Owner' TO 'super_admin'")
