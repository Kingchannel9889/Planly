from datetime import datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Planner(Base):
    __tablename__ = "planners"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)


class EntryColumns:
    # Keep ISO strings verbatim so importing a backup preserves its timezone/precision.
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    remaining_minutes: Mapped[int] = mapped_column(Integer)
    deadline: Mapped[str | None] = mapped_column(Text)
    planned_date: Mapped[str | None] = mapped_column(Text, index=True)
    start: Mapped[str | None] = mapped_column(Text)
    end: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[str | None] = mapped_column(Text)
    in_progress: Mapped[bool] = mapped_column(Boolean)
    acknowledged_end: Mapped[str | None] = mapped_column(Text)
    risk_history: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[str] = mapped_column(Text)


class Task(EntryColumns, Base):
    __tablename__ = "tasks"
    __table_args__ = (CheckConstraint("remaining_minutes > 0 AND estimated_minutes > 0", name="tasks_positive_duration"),)


class Appointment(EntryColumns, Base):
    __tablename__ = "appointments"
    __table_args__ = (CheckConstraint('start IS NOT NULL AND "end" IS NOT NULL AND deadline IS NULL', name="appointments_schedule"),)


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    wake: Mapped[str] = mapped_column(String(5))
    sleep: Mapped[str] = mapped_column(String(5))
    review: Mapped[str] = mapped_column(String(5))
    default_duration: Mapped[int] = mapped_column(Integer)
    default_priority: Mapped[str | None] = mapped_column(Text)


class NotificationPreferences(Base):
    __tablename__ = "notification_preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    notifications: Mapped[bool] = mapped_column(Boolean)
    critical_during_sleep: Mapped[bool] = mapped_column(Boolean)
    start_reminders: Mapped[bool] = mapped_column(Boolean)
    risk_reminders: Mapped[bool] = mapped_column(Boolean)
    review_reminder: Mapped[bool] = mapped_column(Boolean)
    wake_summary: Mapped[bool] = mapped_column(Boolean)
    task_reminders: Mapped[bool | None] = mapped_column(Boolean)
    appointment_reminders: Mapped[bool | None] = mapped_column(Boolean)
    urgent_alerts: Mapped[bool | None] = mapped_column(Boolean)
    critical_alerts: Mapped[bool | None] = mapped_column(Boolean)
    quiet_hours: Mapped[bool | None] = mapped_column(Boolean)
