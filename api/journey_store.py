from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from typing import Any, Optional


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _db_path() -> str:
    return os.getenv("GLOBALVISA_DB_PATH", "/tmp/globalvisa.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_journey_db() -> None:
    with _connect() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS journeys (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              locale TEXT NOT NULL,
              status TEXT NOT NULL,
              goal_json TEXT NOT NULL,
              plan_json TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS journey_steps (
              id TEXT PRIMARY KEY,
              journey_id TEXT NOT NULL,
              step_key TEXT NOT NULL,
              ordering INTEGER NOT NULL,
              status TEXT NOT NULL,
              title_json TEXT NOT NULL,
              description_json TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              UNIQUE(journey_id, step_key),
              FOREIGN KEY(journey_id) REFERENCES journeys(id)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS journey_events (
              id TEXT PRIMARY KEY,
              journey_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              actor TEXT NOT NULL,
              action_type TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              ai_json TEXT NOT NULL,
              FOREIGN KEY(journey_id) REFERENCES journeys(id)
            )
            """
        )


def create_journey(*, goal: dict[str, Any], locale: str, plan: dict[str, Any]) -> dict[str, Any]:
    jid = str(uuid.uuid4())
    now = _now_iso()
    with _connect() as c:
        c.execute(
            "INSERT INTO journeys(id,created_at,updated_at,locale,status,goal_json,plan_json) VALUES(?,?,?,?,?,?,?)",
            (jid, now, now, locale, "in_progress", json.dumps(goal, ensure_ascii=False), json.dumps(plan, ensure_ascii=False)),
        )
    return get_journey(jid) or {"id": jid}


def update_plan(*, journey_id: str, plan: dict[str, Any]) -> None:
    now = _now_iso()
    with _connect() as c:
        c.execute("UPDATE journeys SET updated_at=?, plan_json=? WHERE id=?", (now, json.dumps(plan, ensure_ascii=False), journey_id))


def upsert_steps(*, journey_id: str, steps: list[dict[str, Any]]) -> None:
    now = _now_iso()
    with _connect() as c:
        for i, s in enumerate(steps):
            step_key = str(s.get("key") or f"step_{i+1}")
            ordering = int(s.get("ordering", i + 1))
            status = str(s.get("status") or "not_started")
            title = s.get("title") if isinstance(s.get("title"), dict) else {"fr": str(s.get("title") or step_key), "en": str(s.get("title") or step_key)}
            desc = s.get("description") if isinstance(s.get("description"), dict) else {"fr": str(s.get("description") or ""), "en": str(s.get("description") or "")}
            payload = dict(s)
            c.execute("SELECT id FROM journey_steps WHERE journey_id=? AND step_key=?", (journey_id, step_key))
            existing = c.fetchone()
            if existing:
                c.execute(
                    "UPDATE journey_steps SET ordering=?, status=?, title_json=?, description_json=?, payload_json=? WHERE journey_id=? AND step_key=?",
                    (
                        ordering,
                        status,
                        json.dumps(title, ensure_ascii=False),
                        json.dumps(desc, ensure_ascii=False),
                        json.dumps(payload, ensure_ascii=False),
                        journey_id,
                        step_key,
                    ),
                )
            else:
                sid = str(uuid.uuid4())
                c.execute(
                    "INSERT INTO journey_steps(id,journey_id,step_key,ordering,status,title_json,description_json,payload_json) VALUES(?,?,?,?,?,?,?,?)",
                    (
                        sid,
                        journey_id,
                        step_key,
                        ordering,
                        status,
                        json.dumps(title, ensure_ascii=False),
                        json.dumps(desc, ensure_ascii=False),
                        json.dumps(payload, ensure_ascii=False),
                    ),
                )
        c.execute("UPDATE journeys SET updated_at=? WHERE id=?", (now, journey_id))


def list_journeys(limit: int = 50) -> list[dict[str, Any]]:
    with _connect() as c:
        rows = c.execute("SELECT * FROM journeys ORDER BY updated_at DESC LIMIT ?", (int(limit),)).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "locale": r["locale"],
                "status": r["status"],
                "goal": json.loads(r["goal_json"]) if r["goal_json"] else {},
                "plan": json.loads(r["plan_json"]) if r["plan_json"] else {},
            }
        )
    return out


def get_journey(journey_id: str) -> dict[str, Any] | None:
    with _connect() as c:
        r = c.execute("SELECT * FROM journeys WHERE id=?", (journey_id,)).fetchone()
    if not r:
        return None
    return {
        "id": r["id"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "locale": r["locale"],
        "status": r["status"],
        "goal": json.loads(r["goal_json"]) if r["goal_json"] else {},
        "plan": json.loads(r["plan_json"]) if r["plan_json"] else {},
    }


def list_steps(journey_id: str) -> list[dict[str, Any]]:
    with _connect() as c:
        rows = c.execute("SELECT * FROM journey_steps WHERE journey_id=? ORDER BY ordering ASC", (journey_id,)).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "journey_id": r["journey_id"],
                "step_key": r["step_key"],
                "ordering": r["ordering"],
                "status": r["status"],
                "title": json.loads(r["title_json"]) if r["title_json"] else {},
                "description": json.loads(r["description_json"]) if r["description_json"] else {},
                "payload": json.loads(r["payload_json"]) if r["payload_json"] else {},
            }
        )
    return out


def mark_step_done(journey_id: str, step_id: str) -> None:
    now = _now_iso()
    with _connect() as c:
        c.execute("UPDATE journey_steps SET status='done' WHERE journey_id=? AND id=?", (journey_id, step_id))
        c.execute("UPDATE journeys SET updated_at=? WHERE id=?", (now, journey_id))


def add_event(*, journey_id: str, actor: str, action_type: str, payload: dict[str, Any], ai: dict[str, Any]) -> str:
    eid = str(uuid.uuid4())
    with _connect() as c:
        c.execute(
            "INSERT INTO journey_events(id,journey_id,created_at,actor,action_type,payload_json,ai_json) VALUES(?,?,?,?,?,?,?)",
            (eid, journey_id, _now_iso(), actor, action_type, json.dumps(payload, ensure_ascii=False), json.dumps(ai, ensure_ascii=False)),
        )
    return eid


def list_events(journey_id: str, limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as c:
        rows = c.execute("SELECT * FROM journey_events WHERE journey_id=? ORDER BY created_at DESC LIMIT ?", (journey_id, int(limit))).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "journey_id": r["journey_id"],
                "created_at": r["created_at"],
                "actor": r["actor"],
                "action_type": r["action_type"],
                "payload": json.loads(r["payload_json"]) if r["payload_json"] else {},
                "ai": json.loads(r["ai_json"]) if r["ai_json"] else {},
            }
        )
    return out

