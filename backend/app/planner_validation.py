"""Validate the version-1 backup contract before accepting an account snapshot."""
import re
from datetime import date, datetime

from fastapi import HTTPException


def instant(value):
    if not isinstance(value, str) or not re.match(r"^\d{4}-\d{2}-\d{2}T", value):
        raise ValueError()
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError()
    return result


def amount(value):
    return type(value) is int and 0 < value <= 525600


def require(condition):
    if not condition:
        raise ValueError()


def validate(data):
    try:
        require(data.get("version") == 1 and type(data.get("onboarded")) is bool)
        settings = data["settings"]
        require(isinstance(settings, dict) and isinstance(settings["name"], str))
        for field in ("wake", "sleep", "review"):
            require(isinstance(settings[field], str) and re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", settings[field]))
        require(settings["wake"] != settings["sleep"] and amount(settings["defaultDuration"]))
        for field in ("notifications", "criticalDuringSleep", "startReminders", "riskReminders", "reviewReminder", "wakeSummary"):
            require(type(settings[field]) is bool)
        for field in ("taskReminders", "appointmentReminders", "urgentAlerts", "criticalAlerts", "quietHours"):
            require(field not in settings or type(settings[field]) is bool)
        priorities = ("High", "Medium", "Low")
        require("defaultPriority" not in settings or settings["defaultPriority"] in priorities)
        if "email" in settings:
            require(isinstance(settings["email"], str) and len(settings["email"]) <= 254)
            require(not settings["email"] or re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", settings["email"]))
        entries = data["entries"]
        require(isinstance(entries, list) and len(entries) <= 10000)
        seen, active = set(), 0
        for entry in entries:
            require(isinstance(entry, dict) and isinstance(entry["id"], str) and entry["id"] and entry["id"] not in seen)
            seen.add(entry["id"])
            require(entry["kind"] in ("task", "appointment"))
            require(isinstance(entry["title"], str) and entry["title"].strip())
            require(isinstance(entry["description"], str))
            require(entry["category"] in ("Work", "Study", "Personal", "Health", "Other"))
            require(entry["priority"] in priorities)
            require(amount(entry["estimatedMinutes"]) and amount(entry["remainingMinutes"]))
            require(type(entry["inProgress"]) is bool)
            instant(entry["createdAt"])
            for field in ("start", "end", "deadline", "completedAt", "acknowledgedEnd"):
                if field in entry:
                    instant(entry[field])
            if "plannedDate" in entry:
                require(date.fromisoformat(entry["plannedDate"]).isoformat() == entry["plannedDate"])
            require(bool(entry.get("start")) == bool(entry.get("end")))
            if entry.get("start"):
                require(instant(entry["start"]) < instant(entry["end"]))
            if entry["kind"] == "appointment":
                require(entry.get("start") and not entry.get("deadline") and not entry["inProgress"] and not entry.get("completedAt"))
            if entry["inProgress"]:
                active += 1
                require(not entry.get("completedAt") and active <= 1)
            require(isinstance(entry["riskHistory"], dict))
            for level, value in entry["riskHistory"].items():
                require(level in ("Urgent", "Critical"))
                instant(value)
        if "reviewedDate" in data:
            require(date.fromisoformat(data["reviewedDate"]).isoformat() == data["reviewedDate"])
    except (AssertionError, KeyError, TypeError, ValueError):
        raise HTTPException(422, "Invalid planner data. Nothing has been overwritten.") from None
