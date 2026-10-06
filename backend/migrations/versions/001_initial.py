"""Users, revocable sessions, and versioned planner snapshots."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("email", sa.String(320), nullable=False, unique=True),
                    sa.Column("password_hash", sa.String(512), nullable=False))
    op.create_table("login_sessions", sa.Column("token_hash", sa.String(64), primary_key=True),
                    sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])
    op.create_table("planners", sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
                    sa.Column("revision", sa.Integer(), nullable=False),
                    sa.Column("data", sa.JSON().with_variant(postgresql.JSONB, "postgresql"), nullable=True))


def downgrade():
    op.drop_table("planners")
    op.drop_table("login_sessions")
    op.drop_table("users")
