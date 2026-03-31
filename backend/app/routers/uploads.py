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
from ..services.mapping_service import extract_values_from_file, get_active_mapping_items
from ..services.report_queries import create_upload_with_nodes, list_uploads

router = APIRouter(prefix="/uploads", tags=["uploads"])

_BAD_EXCEL_MSG = (
    "Unsupported file format. .xlsx and .xls (Excel 97-2003) are supported. "
    "Please save as .xlsx or .xls."
)


def _assert_model_in_company(db: Any, model_id: str | None, company_id: str) -> None:
    if not model_id:
        return
    import sqlite3

    if isinstance(db, sqlite3.Connection):
        cur = db.execute("select company_id from models where id = ?", (model_id,))
        row = cur.fetchone()
    else:
        with db.cursor() as cur:
            cur.execute("select company_id from public.models where id = %(id)s", {"id": model_id})
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Model not found")
    mid_cid = str(row["company_id"])
    if mid_cid != company_id:
        raise HTTPException(status_code=403, detail="Model is not in your company")


@router.post("/preview")
async def preview_upload(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
    model_id: Annotated[str | None, Form()] = None,
):
    """
    Preview what will be extracted and stored when uploading.
    Uses active mapping for the selected model (or first active if none specified).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    if not user.is_admin:
        _assert_model_in_company(db, model_id, user.company_id)

    data = await file.read()
    try:
        mapping_items = get_active_mapping_items(db, model_id=model_id)
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


@router.post("", response_model=UploadOut)
async def create_upload(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
    report_key: Annotated[str, Form()],
    notes: Annotated[str | None, Form()] = None,
    use_mapping: Annotated[bool, Form()] = True,
    region_id: Annotated[str | None, Form()] = None,
    country_id: Annotated[str | None, Form()] = None,
    model_id: Annotated[str | None, Form()] = None,
    company_id: Annotated[str | None, Form()] = None,
    report_year: Annotated[int | None, Form()] = None,
    report_month: Annotated[int | None, Form()] = None,
):
    """
    Upload a file and extract values.

    If use_mapping=True and an active mapping exists, values are extracted from the uploaded file
    based on the mapping (Code -> Sheet, Cell Reference). Otherwise, the file must contain
    Code, Description, Value, Sheet, Cell Reference columns.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    effective_company = effective_company_id(user, company_id) or user.company_id
    if not effective_company:
        raise HTTPException(status_code=400, detail="Company is required for this upload")
    if model_id and not user.is_admin:
        _assert_model_in_company(db, model_id, user.company_id)

    data = await file.read()
    nodes: list[dict] = []
    mapping_id: str | None = None

    # Try to use active mapping if requested (company_model_id or first active)
    if use_mapping:
        try:
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

    # Populate report_region_applicability when region is known
    applicable_region_ids: list[str] = []
    if region_id:
        applicable_region_ids.append(region_id)

    try:
        upload = create_upload_with_nodes(
            db,
            report_key=report_key,
            original_filename=file.filename,
            notes=notes,
            nodes=nodes,
            mapping_id=mapping_id,
            region_id=region_id,
            country_id=country_id,
            model_id=model_id,
            company_id=effective_company,
            report_year=report_year,
            report_month=report_month,
            applicable_region_ids=applicable_region_ids,
        )
    except Exception as e:  # noqa: BLE001
        msg = str(e)[:500]
        raise HTTPException(status_code=500, detail=f"Failed to create upload: {msg}") from e

    return upload

