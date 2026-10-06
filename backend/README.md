# Planly backend

FastAPI + SQLAlchemy 2 + PostgreSQL 17. Exact Python dependencies are pinned in `requirements.txt`; Python 3.12 is used in Docker. Alembic migrations `001` and `002` install the account and planner entity tables.

## Local development

From the repository root, copy `.env.example` to `.env` **only if `.env` does not already exist**. Set a random alphanumeric `POSTGRES_PASSWORD`. The implementation session generated an ignored local `.env`; do not commit it.

```powershell
docker desktop start
docker compose up -d --build
Invoke-RestMethod http://localhost:8000/health
npx expo start --clear
```

Interactive API documentation: http://localhost:8000/docs. The database binds only to localhost:5432; the development API binds to port 8000 for access from a phone on the same trusted LAN. `docker compose stop` stops the services while retaining the named database volume. Do not remove the volume if you want to retain account data.

Set `EXPO_PUBLIC_API_URL` in the root `.env` for the target before restarting Metro:

| Target | URL |
| --- | --- |
| Browser preview | `http://localhost:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| Physical Android | `http://YOUR_PC_LAN_IP:8000` on the same network |
| Production | Your deployed `https://` API URL |

Expo public variables are bundled into the app. Never put a database password or session credential in an `EXPO_PUBLIC_` variable. Non-development app builds reject HTTP endpoints. Use a development client for local HTTP testing; production needs HTTPS. A tunnel or deployed HTTPS endpoint is needed when the device cannot reach the PC. Do not expose this development compose stack directly to the public internet.

## API and persistence

- `POST /auth/register`, `POST /auth/login`: email/password JSON; issue a seven-day opaque bearer token.
- `GET /auth/me`: current account, derived exclusively from the session.
- `POST /auth/logout`: revoke this session; does not delete a planner.
- `POST /auth/password`: current/new password; revoke all sessions and issue a replacement for this device.
- `GET /planner`: account's snapshot and revision.
- `PUT /planner`: `{ "revision": 0, "data": <version-1 planner> }`; atomically checks revision, increments on success, returns 409 for stale writes.

| Table | Purpose |
| --- | --- |
| `users` | Sign-in email and password hash |
| `login_sessions` | Revocable, expiring account sessions |
| `planners` | Per-account revision and compatibility/recovery snapshot, including onboarding and review state |
| `tasks` | Flexible tasks, title/notes/category/priority, duration estimates, deadlines, planned blocks, completion, unfinished acknowledgment and risk history |
| `appointments` | Fixed appointments and their planned times |
| `user_settings` | Profile name, daily schedule and planning defaults |
| `notification_preferences` | Individual reminder, alert and quiet-hour preferences |

Task and appointment IDs are unique within each account. All entity rows reference their owning user. The API reads entities from the dedicated tables and writes them in the same transaction as the revision and recovery snapshot. Failed writes roll back the whole transaction. ISO timestamp strings retain their original timezone and precision, with validity checked before writes. Risk history remains a JSONB field on its entry. Device notification identifiers stay on the device.

Migration `002` backfills every existing snapshot into these tables without deleting the snapshots or changing revisions. A pre-migration local dump is in the ignored `.local-backups/` directory. To roll back the schema, migration `002` can drop the derived tables while retaining the up-to-date snapshots; the API must also be rolled back to the snapshot implementation.

Maximum request size is 5 MiB, and planners accept at most 10,000 entries. Client backups retain their existing 5 MB validation limit. The `/planner` API shape remains compatible with existing clients.

Native credentials use SecureStore, while planner caches use per-user AsyncStorage keys. The previous local-only planner stays intact until the user explicitly imports it into an account. A failed sync never clears dirty local changes. Conflicting snapshots require a user choice; there is no automatic merge. Notifications are device-local, not server push notifications.

## Tests

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
Set-Location backend
.venv/Scripts/python -m pytest -q
```

The default tests use an isolated temporary SQLite database. To exercise PostgreSQL, set `PLANLY_TEST_DATABASE_URL` to a dedicated database whose name is **planly_test**. The suite creates/drops its tables; never point it at user data. The development schema is installed by `alembic upgrade head` when the API container starts. Deploy migrations once as a separate release job when using multiple replicas.

## Before public release

This is a working development backend, not a deployed production service. Remaining release work: choose HTTPS hosting, configure database backups and recovery, add email verification and password recovery, publish privacy/terms, and add centralized monitoring. The current authentication limiter is per-process (10 attempts per minute per client IP); use a shared limiter and configured proxy trust before adding workers or exposing a public endpoint. Browser sessions now persist across reloads using HttpOnly cookies; browser notifications remain unsupported. Native device authentication, keyboard, and notification behavior still require APK testing.


## Browser sign-in

Browser login/registration sets an HttpOnly, SameSite=Lax, seven-day cookie. `/auth/session` restores the account after refresh; no session secret is returned to browser JavaScript or stored in localStorage. Native clients continue to use bearer tokens in SecureStore. Cookie-authenticated writes require the Planly client header and an exact allowed Origin. Account-specific requests carry a public identity guard so a stale browser tab cannot read or overwrite a different account after another tab switches users.

For local browser testing, open `http://localhost:8081` with API URL `http://localhost:8000`. Use the same hostname on both sides (do not mix localhost and 127.0.0.1). Compose disables the cookie Secure flag only for local HTTP. Production defaults to Secure cookies and requires HTTPS, explicitly configured CORS origins, and same-site frontend/API hosts. Refresh requires server connectivity to validate the cookie; an already open planner still saves locally when offline. After upgrading from the memory-only session, sign in once to establish the cookie.
