"""Exercise the exact migration against an isolated database containing a legacy planner."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, insert, MetaData, Table, select
from sqlalchemy.orm import Session

from app.planner_repository import read_entities


def migration(name):
    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / name
    # Container test files are copied separately; migrations are in /app.
    if not path.exists():
        path = Path("migrations/versions") / name
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_backfill_preserves_entries_revision_settings_and_snapshot():
    engine = create_engine("sqlite://")
    data = {"version": 1, "onboarded": True, "reviewedDate": "2026-10-05", "entries": [{
        "id": "legacy", "kind": "task", "title": "Keep me", "description": "", "category": "Personal",
        "priority": "Medium", "estimatedMinutes": 30, "remainingMinutes": 30, "inProgress": False,
        "createdAt": "2026-10-05T00:00:00.000Z", "riskHistory": {}}], "settings": {
        "name": "User", "wake": "07:00", "sleep": "23:00", "review": "21:00", "defaultDuration": 30,
        "notifications": False, "criticalDuringSleep": False, "startReminders": True,
        "riskReminders": True, "reviewReminder": True, "wakeSummary": True}}
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration("001_initial.py").upgrade()
            users = Table("users", MetaData(), autoload_with=connection)
            planners = Table("planners", MetaData(), autoload_with=connection)
            connection.execute(insert(users), {"id": "owner", "email": "owner@example.com", "password_hash": "test-only"})
            connection.execute(insert(planners), {"user_id": "owner", "revision": 7, "data": data})
            migration("002_planner_entities.py").upgrade()
            with Session(bind=connection) as db:
                assert read_entities(db, "owner", data) == data
            row = connection.execute(select(planners)).mappings().one()
            assert row["revision"] == 7 and row["data"] == data
    engine.dispose()
