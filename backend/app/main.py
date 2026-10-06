"""Account-scoped planner API. No credentials or planner bodies are logged."""
import hashlib
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import database
from .models import LoginSession, Planner, User
from .planner_validation import validate
from .planner_repository import read_entities, write_entities

app = FastAPI(title="Planly API", version="1.0.0")
ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8081").split(",")
COOKIE = "planly_session"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() != "false"
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT"], allow_headers=["Authorization", "Content-Type", "X-Planly-Client", "X-Planly-Account"])
passwords = PasswordHash.recommended()
dummy_hash = passwords.hash(secrets.token_urlsafe(24))
bearer = HTTPBearer(auto_error=False)
# Local development limit; a shared edge limiter is required for multi-worker deployment.
attempts: dict[str, deque] = defaultdict(deque)
attempt_lock = Lock()


@app.exception_handler(RequestValidationError)
async def invalid_request(_request, _error):
    # Pydantic's default response can echo rejected password values.
    return JSONResponse(status_code=422, content={"detail": "Invalid input. Check your email, password (at least 6 characters), or planner data."})


@app.middleware("http")
async def body_limit(request: Request, call_next):
    web = request.headers.get("X-Planly-Client") == "web"
    cookie_write = request.cookies.get(COOKIE) and not request.headers.get("Authorization") and request.method in {"POST", "PUT", "DELETE", "PATCH"}
    if request.method != "OPTIONS" and (web or cookie_write):
        origin = request.headers.get("Origin")
        unsafe = request.method in {"POST", "PUT", "DELETE", "PATCH"}
        if (origin and origin not in ORIGINS) or (unsafe and (not web or origin not in ORIGINS)):
            return JSONResponse(status_code=403, content={"detail": "This browser origin is not allowed."})
    if request.method in {"POST", "PUT"}:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 5 * 1024 * 1024:
                return JSONResponse(status_code=413, content={"detail": "Planner exceeds the 5 MB limit."})
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def rate_limit(request: Request):
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with attempt_lock:
        # Expire inactive hosts so the map cannot grow forever.
        for host in list(attempts):
            while attempts[host] and attempts[host][0] < now - 60:
                attempts[host].popleft()
            if not attempts[host]:
                del attempts[host]
        if len(attempts[key]) >= 10:
            raise HTTPException(429, "Too many attempts. Try again in a minute.", headers={"Retry-After": "60"})
        attempts[key].append(now)


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class PlannerWrite(BaseModel):
    revision: int = Field(ge=0, strict=True)
    data: dict


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def identity(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(database)):
    token = credentials.credentials if credentials else request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please sign in.")
    login = db.get(LoginSession, digest(token))
    if not login or login.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    user = db.get(User, login.user_id)
    if not user:
        raise HTTPException(401, "Please sign in.")
    if not credentials and request.headers.get("X-Planly-Account") not in (None, user.id):
        raise HTTPException(401, "Your browser account changed. Please reload Planly.")
    return user, login


def start_session(db: Session, user: User, request: Request, response: Response):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    db.execute(delete(LoginSession).where(LoginSession.expires_at <= datetime.now(timezone.utc)))
    db.add(LoginSession(token_hash=digest(token), user_id=user.id, expires_at=expires))
    db.commit()
    web = request.headers.get("X-Planly-Client") == "web"
    if web:
        response.set_cookie(COOKIE, token, max_age=7 * 24 * 3600, expires=expires, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")
    return {"token": "" if web else token, "expiresAt": expires.isoformat(), "user": {"id": user.id, "email": user.email}}


@app.get("/health")
def health(db: Session = Depends(database)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.post("/auth/register", status_code=201, dependencies=[Depends(rate_limit)])
def register(body: Credentials, request: Request, response: Response, db: Session = Depends(database)):
    user = User(id=str(uuid4()), email=str(body.email).strip().lower(), password_hash=passwords.hash(body.password))
    db.add(user)
    try:
        db.flush()
        db.add(Planner(user_id=user.id, revision=0, data=None))
        return start_session(db, user, request, response)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.") from None


@app.post("/auth/login", dependencies=[Depends(rate_limit)])
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(database)):
    user = db.scalar(select(User).where(User.email == str(body.email).strip().lower()))
    valid = passwords.verify(body.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect.")
    return start_session(db, user, request, response)


@app.get("/auth/me")
def me(auth=Depends(identity)):
    return {"id": auth[0].id, "email": auth[0].email}


@app.post("/auth/logout", status_code=204)
def logout(response: Response, auth=Depends(identity), db: Session = Depends(database)):
    db.delete(auth[1])
    db.commit()
    response.delete_cookie(COOKIE, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")


@app.get("/auth/session")
def browser_session(auth=Depends(identity)):
    user, login = auth
    return {"token": "", "expiresAt": login.expires_at.replace(tzinfo=timezone.utc).isoformat(), "user": {"id": user.id, "email": user.email}}


@app.post("/auth/password", dependencies=[Depends(rate_limit)])
def change_password(body: PasswordChange, request: Request, response: Response, auth=Depends(identity), db: Session = Depends(database)):
    user, _ = auth
    if not passwords.verify(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = passwords.hash(body.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    return start_session(db, user, request, response)


@app.get("/planner")
def get_planner(auth=Depends(identity), db: Session = Depends(database)):
    # Hold the parent row lock so revision and child rows represent the same commit.
    row = db.scalar(select(Planner).where(Planner.user_id == auth[0].id).with_for_update())
    return {"revision": row.revision, "data": read_entities(db, auth[0].id, row.data)}


@app.put("/planner")
def save_planner(body: PlannerWrite, auth=Depends(identity), db: Session = Depends(database)):
    validate(body.data)
    result = db.execute(update(Planner).where(Planner.user_id == auth[0].id, Planner.revision == body.revision)
                        .values(data=body.data, revision=body.revision + 1))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Another device changed this planner. Choose which copy to keep in Settings.")
    write_entities(db, auth[0].id, body.data)
    db.commit()
    return {"revision": body.revision + 1}
