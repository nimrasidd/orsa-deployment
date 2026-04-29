from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any


def _debug_log_path() -> Path:
    # Prefer explicit env override (useful in local/dev), else default for this session.
    return Path(os.getenv("CURSOR_DEBUG_LOG_PATH", "debug-3036ca.log"))


def _debug_session_id() -> str:
    return os.getenv("CURSOR_DEBUG_SESSION_ID", "3036ca")


def emit(location: str, message: str, *, data: dict[str, Any] | None = None, hypothesis_id: str, run_id: str) -> None:
    """
    Minimal NDJSON emitter for DEBUG MODE.
    Never raise (logging must not break app flow).
    """
    try:
        payload: dict[str, Any] = {
            "sessionId": _debug_session_id(),
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        path = _debug_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass

