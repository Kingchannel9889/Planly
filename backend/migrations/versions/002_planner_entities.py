"""Dedicated task, appointment, settings and notification tables; preserve snapshots."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002"
down_revision = "001"

ENTRY = {"id": "id", "title": "title", "description": "description", "category": "category",
         "priority": "priority", "estimatedMinutes": "estimated_minutes", "remainingMinutes": "remaining_minutes",
         "deadline": "deadline", "plannedDate": "planned_date", "start": "start", "end": "end",
         "completedAt": "completed_at", "inProgress": "in_progress", "acknowledgedEnd": "acknowledged_end",
         "riskHistory": "risk_history", "createdAt": "created_at"}
SETTINGS = {"name": "name", "email": "email", "wake": "wake", "sleep": "sleep", "review": "review",
            "defaultDuration": "default_duration", "defaultPriority": "default_priority"}
NOTIFICATIONS = {"notifications": "notifications", "criticalDuringSleep": "critical_during_sleep",
                 "startReminders": "start_reminders", "riskReminders": "risk_reminders",
                 "reviewReminder": "review_reminder", "wakeSummary": "wake_summary",
                 "taskReminders": "task_reminders", "appointmentReminders": "appointment_reminders",
                 "urgentAlerts": "urgent_alerts", "criticalAlerts": "critical_alerts", "quietHours": "quiet_hours"}


def owner():
    return sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


def entry_columns():
    optional = {"deadline", "planned_date", "start", "end", "completed_at", "acknowledged_end"}
    columns = [owner(), sa.Column("id", sa.Text(), primary_key=True), sa.Column("position", sa.Integer(), nullable=False)]
    for name in ENTRY.values():
        if name == "id":
            continue
        kind = sa.Integer() if name in {"estimated_minutes", "remaining_minutes"} else sa.Boolean() if name == "in_progress" else sa.JSON().with_variant(JSONB, "postgresql") if name == "risk_history" else sa.Text()
        columns.append(sa.Column(name, kind, nullable=name in optional))
    return columns


def upgrade():
    tasks = op.create_table("tasks", *entry_columns(), sa.CheckConstraint("remaining_minutes > 0 AND estimated_minutes > 0", name="tasks_positive_duration"))
    appointments = op.create_table("appointments", *entry_columns(), sa.CheckConstraint('start IS NOT NULL AND "end" IS NOT NULL AND deadline IS NULL', name="appointments_schedule"))
    for table in ("tasks", "appointments"):
        op.create_index(f"ix_{table}_planned_date", table, ["planned_date"])
    settings = op.create_table("user_settings", owner(), *[
        sa.Column(name, sa.Integer() if name == "default_duration" else sa.String(5) if name in {"wake", "sleep", "review"} else sa.Text(), nullable=name in {"email", "default_priority"})
        for name in SETTINGS.values()])
    notifications = op.create_table("notification_preferences", owner(), *[
        sa.Column(name, sa.Boolean(), nullable=field in {"taskReminders", "appointmentReminders", "urgentAlerts", "criticalAlerts", "quietHours"})
        for field, name in NOTIFICATIONS.items()])
    connection = op.get_bind()
    planners = sa.table("planners", sa.column("user_id", sa.String()), sa.column("data", sa.JSON()))
    for row in connection.execute(sa.select(planners)).mappings():
        data = row["data"]
        if data is None:
            continue
        user_id = row["user_id"]
        for position, entry in enumerate(data["entries"]):
            table = tasks if entry["kind"] == "task" else appointments
            connection.execute(table.insert().values(user_id=user_id, position=position, **{column: entry.get(field) for field, column in ENTRY.items()}))
        connection.execute(settings.insert().values(user_id=user_id, **{column: data["settings"].get(field) for field, column in SETTINGS.items()}))
        connection.execute(notifications.insert().values(user_id=user_id, **{column: data["settings"].get(field) for field, column in NOTIFICATIONS.items()}))


def downgrade():
    for table in ("notification_preferences", "user_settings", "appointments", "tasks"):
        op.drop_table(table)
