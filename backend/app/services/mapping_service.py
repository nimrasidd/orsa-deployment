from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

import sqlite3

from ..services.excel_import import _norm_code, _norm_header, derive_hierarchy
from ..services.excel_loader import get_cell_value, load_excel_sheets


MAPPING_REQUIRED_HEADERS = {"code", "description", "sheet", "cell reference"}

# Flexible header aliases: headers containing these substrings map to the canonical name
# Supports common variations like "Description (SCR)", "Cell Reference", etc.
_HEADER_ALIASES: dict[str, list[str]] = {
    "code": ["code"],
    "description": ["description", "desc"],
    "sheet": ["sheet"],
    "cell reference": ["cell reference", "cell ref", "cell_ref"],
}


def _match_header(raw: str) -> str | None:
    """Map a raw header to canonical name if it matches."""
    h = raw.strip().lower()
    for canonical, aliases in _HEADER_ALIASES.items():
        if h == canonical or any(alias in h for alias in aliases):
            return canonical
    return None


@dataclass(frozen=True)
class MappingItem:
    code: str
    description: str | None
    sheet_name: str
    cell_ref: str
    level: int
    parent_code: str | None


def _find_mapping_header_map_from_rows(rows: list[list[Any]]) -> tuple[dict[str, int], int] | None:
    """Find a row that contains the required mapping headers. Returns (mapping, header_row_0based) or None."""
    for r_idx, row in enumerate(rows[:50]):
        headers = [_norm_header(v) for v in row]
        mapping: dict[str, int] = {}
        for idx, h in enumerate(headers, start=1):
            canonical = _match_header(h)
            if canonical and canonical in MAPPING_REQUIRED_HEADERS:
                mapping[canonical] = idx
        if MAPPING_REQUIRED_HEADERS.issubset(mapping.keys()):
            return mapping, r_idx
    return None


def parse_mapping_excel(xlsx_bytes: bytes) -> list[MappingItem]:
    """
    Parses a mapping Excel workbook (xlsx or xls) that contains columns:
    Code, Description, Sheet, Cell Reference

    Returns list of mapping items (no values - those come from uploaded files).
    """
    sheets = load_excel_sheets(xlsx_bytes)
    parsed: list[MappingItem] = []

    for sheet_name, rows in sheets:
        found = _find_mapping_header_map_from_rows(rows)
        if not found:
            continue
        header_map, header_row_idx = found

        for r_idx in range(header_row_idx + 1, len(rows)):
            row = rows[r_idx]
            if header_map["code"] > len(row):
                continue
            raw_code = row[header_map["code"] - 1]
            code = _norm_code(raw_code)
            if not code:
                continue

            description = row[header_map["description"] - 1] if header_map["description"] <= len(row) else None
            description_s = None if description is None else str(description).strip()

            sheet_val = row[header_map["sheet"] - 1] if header_map["sheet"] <= len(row) else None
            sheet_name_val = str(sheet_val).strip() if sheet_val else sheet_name

            cell_val = row[header_map["cell reference"] - 1] if header_map["cell reference"] <= len(row) else None
            cell_ref = str(cell_val).strip() if cell_val else ""

            if not sheet_name_val or not cell_ref:
                continue

            level, parent_code = derive_hierarchy(code)

            parsed.append(
                MappingItem(
                    code=code,
                    description=description_s,
                    sheet_name=sheet_name_val,
                    cell_ref=cell_ref,
                    level=level,
                    parent_code=parent_code,
                )
            )

    if not parsed:
        raise ValueError(
            "Could not find required columns (Code, Description, Sheet, Cell Reference) in the mapping workbook."
        )

    return parsed


def _normalize_sheet_key(name: str) -> str:
    """Normalize sheet name for lookup: strip, lower, collapse spaces."""
    s = str(name).strip().lower()
    s = re.sub(r"\s+", " ", s)  # collapse multiple spaces
    return s


