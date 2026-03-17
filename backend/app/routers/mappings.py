from __future__ import annotations

import zipfile
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from xlrd.biffh import XLRDError

from ..db import get_db
from ..schemas import MappingItemOut, MappingOut
from ..services.mapping_service import (
    extract_values_from_file,
    get_active_mapping_items,
    parse_mapping_excel,
    save_mapping_to_db,
)

router = APIRouter(prefix="/mappings", tags=["mappings"])


@router.get("", response_model=list[MappingOut])
def list_mappings(
    db: Annotated[Any, Depends(get_db)],
    model_id: Annotated[str | None, Query()] = None,
):
    """List mapping configurations, optionally filtered by model_id (references models table)."""
    import sqlite3
    from datetime import datetime

    if isinstance(db, sqlite3.Connection):
        if model_id:
            cur = db.execute(
                """
                select config_id as id, model_id, name, version, is_active, uploaded_at, notes,
                       count(*) as item_count
                from mapping
                where model_id = ?
                group by config_id, model_id, name, version, is_active, uploaded_at, notes
                order by uploaded_at desc
                """,
                (model_id,),
            )
        else:
            cur = db.execute(
                """
                select config_id as id, model_id, name, version, is_active, uploaded_at, notes,
                       count(*) as item_count
                from mapping
                group by config_id, model_id, name, version, is_active, uploaded_at, notes
                order by uploaded_at desc
                """
            )
        rows = cur.fetchall()
        out = []
        for r in rows:
            r = dict(zip(r.keys(), r))  # sqlite3.Row has no .get()
            model_name = None
            if r.get("model_id"):
                mcur = db.execute(
                    "select name from models where id = ?",
                    (r["model_id"],),
                )
                mrow = mcur.fetchone()
                model_name = mrow["name"] if mrow else None
            out.append({
                "id": r["id"],
                "model_id": r.get("company_model_id") or r.get("model_id"),
                "model_name": model_name,
                "name": r["name"],
                "version": r["version"],
                "is_active": bool(r["is_active"]),
                "uploaded_at": datetime.fromisoformat(r["uploaded_at"]),
                "uploaded_by": None,
                "notes": r["notes"],
                "item_count": r["item_count"],
            })
        return out

    with db.cursor() as cur:
        if model_id:
            cur.execute(
                """
                select config_id as id, model_id, name, version, is_active, uploaded_at, notes,
                       count(*) as item_count
                from public.mapping
                where model_id = %(model_id)s
                group by config_id, model_id, name, version, is_active, uploaded_at, notes
                order by uploaded_at desc
                """,
                {"model_id": model_id},
            )
        else:
            cur.execute(
                """
                select config_id as id, model_id, name, version, is_active, uploaded_at, notes,
                       count(*) as item_count
                from public.mapping
                group by config_id, model_id, name, version, is_active, uploaded_at, notes
                order by uploaded_at desc
                """
            )
        rows = list(cur.fetchall())
        for r in rows:
            r["uploaded_by"] = None
            r["model_name"] = None
        if rows and any(r.get("model_id") for r in rows):
            cur.execute("select id, name from public.models")
            model_labels = {str(r["id"]): r["name"] for r in cur.fetchall()}
            for r in rows:
                if r.get("model_id"):
                    r["model_name"] = model_labels.get(str(r["model_id"]))
        return rows


