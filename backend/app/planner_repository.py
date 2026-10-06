"""The API contract stays stable while entities have their own relational tables."""
from sqlalchemy import delete, insert, select
from .models import Task, Appointment, UserSettings, NotificationPreferences

ENTRY = {
    "id": "id", "title": "title", "description": "description", "category": "category",
    "priority": "priority", "estimatedMinutes": "estimated_minutes", "remainingMinutes": "remaining_minutes",
    "deadline": "deadline", "plannedDate": "planned_date", "start": "start", "end": "end",
    "completedAt": "completed_at", "inProgress": "in_progress", "acknowledgedEnd": "acknowledged_end",
    "riskHistory": "risk_history", "createdAt": "created_at",
}
SETTINGS = {"name": "name", "email": "email", "wake": "wake", "sleep": "sleep", "review": "review",
            "defaultDuration": "default_duration", "defaultPriority": "default_priority"}
NOTIFICATIONS = {"notifications": "notifications", "criticalDuringSleep": "critical_during_sleep",
                 "startReminders": "start_reminders", "riskReminders": "risk_reminders",
                 "reviewReminder": "review_reminder", "wakeSummary": "wake_summary",
                 "taskReminders": "task_reminders", "appointmentReminders": "appointment_reminders",
                 "urgentAlerts": "urgent_alerts", "criticalAlerts": "critical_alerts", "quietHours": "quiet_hours"}


def columns(data, mapping):
    return {column: data.get(field) for field, column in mapping.items()}


def fields(row, mapping):
    return {field: row[column] for field, column in mapping.items() if row[column] is not None}


def write_entities(db, user_id, data):
    # Called inside the same transaction as the optimistic revision update.
    for model in (Task, Appointment, UserSettings, NotificationPreferences):
        db.execute(delete(model).where(model.user_id == user_id))
    for model, kind in ((Task, "task"), (Appointment, "appointment")):
        rows = [{"user_id": user_id, "position": position, **columns(entry, ENTRY)}
                for position, entry in enumerate(data["entries"]) if entry["kind"] == kind]
        if rows:
            db.execute(insert(model.__table__), rows)
    db.execute(insert(UserSettings.__table__), {"user_id": user_id, **columns(data["settings"], SETTINGS)})
    db.execute(insert(NotificationPreferences.__table__), {"user_id": user_id, **columns(data["settings"], NOTIFICATIONS)})


def read_entities(db, user_id, snapshot):
    if snapshot is None:
        return None
    settings = db.execute(select(UserSettings.__table__).where(UserSettings.user_id == user_id)).mappings().one()
    notifications = db.execute(select(NotificationPreferences.__table__).where(NotificationPreferences.user_id == user_id)).mappings().one()
    entries = []
    for model, kind in ((Task, "task"), (Appointment, "appointment")):
        for row in db.execute(select(model.__table__).where(model.user_id == user_id)).mappings():
            entries.append((row["position"], {"kind": kind, **fields(row, ENTRY)}))
    return {**snapshot, "settings": {**snapshot["settings"], **fields(settings, SETTINGS), **fields(notifications, NOTIFICATIONS)},
            "entries": [entry for _, entry in sorted(entries, key=lambda item: item[0])]}
