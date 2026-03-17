from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from .excel_loader import _col_to_letter, load_excel_sheets


REQUIRED_HEADERS = {"code", "description", "value", "sheet", "cell reference"}

# Flexible header aliases (like mapping_service) - supports "Cell Ref", "Cell Reference", etc.
_HEADER_ALIASES: dict[str, list[str]] = {
    "code": ["code"],
    "description": ["description", "desc"],
    "value": ["value", "amount", "values"],
    "sheet": ["sheet", "sheet name"],
    "cell reference": ["cell reference", "cell ref", "cell_ref", "cell ref"],
}


def _match_upload_header(raw: str) -> str | None:
    """Map a raw header to canonical name if it matches."""
    h = str(raw).strip().lower()
    for canonical, aliases in _HEADER_ALIASES.items():
        if h == canonical or any(alias in h for alias in aliases):
            return canonical
    return None


@dataclass(frozen=True)
class ParsedRow:
    code: str
    description: str | None
    value: Decimal | None
    sheet_name: str
    cell_ref: str


def _norm_header(v: Any) -> str:
    return str(v).strip().lower()


def _norm_code(raw: Any) -> str:
    if raw is None:
        return ""

    if isinstance(raw, int):
        return str(raw)

    if isinstance(raw, float):
        # Convert 1.0 -> "1", 1.10 -> "1.1" (Excel numeric loses trailing zeros anyway)
        s = format(raw, "g")
        return s.strip()

    s = str(raw).strip()
    # guard against "1." / ".1" / multiple spaces
    s = s.strip(".")
    s = ".".join([seg.strip() for seg in s.split(".") if seg.strip()])
    return s


def _to_decimal(raw: Any) -> Decimal | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, Decimal):
        return raw
    if isinstance(raw, (int, float)):
        return Decimal(str(raw))
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def _find_header_map_from_rows(rows: list[list[Any]]) -> tuple[dict[str, int], int] | None:
    """
    Find a row that contains the required headers (with flexible aliases).
    Returns: (mapping canonical_name -> 1-based column index, header_row_0based) or None.
    """
    for r_idx, row in enumerate(rows[:50]):
        headers = [str(v).strip() for v in row]
        mapping: dict[str, int] = {}
        for idx, h in enumerate(headers, start=1):
            canonical = _match_upload_header(h)
            if canonical and canonical in REQUIRED_HEADERS and canonical not in mapping:
                mapping[canonical] = idx
        if REQUIRED_HEADERS.issubset(mapping.keys()):
            return mapping, r_idx
    return None


def parse_excel_rows(xlsx_bytes: bytes) -> list[ParsedRow]:
    """
    Parses an Excel workbook (xlsx or xls) that contains columns:
    Code, Description, Value, Sheet, Cell Reference

    The columns may appear on any worksheet; we scan worksheets for a header row.
    """
    sheets = load_excel_sheets(xlsx_bytes)
    parsed: list[ParsedRow] = []

    for sheet_name, rows in sheets:
        found = _find_header_map_from_rows(rows)
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

            raw_value = row[header_map["value"] - 1] if header_map["value"] <= len(row) else None
            value = _to_decimal(raw_value)

            sheet_val = row[header_map["sheet"] - 1] if header_map["sheet"] <= len(row) else None
            sheet_name_val = str(sheet_val).strip() if sheet_val else sheet_name

            cell_val = row[header_map["cell reference"] - 1] if header_map["cell reference"] <= len(row) else None
            cell_ref = str(cell_val).strip() if cell_val else f"{_col_to_letter(header_map['code'])}{r_idx + 1}"

            parsed.append(
                ParsedRow(
                    code=code,
                    description=description_s,
                    value=value,
                    sheet_name=sheet_name_val,
                    cell_ref=cell_ref,
                )
            )

    if not parsed:
        raise ValueError(
            "Could not find required columns (Code, Description, Value, Sheet, Cell Reference) in the workbook."
        )

    return parsed


def derive_hierarchy(code: str) -> tuple[int, str | None]:
    segments = [seg.strip() for seg in code.split(".") if seg.strip()]
    level = len(segments)
    parent_code = ".".join(segments[:-1]) if level > 1 else None
    return level, parent_code