@router.post("", response_model=MappingOut)
async def create_mapping(
    db: Annotated[Any, Depends(get_db)],
    file: Annotated[UploadFile, File()],
    name: Annotated[str, Form()],
    model_id: Annotated[str | None, Form()] = None,
    notes: Annotated[str | None, Form()] = None,
    uploaded_by: Annotated[str | None, Form()] = None,
):
    """Upload a new mapping Excel file for a model (model-based mapping)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    if not model_id:
        raise HTTPException(status_code=400, detail="Select a model first (Models tab).")

    data = await file.read()
    try:
        mapping_items = parse_mapping_excel(data)
    except (zipfile.BadZipFile, XLRDError):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. .xlsx and .xls (Excel 97-2003) are supported.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not mapping_items:
        raise HTTPException(status_code=400, detail="No mapping items found in file")

    try:
        mapping_id = save_mapping_to_db(
            db,
            name=name,
            mapping_items=mapping_items,
            model_id=model_id or None,
            uploaded_by=uploaded_by,
            notes=notes,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to save mapping") from e

    # Return the created mapping
    mappings = list_mappings(db, model_id=model_id)
    for m in mappings:
        if str(m["id"]) == mapping_id:
            return m

    raise HTTPException(status_code=500, detail="Mapping created but not found")


@router.get("/active/items", response_model=list[MappingItemOut])
def get_active_mapping_items_endpoint(
    db: Annotated[Any, Depends(get_db)],
    model_id: Annotated[str | None, Query()] = None,
):
    """Get items from the active mapping for a model (or first active if none specified)."""
    from datetime import datetime

    items = get_active_mapping_items(db, model_id=model_id)
    out = []
    for r in items:
        row = dict(r)
        ct = row.get("created_at")
        if isinstance(ct, str):
            row["created_at"] = datetime.fromisoformat(ct.replace("Z", "+00:00"))
        elif ct is None:
            row["created_at"] = datetime.now()
        out.append(row)
    return out


@router.get("/{mapping_id}/items", response_model=list[MappingItemOut])
def get_mapping_items(mapping_id: str, db: Annotated[Any, Depends(get_db)]):
    """Get all items for a specific mapping (mapping_id = config_id)."""
    import sqlite3
    from datetime import datetime

    cfg = mapping_id
    if isinstance(db, sqlite3.Connection):
        cur = db.execute(
            """
            select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
            from mapping
            where config_id = :config_id
            order by level, code
            """,
            {"config_id": cfg},
        )
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "mapping_id": r["mapping_id"],
                "code": r["code"],
                "description": r["description"],
                "sheet_name": r["sheet_name"],
                "cell_ref": r["cell_ref"],
                "level": r["level"],
                "parent_code": r["parent_code"],
                "created_at": datetime.fromisoformat(r["created_at"]),
            }
            for r in rows
        ]

    with db.cursor() as cur:
        cur.execute(
            """
            select id, config_id as mapping_id, code, description, sheet_name, cell_ref, level, parent_code, uploaded_at as created_at
            from public.mapping
            where config_id = %(config_id)s
            order by level, code
            """,
            {"config_id": cfg},
        )
        return list(cur.fetchall())


@router.post("/{mapping_id}/activate", response_model=MappingOut)
def activate_mapping(mapping_id: str, db: Annotated[Any, Depends(get_db)]):
    """Activate a mapping (deactivates others with same name and model)."""
    import sqlite3

    cfg = mapping_id
    if isinstance(db, sqlite3.Connection):
        cur = db.execute("select name, model_id from mapping where config_id = :id limit 1", {"id": cfg})
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Mapping not found")
        row = dict(zip(row.keys(), row))  # sqlite3.Row has no .get()
        name, mid = row["name"], row.get("model_id")
        if mid:
            db.execute("update mapping set is_active = 0 where name = :name and model_id = :mid", {"name": name, "mid": mid})
        else:
            db.execute("update mapping set is_active = 0 where name = :name and model_id is null", {"name": name})
        db.execute("update mapping set is_active = 1 where config_id = :id", {"id": cfg})
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select name, model_id from public.mapping where config_id = %(id)s limit 1", {"id": cfg})
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Mapping not found")
                name, mid = row["name"], row.get("model_id")
                cur.execute(
                    "update public.mapping set is_active = false where name = %(name)s and (model_id is not distinct from %(mid)s)",
                    {"name": name, "mid": mid},
                )
                cur.execute("update public.mapping set is_active = true where config_id = %(id)s", {"id": cfg})

    mappings = list_mappings(db, model_id=mid)
    for m in mappings:
        if str(m["id"]) == str(mapping_id):
            return m

    raise HTTPException(status_code=500, detail="Mapping activated but not found")


@router.delete("/{mapping_id}", status_code=204)
def delete_mapping(mapping_id: str, db: Annotated[Any, Depends(get_db)]):
    """Delete a mapping (cascades to items)."""
    import sqlite3

    cfg = mapping_id
    if isinstance(db, sqlite3.Connection):
        cur = db.execute("delete from mapping where config_id = :id", {"id": cfg})
        db.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Mapping not found")
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("delete from public.mapping where config_id = %(id)s", {"id": cfg})
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Mapping not found")
