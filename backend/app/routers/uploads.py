from __future__ import annotations

import logging
import zipfile
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from xlrd.biffh import XLRDError

from ..db import get_db
from .auth import UserOut, effective_company_id, get_current_user

logger = logging.getLogger(__name__)
from ..schemas import UploadOut
from ..services.excel_import import derive_hierarchy, parse_excel_rows
from ..services.mapping_service import (
    extract_values_from_file,
    fetch_mapping_items_by_config_id,
    get_active_mapping_items,
    get_mapping_config_model_id,
)
from ..services.report_queries import create_upload_with_nodes, get_upload_company_id, list_uploads

router = APIRouter(prefix="/uploads", tags=["uploads"])

_BAD_EXCEL_MSG = (
    "Unsupported file format. .xlsx and .xls (Excel 97-2003) are supported. "
    "Please save as .xlsx or .xls."
)


def _region_country_for_company(db: Any, company_id: str) -> tuple[str | None, str | None]:
    """Return (region_id, country_id) from companies so uploads match dashboard geo filters."""
    import sqlite3

    if isinstance(db, sqlite3.Connection):
        cur = db.execute(
            "select region_id, country_id from companies where id = ? limit 1",
            (company_id,),
        )
        row = cur.fetchone()
    else:
        with db.cursor() as cur:
            cur.execute(
                """
                select region_id, country_id from public.companies
                where id = %(id)s::uuid
                limit 1
                """,
                {"id": company_id},
            )
            row = cur.fetchone()
    if not row:
        return None, None
    rid = row["region_id"]
    cid = row["country_id"]
    return (str(rid) if rid is not None else None, str(cid) if cid is not None else None)


def _assert_model_in_company(db: Any, model_id: str | None, company_id: str) -> None:
    # Company-based model access removed.
    # Kept for backward compatibility; no-op now.
    _ = (db, model_id, company_id)
    return


def _assert_mapping_config_usable(
    db: Any,
    user: UserOut,
    config_id: str,
    model_id: str | None,
    company_id: str | None,
) -> None:
    mid = get_mapping_config_model_id(db, config_id)
    if mid is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if model_id and str(mid) != str(model_id):
        raise HTTPException(status_code=400, detail="Selected mapping does not match the selected model")
    if not user.is_admin:
        if not company_id:
            raise HTTPException(status_code=403, detail="No company assigned to this account")
        _assert_model_in_company(db, str(mid), company_id)


