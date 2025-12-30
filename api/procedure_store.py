from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from dataclasses import dataclass
from typing import Any, Iterable, Optional


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _db_path() -> str:
    # Par défaut: /tmp (évite de créer des artefacts dans le repo).
    # En prod Render: définir GLOBALVISA_DB_PATH vers un disque monté (persistant) ou passer à Postgres.
    return os.getenv("GLOBALVISA_DB_PATH", "/tmp/globalvisa.db")


def _connect() -> sqlite3.Connection:
    path = _db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS procedures (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              type TEXT NOT NULL,
              intent TEXT NOT NULL,
              country TEXT NOT NULL,
              region TEXT,
              target TEXT,
              locale TEXT NOT NULL,
              form_id TEXT NOT NULL,
              status TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS procedure_steps (
              id TEXT PRIMARY KEY,
              procedure_id TEXT NOT NULL,
              step_key TEXT NOT NULL,
              title_json TEXT NOT NULL,
              ordering INTEGER NOT NULL,
              status TEXT NOT NULL,
              official_url TEXT,
              FOREIGN KEY(procedure_id) REFERENCES procedures(id)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS drafts (
              procedure_id TEXT NOT NULL,
              step_id TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              data_json TEXT NOT NULL,
              PRIMARY KEY (procedure_id, step_id),
              FOREIGN KEY(procedure_id) REFERENCES procedures(id),
              FOREIGN KEY(step_id) REFERENCES procedure_steps(id)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_events (
              id TEXT PRIMARY KEY,
              procedure_id TEXT,
              created_at TEXT NOT NULL,
              actor TEXT NOT NULL,
              action TEXT NOT NULL,
              payload_json TEXT NOT NULL
            )
            """
        )


def add_audit(*, procedure_id: str | None, actor: str, action: str, payload: dict[str, Any]) -> str:
    eid = str(uuid.uuid4())
    with _connect() as c:
        c.execute(
            "INSERT INTO audit_events(id, procedure_id, created_at, actor, action, payload_json) VALUES(?,?,?,?,?,?)",
            (eid, procedure_id, _now_iso(), actor, action, json.dumps(payload, ensure_ascii=False)),
        )
    return eid


def list_audit(*, procedure_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as c:
        if procedure_id:
            rows = c.execute(
                "SELECT * FROM audit_events WHERE procedure_id=? ORDER BY created_at DESC LIMIT ?",
                (procedure_id, int(limit)),
            ).fetchall()
        else:
            rows = c.execute("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?", (int(limit),)).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "procedure_id": r["procedure_id"],
                "created_at": r["created_at"],
                "actor": r["actor"],
                "action": r["action"],
                "payload": json.loads(r["payload_json"]) if r["payload_json"] else {},
            }
        )
    return out


def create_procedure(
    *,
    proc_type: str,
    intent: str,
    country: str,
    region: str | None,
    target: str | None,
    locale: str,
    form_id: str,
    steps: list[dict[str, Any]],
) -> dict[str, Any]:
    pid = str(uuid.uuid4())
    now = _now_iso()
    with _connect() as c:
        c.execute(
            "INSERT INTO procedures(id,created_at,updated_at,type,intent,country,region,target,locale,form_id,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (pid, now, now, proc_type, intent, country, region, target, locale, form_id, "in_progress"),
        )
        for idx, s in enumerate(steps):
            sid = str(uuid.uuid4())
            c.execute(
                "INSERT INTO procedure_steps(id,procedure_id,step_key,title_json,ordering,status,official_url) VALUES(?,?,?,?,?,?,?)",
                (
                    sid,
                    pid,
                    str(s.get("key") or f"step_{idx+1}"),
                    json.dumps(s.get("title") or {"fr": f"Étape {idx+1}", "en": f"Step {idx+1}"}, ensure_ascii=False),
                    int(s.get("ordering", idx + 1)),
                    "not_started" if idx > 0 else "in_progress",
                    s.get("official_url"),
                ),
            )
    add_audit(procedure_id=pid, actor="system", action="procedure.created", payload={"form_id": form_id})
    return get_procedure(pid) or {"id": pid}


def list_procedures(limit: int = 50) -> list[dict[str, Any]]:
    with _connect() as c:
        rows = c.execute("SELECT * FROM procedures ORDER BY updated_at DESC LIMIT ?", (int(limit),)).fetchall()
    return [dict(r) for r in rows]


def get_procedure(pid: str) -> dict[str, Any] | None:
    with _connect() as c:
        row = c.execute("SELECT * FROM procedures WHERE id=?", (pid,)).fetchone()
    return dict(row) if row else None


def list_steps(pid: str) -> list[dict[str, Any]]:
    with _connect() as c:
        rows = c.execute(
            "SELECT * FROM procedure_steps WHERE procedure_id=? ORDER BY ordering ASC",
            (pid,),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "procedure_id": r["procedure_id"],
                "step_key": r["step_key"],
                "title": json.loads(r["title_json"]) if r["title_json"] else {},
                "ordering": r["ordering"],
                "status": r["status"],
                "official_url": r["official_url"],
            }
        )
    return out


def get_step(pid: str, step_id: str) -> dict[str, Any] | None:
    with _connect() as c:
        r = c.execute(
            "SELECT * FROM procedure_steps WHERE procedure_id=? AND id=?",
            (pid, step_id),
        ).fetchone()
    if not r:
        return None
    return {
        "id": r["id"],
        "procedure_id": r["procedure_id"],
        "step_key": r["step_key"],
        "title": json.loads(r["title_json"]) if r["title_json"] else {},
        "ordering": r["ordering"],
        "status": r["status"],
        "official_url": r["official_url"],
    }


def save_draft(pid: str, step_id: str, data: dict[str, Any]) -> None:
    now = _now_iso()
    with _connect() as c:
        c.execute(
            "INSERT INTO drafts(procedure_id,step_id,updated_at,data_json) VALUES(?,?,?,?) "
            "ON CONFLICT(procedure_id,step_id) DO UPDATE SET updated_at=excluded.updated_at, data_json=excluded.data_json",
            (pid, step_id, now, json.dumps(data, ensure_ascii=False)),
        )
        c.execute("UPDATE procedures SET updated_at=? WHERE id=?", (now, pid))
    add_audit(procedure_id=pid, actor="user", action="draft.saved", payload={"step_id": step_id})


def load_draft(pid: str, step_id: str) -> dict[str, Any] | None:
    with _connect() as c:
        r = c.execute(
            "SELECT * FROM drafts WHERE procedure_id=? AND step_id=?",
            (pid, step_id),
        ).fetchone()
    if not r:
        return None
    return {"procedure_id": pid, "step_id": step_id, "updated_at": r["updated_at"], "data": json.loads(r["data_json"]) if r["data_json"] else {}}


def update_step_status(pid: str, step_id: str, status: str) -> None:
    now = _now_iso()
    with _connect() as c:
        c.execute("UPDATE procedure_steps SET status=? WHERE procedure_id=? AND id=?", (status, pid, step_id))
        c.execute("UPDATE procedures SET updated_at=? WHERE id=?", (now, pid))
    add_audit(procedure_id=pid, actor="system", action="step.status", payload={"step_id": step_id, "status": status})


def mark_completed_and_advance(pid: str, step_id: str) -> None:
    # MVP: avance séquentiellement; les recommandations IA arrivent via /ai/forms/next-steps.
    steps = list_steps(pid)
    update_step_status(pid, step_id, "done")
    # si une étape suivante est not_started, la passer en in_progress
    found = False
    for s in steps:
        if s["id"] == step_id:
            found = True
            continue
        if found and s["status"] == "not_started":
            update_step_status(pid, s["id"], "in_progress")
            break

