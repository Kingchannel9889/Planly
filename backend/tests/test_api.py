"""Isolated test database; never point this suite at the development planner database."""
import os
import tempfile
from datetime import datetime, timedelta, timezone

test_url = os.environ.get("PLANLY_TEST_DATABASE_URL")
if test_url and not test_url.endswith("/planly_test"):
    raise RuntimeError("PostgreSQL tests require a dedicated database named planly_test.")
os.environ["DATABASE_URL"] = test_url or "sqlite:///" + tempfile.mktemp(suffix=".sqlite3")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.main import app, attempts
from app.models import LoginSession, User
from app.models import Task, Appointment, UserSettings, NotificationPreferences, Planner

client = TestClient(app)
PASSWORD = "correct horse battery staple"


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.create_all(engine)
    attempts.clear()
    yield
    Base.metadata.drop_all(engine)


def register(email="alice@example.com"):
    response = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return response.json()


def headers(session):
    return {"Authorization": "Bearer " + session["token"]}


def planner():
    return {"version": 1, "onboarded": True, "entries": [], "settings": {
        "name": "Alice", "wake": "07:00", "sleep": "23:00", "review": "21:00", "defaultDuration": 30,
        "notifications": False, "criticalDuringSleep": False, "startReminders": True,
        "riskReminders": True, "reviewReminder": True, "wakeSummary": True}}


def test_registration_password_hash_and_revocation():
    session = register()
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.password_hash != PASSWORD and user.password_hash.startswith("$argon2")
        assert db.scalar(select(LoginSession)).token_hash != session["token"]
    assert client.get("/auth/me", headers=headers(session)).status_code == 200
    assert client.post("/auth/logout", headers=headers(session)).status_code == 204
    assert client.get("/planner", headers=headers(session)).status_code == 401


def test_account_isolation_and_stale_writes():
    alice, bob = register(), register("bob@example.com")
    assert client.get("/planner").status_code == 401
    data = planner()
    assert client.put("/planner", headers=headers(alice), json={"revision": 0, "data": data}).json() == {"revision": 1}
    assert client.get("/planner", headers=headers(bob)).json()["data"] is None
    data["settings"]["name"] = "stale"
    assert client.put("/planner", headers=headers(alice), json={"revision": 0, "data": data}).status_code == 409
    assert client.get("/planner", headers=headers(alice)).json()["data"]["settings"]["name"] == "Alice"
    client.post("/auth/logout", headers=headers(alice))
    again = client.post("/auth/login", json={"email": "ALICE@example.com", "password": PASSWORD}).json()
    assert client.get("/planner", headers=headers(again)).json()["revision"] == 1


def test_bad_credentials_duplicate_expired_and_password_change():
    session = register()
    assert client.post("/auth/register", json={"email": "ALICE@example.com", "password": PASSWORD}).status_code == 409
    assert client.post("/auth/login", json={"email": "alice@example.com", "password": "wrong-password"}).status_code == 401
    changed = client.post("/auth/password", headers=headers(session), json={"current_password": PASSWORD, "new_password": "another strong passphrase"})
    assert changed.status_code == 200
    assert client.get("/auth/me", headers=headers(session)).status_code == 401
    with SessionLocal() as db:
        db.scalar(select(LoginSession)).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get("/auth/me", headers=headers(changed.json())).status_code == 401


def test_validation_does_not_echo_password_or_replace_data():
    assert "secret" not in client.post("/auth/register", json={"email": "bad", "password": "secret"}).text
    session = register()
    bad = planner()
    bad["settings"]["wake"] = "40:00"
    assert client.put("/planner", headers=headers(session), json={"revision": 0, "data": bad}).status_code == 422
    assert client.get("/planner", headers=headers(session)).json()["revision"] == 0