def extract_values_from_file(xlsx_bytes: bytes, mapping_items: list[MappingItem]) -> dict[str, Decimal | None]:
    """
    Extract values from an uploaded Excel file (xlsx or xls) based on mapping items.

    Returns: dict mapping code -> extracted value (or None if not found/invalid)
    """
    logger = logging.getLogger(__name__)

    sheets = load_excel_sheets(xlsx_bytes)
    results: dict[str, Decimal | None] = {}

    # Build sheet lookup with multiple keys for flexible matching
    sheet_map: dict[str, list[list[Any]]] = {}
    for name, rows in sheets:
        key = _normalize_sheet_key(name)
        sheet_map[key] = rows
        base_name = name.split("(")[0].strip().lower()
        if base_name:
            sheet_map[_normalize_sheet_key(base_name)] = rows
        # Also store without spaces for "Sheet1" vs "Sheet 1"
        sheet_map[key.replace(" ", "")] = rows

    for item in mapping_items:
        lookup_key = _normalize_sheet_key(item.sheet_name)
        rows = sheet_map.get(lookup_key)
        if not rows:
            base = item.sheet_name.split("(")[0].strip().lower()
            rows = sheet_map.get(_normalize_sheet_key(base))
        if not rows:
            rows = sheet_map.get(lookup_key.replace(" ", ""))

        if not rows:
            logger.debug("Sheet not found for code %s: mapping sheet=%r, available=%s",
                        item.code, item.sheet_name, list(sheet_map.keys()))
            results[item.code] = None
            continue

        try:
            cell_ref = str(item.cell_ref).strip()
            raw_value = get_cell_value(rows, cell_ref)

            if raw_value is None or raw_value == "":
                logger.debug("Null/empty value for code %s at %s!%s (sheet has %d rows)",
                             item.code, item.sheet_name, cell_ref, len(rows))
                results[item.code] = None
                continue

            # Convert to Decimal
            if isinstance(raw_value, Decimal):
                results[item.code] = raw_value
            elif isinstance(raw_value, (int, float)):
                results[item.code] = Decimal(str(raw_value))
            else:
                try:
                    cleaned = str(raw_value).replace(",", "").strip()
                    results[item.code] = Decimal(cleaned) if cleaned else None
                except (InvalidOperation, ValueError):
                    results[item.code] = None
        except Exception as e:
            logger.debug("Error extracting %s at %s!%s: %s", item.code, item.sheet_name, item.cell_ref, e)
            results[item.code] = None

    return results


def save_mapping_to_db(
    conn: Any,
    name: str,
    mapping_items: list[MappingItem],
    model_id: str | None = None,
    uploaded_by: str | None = None,
    notes: str | None = None,
) -> str:
    """
    Save a mapping configuration to the database. Single table: each row = one Code → Sheet, Cell.

    Version is assigned per model: the next integer after the highest version already stored for that
    model (any mapping name), so the first config is v1, the second v2, etc.

    Returns: config_id (used as mapping id)
    """
    config_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if isinstance(conn, sqlite3.Connection):
        if model_id:
            cur = conn.execute(
                "select coalesce(max(version), 0) + 1 as next_version from mapping where model_id = :mid",
                {"mid": model_id},
            )
        else:
            cur = conn.execute(
                "select coalesce(max(version), 0) + 1 as next_version from mapping where model_id is null",
            )
        row = cur.fetchone()
        version = int(row["next_version"] if row else 1)

        if model_id:
            conn.execute("update mapping set is_active = 0 where model_id = :mid", {"mid": model_id})
        else:
            conn.execute("update mapping set is_active = 0 where model_id is null")

        for item in mapping_items:
            conn.execute(
                """
                insert into mapping (id, config_id, model_id, name, version, is_active, uploaded_at, notes, code, description, sheet_name, cell_ref, level, parent_code)
                values (:id, :config_id, :model_id, :name, :version, 1, :uploaded_at, :notes, :code, :description, :sheet_name, :cell_ref, :level, :parent_code)
                """,
                {
                    "id": str(uuid4()),
                    "config_id": config_id,
                    "model_id": model_id,
                    "name": name,
                    "version": version,
                    "uploaded_at": now,
                    "notes": notes,
                    "code": item.code,
                    "description": item.description,
                    "sheet_name": item.sheet_name,
                    "cell_ref": item.cell_ref,
                    "level": item.level,
                    "parent_code": item.parent_code,
                },
            )
        conn.commit()
        return config_id

    with conn.transaction():
        with conn.cursor() as cur:
            if model_id:
                cur.execute(
                    "select coalesce(max(version), 0) + 1 as next_version from public.mapping where model_id = %(mid)s::uuid",
                    {"mid": model_id},
                )
            else:
                cur.execute(
                    "select coalesce(max(version), 0) + 1 as next_version from public.mapping where model_id is null",
                )
            version = int(cur.fetchone()["next_version"])

            if model_id:
                cur.execute(
                    "update public.mapping set is_active = false where model_id = %(mid)s::uuid",
                    {"mid": model_id},
                )
            else:
                cur.execute("update public.mapping set is_active = false where model_id is null")

            for item in mapping_items:
                cur.execute(
                    """
                    insert into public.mapping (id, config_id, model_id, name, version, is_active, uploaded_at, notes, code, description, sheet_name, cell_ref, level, parent_code)
                    values (%(id)s, %(config_id)s, %(model_id)s, %(name)s, %(version)s, true, %(uploaded_at)s, %(notes)s, %(code)s, %(description)s, %(sheet_name)s, %(cell_ref)s, %(level)s, %(parent_code)s)
                    """,
                    {
                        "id": str(uuid4()),
                        "config_id": config_id,
                        "model_id": model_id,
                        "name": name,
                        "version": version,
                        "uploaded_at": now,
                        "notes": notes,
                        "code": item.code,
                        "description": item.description,
                        "sheet_name": item.sheet_name,
                        "cell_ref": item.cell_ref,
                        "level": item.level,
                        "parent_code": item.parent_code,
                    },
                )
    return config_id