@router.post("/preview")
async def preview_upload(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
    model_id: Annotated[str | None, Form()] = None,
    mapping_config_id: Annotated[
        str | None,
        Form(description="Mapping config id from the model’s mapping list (upload UI dropdown). Uses active mapping if omitted."),
    ] = None,
):
    """
    Preview extraction for an upload.
    Send `mapping_config_id` to match the mapping dropdown; otherwise uses the model’s active mapping.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    if not user.is_admin:
        if not user.company_id:
            raise HTTPException(status_code=403, detail="No company assigned to this account")
        _assert_model_in_company(db, model_id, user.company_id)

    data = await file.read()
    try:
        if mapping_config_id:
            _assert_mapping_config_usable(
                db, user, mapping_config_id, model_id, user.company_id if not user.is_admin else None
            )
            mapping_items = fetch_mapping_items_by_config_id(db, mapping_config_id)
        else:
            mapping_items = get_active_mapping_items(db, model_id=model_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="No active mapping")

    if not mapping_items:
        raise HTTPException(status_code=400, detail="No active mapping. Activate a mapping in Mappings.")

    from ..services.mapping_service import MappingItem
    mapping_item_objs = [
        MappingItem(
            code=item["code"],
            description=item["description"],
            sheet_name=item["sheet_name"],
            cell_ref=item["cell_ref"],
            level=item["level"],
            parent_code=item["parent_code"],
        )
        for item in mapping_items
    ]

    try:
        extracted = extract_values_from_file(data, mapping_item_objs)
    except (zipfile.BadZipFile, XLRDError):
        logger.warning("Preview: unsupported format (BadZipFile or XLRDError)")
        raise HTTPException(status_code=400, detail=_BAD_EXCEL_MSG)
    except ValueError as e:
        logger.warning("Preview: Excel read failed: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Preview: unexpected error reading Excel")
        raise HTTPException(status_code=400, detail=f"Failed to read Excel: {e}") from e

    from ..services.excel_loader import load_excel_sheets
    sheets_info = []
    try:
        loaded = load_excel_sheets(data)
        sheets_info = [name for name, _ in loaded]
    except Exception:
        pass

    preview = [
        {
            "code": item["code"],
            "description": item.get("description"),
            "sheet_name": item["sheet_name"],
            "cell_ref": item["cell_ref"],
            "value": str(v) if (v := extracted.get(item["code"])) is not None else None,
        }
        for item in mapping_items
    ]
    return {"items": preview, "file_sheets": sheets_info}


@router.get("", response_model=list[UploadOut])
def get_uploads(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    report_key: str | None = Query(default=None),
    latestOnly: bool = Query(default=False),
    region_id: str | None = Query(default=None),
    country_id: str | None = Query(default=None),
    model_id: str | None = Query(default=None),
    company_id: str | None = Query(default=None),
    report_year: int | None = Query(default=None),
    report_month: int | None = Query(default=None),
):
    cid = effective_company_id(user, company_id)
    return list_uploads(
        db,
        report_key=report_key,
        latest_only=latestOnly,
        region_id=region_id,
        country_id=country_id,
        model_id=model_id,
        company_id=cid,
        report_year=report_year,
        report_month=report_month,
    )


def _assert_upload_deletable(db: Any, user: UserOut, upload_id: str) -> None:
    if user.is_admin:
        return
    cid = get_upload_company_id(db, upload_id)
    if cid is None or str(cid) != str(user.company_id):
        raise HTTPException(status_code=404, detail="Upload not found")


@router.delete("/{upload_id}", status_code=204)
def delete_upload(
    upload_id: str,
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
):
    """
    Delete one upload and all linked data (report_nodes, report_region_applicability cascade).
    Company users may only delete uploads belonging to their company.
    """
    import sqlite3

    _assert_upload_deletable(db, user, upload_id)
    if isinstance(db, sqlite3.Connection):
        cur = db.execute("delete from uploads where id = ?", (upload_id,))
        db.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Upload not found")
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("delete from public.uploads where id = %(id)s::uuid", {"id": upload_id})
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Upload not found")


@router.post("", response_model=UploadOut)
async def create_upload(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
    report_key: Annotated[str, Form()],
    notes: Annotated[str | None, Form()] = None,
    use_mapping: Annotated[
        bool,
        Form(
            description=(
                "If true, extract using `mapping_config_id` (if sent) or the model’s active mapping (Code→Sheet, Cell). "
                "If false, parse Code, Description, Value (and sheet/cell columns) from the file."
            ),
        ),
    ] = True,
    mapping_config_id: Annotated[
        str | None,
        Form(
            description="Mapping config id for the selected model. Shown as the mapping dropdown in the upload UI; omit to use the active mapping.",
        ),
    ] = None,
    region_id: Annotated[str | None, Form()] = None,
    country_id: Annotated[str | None, Form()] = None,
    model_id: Annotated[str | None, Form()] = None,
    company_id: Annotated[str | None, Form()] = None,
    report_year: Annotated[int | None, Form()] = None,
    report_month: Annotated[int | None, Form()] = None,
):
    """
    Upload a file and extract values.

    If use_mapping=True and mapping_config_id is set, that mapping is used. If use_mapping=True
    without mapping_config_id, the active mapping for the model is used. Otherwise, the file must
    contain Code, Description, Value, Sheet, Cell Reference columns.

    Region and country on the saved upload are taken from the resolved company's row when present
    (see Settings → Companies); optional form fields only apply if the company has no region/country set.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    effective_company = effective_company_id(user, company_id) or user.company_id
    if not effective_company:
        raise HTTPException(status_code=400, detail="Company is required for this upload")
    if model_id and not user.is_admin:
        _assert_model_in_company(db, model_id, effective_company)

    data = await file.read()
    nodes: list[dict] = []
    mapping_id: str | None = None

    # Try mapping-based extraction if requested
    if use_mapping:
        try:
            if mapping_config_id:
                _assert_mapping_config_usable(db, user, mapping_config_id, model_id, effective_company)
                mapping_items = fetch_mapping_items_by_config_id(db, mapping_config_id)
            else:
                mapping_items = get_active_mapping_items(db, model_id=model_id)
            if mapping_items:
                # Extract mapping_id from first item
                mapping_id = str(mapping_items[0]["mapping_id"])

                # Convert mapping items to MappingItem dataclass format
                from ..services.mapping_service import MappingItem
                mapping_item_objs = [
                    MappingItem(
                        code=item["code"],
                        description=item["description"],
                        sheet_name=item["sheet_name"],
                        cell_ref=item["cell_ref"],
                        level=item["level"],
                        parent_code=item["parent_code"],
                    )
                    for item in mapping_items
                ]

                # Extract values from uploaded file using mapping
                try:
                    extracted_values = extract_values_from_file(data, mapping_item_objs)
                except (zipfile.BadZipFile, XLRDError):
                    logger.warning("Upload: unsupported format (BadZipFile or XLRDError)")
                    raise HTTPException(status_code=400, detail=_BAD_EXCEL_MSG)
                except ValueError as e:
                    logger.warning("Upload: Excel read failed: %s", e)
                    raise HTTPException(status_code=400, detail=str(e)) from e
                except Exception as e:
                    logger.exception("Upload: unexpected error reading Excel")
                    raise HTTPException(status_code=400, detail=f"Failed to read Excel: {e}") from e

                # Build nodes from mapping items with extracted values
                for item in mapping_items:
                    value = extracted_values.get(item["code"])
                    # Convert Decimal to float for DB compatibility (SQLite, JSON)
                    if value is not None and hasattr(value, "__float__"):
                        value = float(value)
                    nodes.append(
                        {
                            "code": item["code"],
                            "level": item["level"],
                            "parent_code": item["parent_code"],
                            "description": item["description"],
                            "value": value,
                            "sheet_name": item["sheet_name"],
                            "cell_ref": item["cell_ref"],
                        }
                    )
        except HTTPException:
            raise  # Re-raise client errors (e.g. BadZipFile)
        except Exception:
            # If mapping fails, fall through to parse_excel_rows
            pass

    # Fallback: parse file as-is (must have Code, Description, Value columns)
    if not nodes:
        try:
            rows = parse_excel_rows(data)
        except (zipfile.BadZipFile, XLRDError):
            logger.warning("Upload fallback: unsupported format")
            raise HTTPException(status_code=400, detail=_BAD_EXCEL_MSG)
        except ValueError as e:
            logger.warning("Upload fallback: parse failed: %s", e)
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            logger.exception("Upload fallback: unexpected error")
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {e}") from e

        for r in rows:
            level, parent_code = derive_hierarchy(r.code)
            val = r.value
            if val is not None and hasattr(val, "__float__"):
                val = float(val)
            nodes.append(
                {
                    "code": r.code,
                    "level": level,
                    "parent_code": parent_code,
                    "description": r.description,
                    "value": val,
                    "sheet_name": r.sheet_name,
                    "cell_ref": r.cell_ref,
                }
            )

    if not nodes:
        raise HTTPException(status_code=400, detail="No data found in file")

    # Region/country on the upload row follow the company master record (Settings → Companies).
    # One company maps to one region/country; multiple companies may share a country.
    # Prefer DB values so uploads stay consistent even if the client omits or sends stale geo fields.
    resolved_region = (region_id or "").strip() or None
    resolved_country = (country_id or "").strip() or None
    if effective_company:
        cr, cc = _region_country_for_company(db, effective_company)
        if cr:
            resolved_region = cr
        if cc:
            resolved_country = cc

    resolved_model = (model_id or "").strip() or None
    if not resolved_model and mapping_id:
        mid = get_mapping_config_model_id(db, mapping_id)
        resolved_model = str(mid) if mid is not None else None

    # Populate report_region_applicability when region is known
    applicable_region_ids: list[str] = []
    if resolved_region:
        applicable_region_ids.append(resolved_region)

    try:
        upload = create_upload_with_nodes(
            db,
            report_key=report_key,
            original_filename=file.filename,
            notes=notes,
            nodes=nodes,
            mapping_id=mapping_id,
            region_id=resolved_region,
            country_id=resolved_country,
            model_id=resolved_model,
            company_id=effective_company,
            report_year=report_year,
            report_month=report_month,
            applicable_region_ids=applicable_region_ids,
        )
    except Exception as e:  # noqa: BLE001
        msg = str(e)[:500]
        raise HTTPException(status_code=500, detail=f"Failed to create upload: {msg}") from e

    return upload