def test_login_throttled():
    for _ in range(10):
        assert client.post("/auth/login", json={"email": "missing@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "missing@example.com", "password": PASSWORD}).status_code == 429


def test_six_character_password_and_no_previous_maximum():
    email = "password-length@example.com"
    assert client.post("/auth/register", json={"email": email, "password": "12345"}).status_code == 422
    response = client.post("/auth/register", json={"email": email, "password": "123456"})
    assert response.status_code == 201
    session = response.json()
    assert client.post("/auth/login", json={"email": email, "password": "123456"}).status_code == 200
    assert client.post("/auth/password", headers=headers(session), json={"current_password": "123456", "new_password": "short"}).status_code == 422
    long_password = "p" * 200
    response = client.post("/auth/password", headers=headers(session), json={"current_password": "123456", "new_password": long_password})
    assert response.status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": long_password}).status_code == 200
    assert client.post("/auth/password", headers=headers(response.json()), json={"current_password": long_password, "new_password": "abcdef"}).status_code == 200


def sample_entry(kind="task", id="entry-1"):
    entry = {"id": id, "kind": kind, "title": "Persistence test", "description": "Test notes",
             "category": "Study", "priority": "High", "estimatedMinutes": 30, "remainingMinutes": 20,
             "inProgress": False, "createdAt": "2026-10-05T00:00:00.000Z", "riskHistory": {}}
    if kind == "appointment":
        entry.update(start="2026-10-05T07:00:00.000Z", end="2026-10-05T08:00:00.000Z", plannedDate="2026-10-05")
    else:
        entry.update(deadline="2026-10-06T14:00:00.000Z", riskHistory={"Urgent": "2026-10-05T02:00:00.000Z"})
    return entry


def test_entities_survive_read_update_delete_and_account_switch():
    alice, bob = register(), register("bob@example.com")
    data = planner()
    data["entries"] = [sample_entry("appointment", "meeting"), sample_entry()]
    data["settings"].update(defaultPriority="High", taskReminders=False)
    data["reviewedDate"] = "2026-10-05"
    assert client.put("/planner", headers=headers(alice), json={"revision": 0, "data": data}).status_code == 200
    # Same task ID is valid for another account, without sharing or replacing rows.
    other = planner()
    other["entries"] = [sample_entry()]
    assert client.put("/planner", headers=headers(bob), json={"revision": 0, "data": other}).status_code == 200
    with SessionLocal() as db:
        assert db.get(Task, (alice["user"]["id"], "entry-1")).remaining_minutes == 20
        assert db.get(Appointment, (alice["user"]["id"], "meeting")).start == "2026-10-05T07:00:00.000Z"
        assert db.get(UserSettings, alice["user"]["id"]).default_priority == "High"
        assert db.get(NotificationPreferences, alice["user"]["id"]).task_reminders is False
    assert client.get("/planner", headers=headers(alice)).json()["data"] == data
    data["entries"][1].update(title="Updated", remainingMinutes=10, completedAt="2026-10-05T03:00:00.000Z")
    assert client.put("/planner", headers=headers(alice), json={"revision": 1, "data": data}).status_code == 200
    assert client.get("/planner", headers=headers(alice)).json()["data"] == data
    data["entries"] = []
    assert client.put("/planner", headers=headers(alice), json={"revision": 2, "data": data}).status_code == 200
    with SessionLocal() as db:
        assert db.get(Task, (alice["user"]["id"], "entry-1")) is None
        assert db.get(Appointment, (alice["user"]["id"], "meeting")) is None
        assert db.get(Task, (bob["user"]["id"], "entry-1")) is not None


def test_entity_failure_rolls_back_revision_and_snapshot(monkeypatch):
    session = register()
    data = planner()
    assert client.put("/planner", headers=headers(session), json={"revision": 0, "data": data}).status_code == 200
    def fail(*args):
        raise RuntimeError("simulated database failure")
    monkeypatch.setattr("app.main.write_entities", fail)
    with TestClient(app, raise_server_exceptions=False) as failing_client:
        assert failing_client.put("/planner", headers=headers(session), json={"revision": 1, "data": data}).status_code == 500
    with SessionLocal() as db:
        row = db.get(Planner, session["user"]["id"])
        assert row.revision == 1 and row.data == data


def test_browser_cookie_survives_reload_blocks_csrf_and_logs_out(monkeypatch):
    monkeypatch.setattr("app.main.COOKIE_SECURE", True)
    web = {"Origin": "http://localhost:8081", "X-Planly-Client": "web"}
    with TestClient(app, base_url="https://testserver") as browser:
        response = browser.post("/auth/register", headers=web, json={"email": "browser@example.com", "password": "123456"})
        assert response.status_code == 201
        assert response.json()["token"] == ""
        cookie = response.headers["set-cookie"]
        assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie and "Max-Age=604800" in cookie
        user_id = response.json()["user"]["id"]
        guarded = {**web, "X-Planly-Account": user_id}
        assert browser.get("/auth/session", headers=web).json()["user"]["id"] == user_id
        assert browser.put("/planner", headers=guarded, json={"revision": 0, "data": planner()}).status_code == 200
        assert browser.post("/auth/logout", headers={"Origin": "https://attacker.example", "X-Planly-Client": "web"}).status_code == 403
        assert browser.post("/auth/logout").status_code == 403
        assert browser.get("/auth/session", headers=web).status_code == 200
        assert browser.get("/planner", headers={**web, "X-Planly-Account": "other-account"}).status_code == 401
        # A stale tab cannot clear the valid cookie belonging to another account.
        assert browser.post("/auth/logout", headers={**web, "X-Planly-Account": "other-account"}).status_code == 401
        assert browser.get("/auth/session", headers=web).status_code == 200
        assert browser.post("/auth/password", headers=guarded, json={"current_password": "123456", "new_password": "abcdef"}).status_code == 200
        assert browser.get("/auth/session", headers=web).status_code == 200
        assert browser.post("/auth/logout", headers=guarded).status_code == 204
        assert browser.get("/auth/session", headers=web).status_code == 401


def test_browser_preflight_allows_credentials_and_account_guard():
    response = client.options("/planner", headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,x-planly-client,x-planly-account"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-credentials"] == "true"
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_browser_task_lifecycle_survives_reload_and_relogin(monkeypatch):
    monkeypatch.setattr("app.main.COOKIE_SECURE", True)
    web = {"Origin": "http://localhost:8081", "X-Planly-Client": "web"}
    with TestClient(app, base_url="https://testserver") as browser:
        response = browser.post("/auth/register", headers=web, json={"email": "lifecycle@example.com", "password": PASSWORD})
        assert response.status_code == 201
        guarded = {**web, "X-Planly-Account": response.json()["user"]["id"]}
        data = planner()
        task = sample_entry()
        data["entries"] = [task]
        revision = 0

        def save_and_reload():
            nonlocal revision
            saved = browser.put("/planner", headers=guarded, json={"revision": revision, "data": data})
            assert saved.status_code == 200, saved.text
            revision += 1
            assert saved.json()["revision"] == revision
            assert browser.get("/auth/session", headers=web).status_code == 200
            assert browser.get("/planner", headers=guarded).json() == {"revision": revision, "data": data}

        save_and_reload()
        task.update(title="Edited browser task", remainingMinutes=15)
        save_and_reload()
        deadline = task["deadline"]
        task.update(plannedDate="2026-10-06", start="2026-10-06T01:00:00.000Z", end="2026-10-06T01:30:00.000Z")
        save_and_reload()
        assert task["deadline"] == deadline
        # Match the Done action: preserve the estimate for reopening the task.
        task.update(completedAt="2026-10-06T01:15:00.000Z", inProgress=False)
        save_and_reload()
        assert browser.post("/auth/logout", headers=guarded).status_code == 204
        assert browser.get("/planner", headers=guarded).status_code == 401
        assert browser.post("/auth/login", headers=web, json={"email": "lifecycle@example.com", "password": PASSWORD}).status_code == 200
        assert browser.get("/planner", headers=guarded).json() == {"revision": revision, "data": data}