def get_mapping_config_model_id(conn: Any, config_id: str) -> str | None:
    """Return the model_id for a mapping config, or None if config does not exist."""
    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select model_id from mapping where config_id = ? limit 1",
            (config_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(zip(row.keys(), row))  # type: ignore[arg-type]
        mid = d.get("model_id")
        return str(mid) if mid is not None else None
    with conn.cursor() as cur:
        cur.execute(
            "select model_id from public.mapping where config_id = %(id)s limit 1",
            {"id": config_id},
        )
        row = cur.fetchone()
        if not row:
            return None
        mid = row["model_id"]
        return str(mid) if mid is not None else None


def fetch_mapping_items_by_config_id(conn: Any, config_id: str) -> list[dict]:
    """All line items for one mapping configuration (config_id)."""
    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
            from mapping
            where config_id = ?
            order by level, code
            """,
            (config_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    with conn.cursor() as cur:
        cur.execute(
            """
            select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
            from public.mapping
            where config_id = %(cid)s
            order by level, code
            """,
            {"cid": config_id},
        )
        return list(cur.fetchall())


def get_active_mapping_items(conn: Any, model_id: str | None = None) -> list[dict]:
    """Get all items from the active mapping for a model (at most one active config per model)."""
    if isinstance(conn, sqlite3.Connection):
        if model_id:
            cur = conn.execute(
                """
                select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
                from mapping
                where config_id = (
                    select config_id from mapping
                    where is_active = 1 and model_id = ?
                    group by config_id
                    order by max(uploaded_at) desc
                    limit 1
                )
                order by level, code
                """,
                (model_id,),
            )
        else:
            cur = conn.execute(
                """
                select config_id from mapping where is_active = 1 limit 1
                """
            )
            row = cur.fetchone()
            if not row:
                return []
            config_id = row["config_id"]
            cur = conn.execute(
                """
                select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
                from mapping
                where config_id = ?
                order by level, code
                """,
                (config_id,),
            )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        if model_id:
            cur.execute(
                """
                select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
                from public.mapping
                where config_id = (
                    select config_id from public.mapping
                    where is_active = true and model_id = %(model_id)s::uuid
                    group by config_id
                    order by max(uploaded_at) desc
                    limit 1
                )
                order by level, code
                """,
                {"model_id": model_id},
            )
        else:
            cur.execute(
                """
                select config_id from public.mapping where is_active = true limit 1
                """
            )
            row = cur.fetchone()
            if not row:
                return []
            config_id = row["config_id"]
            cur.execute(
                """
                select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
                from public.mapping
                where config_id = %(config_id)s
                order by level, code
                """,
                {"config_id": config_id},
            )
        return list(cur.fetchall())
