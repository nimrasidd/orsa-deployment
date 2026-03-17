"""Reports list API - returns report_nodes joined with uploads for tabular view."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..services.report_queries import list_report_nodes, get_values_by_year, get_values_table

router = APIRouter(prefix="/reports", tags=["reports-list"])


@router.get("")
def get_reports_list(
    db: Annotated[Any, Depends(get_db)],
    upload_id: str | None = Query(default=None, description="Filter by upload ID"),
    report_key: str | None = Query(default=None, description="Filter by report key"),
    limit: int = Query(default=5000, le=20000, description="Max rows to return"),
):
    """
    List report data from report_nodes table joined with uploads.
    Returns: code, description, value, sheet_name, cell_ref, level, report_key, version_no, etc.
    """
    rows = list_report_nodes(db, upload_id=upload_id, report_key=report_key, limit=limit)
    return {"items": rows, "count": len(rows)}


@router.get("/chart-data")
def get_chart_data(
    db: Annotated[Any, Depends(get_db)],
    report_key: str | None = Query(default=None, description="Filter by report key"),
    company_id: str | None = Query(default=None, description="Filter by company"),
    node_code: str | None = Query(default=None, description="Node code or description to match (e.g. Gross Written)"),
    date_from: str | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    year_from: int | None = Query(default=None, description="Filter from year (inclusive)"),
    year_to: int | None = Query(default=None, description="Filter to year (inclusive)"),
    report_month: int | None = Query(default=None, ge=1, le=12, description="Filter by month (1-12)"),
    quarter: int | None = Query(default=None, ge=1, le=4, description="Filter by quarter (1-4)"),
):
    """
    Values by year for bar chart. One file per year: uploads grouped by report_year.
    Time period: date_from/date_to (YYYY-MM-DD) or year_from/year_to, report_month, quarter.
    Returns [{year, value, label, upload_id}, ...] sorted by year.
    """
    return get_values_by_year(
        db,
        report_key=report_key,
        company_id=company_id,
        node_code=node_code,
        year_from=year_from,
        year_to=year_to,
        report_month=report_month,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/chart-table")
def get_chart_table(
    db: Annotated[Any, Depends(get_db)],
    report_key: str | None = Query(default=None, description="Filter by report key"),
    company_id: str | None = Query(default=None, description="Filter by company"),
    node_code: str | None = Query(default=None, description="Node code or description to match"),
    date_from: str | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    year_from: int | None = Query(default=None, description="Filter from year (inclusive)"),
    year_to: int | None = Query(default=None, description="Filter to year (inclusive)"),
    report_month: int | None = Query(default=None, ge=1, le=12, description="Filter by month (1-12)"),
    quarter: int | None = Query(default=None, ge=1, le=4, description="Filter by quarter (1-4)"),
):
    """
    Values as table: rows = metric names, columns = years.
    Time period: date_from/date_to (YYYY-MM-DD) or year_from/year_to.
    Returns {years: [2020, 2021, ...], rows: [{name, code, values: {year: value}}, ...]}.
    """
    return get_values_table(
        db,
        report_key=report_key,
        company_id=company_id,
        node_code=node_code,
        year_from=year_from,
        year_to=year_to,
        report_month=report_month,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
    )
