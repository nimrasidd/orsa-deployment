"""Reports list API - returns report_nodes joined with uploads for tabular view."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..services.report_queries import list_report_nodes, get_values_by_year, get_values_table
from .auth import UserOut, effective_company_id, get_current_user

router = APIRouter(prefix="/reports", tags=["reports-list"])


@router.get("")
def get_reports_list(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    upload_id: str | None = Query(default=None, description="Filter by upload ID"),
    report_key: str | None = Query(default=None, description="Filter by report key"),
    limit: int = Query(default=5000, le=20000, description="Max rows to return"),
):
    """
    List report data from report_nodes table joined with uploads.
    Returns: code, description, value, sheet_name, cell_ref, level, report_key, version_no, etc.
    """
    company_id = effective_company_id(user, None)
    rows = list_report_nodes(
        db,
        upload_id=upload_id,
        report_key=report_key,
        company_id=company_id,
        limit=limit,
    )
    return {"items": rows, "count": len(rows)}


@router.get("/chart-data")
def get_chart_data(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    report_key: str | None = Query(default=None, description="Filter by report key"),
    company_id: str | None = Query(default=None, description="Filter by company"),
    region_id: str | None = Query(default=None, description="Filter by region"),
    country_id: str | None = Query(default=None, description="Filter by country"),
    model_id: str | None = Query(default=None, description="Filter by mapping model id"),
    latest_only: bool = Query(default=False, description="One upload per report_key (latest version)"),
    node_code: str | None = Query(default=None, description="Node code or description to match (e.g. Gross Written)"),
    date_from: str | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    year_from: int | None = Query(default=None, description="Filter from year (inclusive)"),
    year_to: int | None = Query(default=None, description="Filter to year (inclusive)"),
    report_month: int | None = Query(default=None, ge=1, le=12, description="Filter by month (1-12)"),
    quarter: int | None = Query(default=None, ge=1, le=4, description="Filter by quarter (1-4)"),
    period_group: str = Query(
        default="quarter",
        description="Chart bucket: year | quarter | month (default quarter)",
    ),
):
    """
    Values by period for bar chart: one bar per year, quarter, or month (see period_group).
    Time period: date_from/date_to (YYYY-MM-DD) or year_from/year_to, report_month, quarter.
    Returns [{year, value, label, upload_id, period, ...}, ...] sorted by period.
    """
    cid = effective_company_id(user, company_id)
    return get_values_by_year(
        db,
        report_key=report_key,
        company_id=cid,
        region_id=region_id,
        country_id=country_id,
        model_id=model_id,
        latest_only=latest_only,
        node_code=node_code,
        year_from=year_from,
        year_to=year_to,
        report_month=report_month,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
        period_group=period_group,
    )


@router.get("/chart-table")
def get_chart_table(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut, Depends(get_current_user)],
    report_key: str | None = Query(default=None, description="Filter by report key"),
    company_id: str | None = Query(default=None, description="Filter by company"),
    region_id: str | None = Query(default=None, description="Filter by region"),
    country_id: str | None = Query(default=None, description="Filter by country"),
    model_id: str | None = Query(default=None, description="Filter by mapping model id"),
    latest_only: bool = Query(default=False, description="One upload per report_key (latest version)"),
    node_code: str | None = Query(default=None, description="Node code or description to match"),
    date_from: str | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    year_from: int | None = Query(default=None, description="Filter from year (inclusive)"),
    year_to: int | None = Query(default=None, description="Filter to year (inclusive)"),
    report_month: int | None = Query(default=None, ge=1, le=12, description="Filter by month (1-12)"),
    quarter: int | None = Query(default=None, ge=1, le=4, description="Filter by quarter (1-4)"),
    period_group: str = Query(
        default="quarter",
        description="Column bucket: year | quarter | month (default quarter)",
    ),
):
    """
    Values as table: rows = metric names, columns = calendar years, quarters, or months.
    Time period: date_from/date_to (YYYY-MM-DD) or year_from/year_to.
    Returns {years, periods, rows} — use periods when non-null for column headers.
    """
    cid = effective_company_id(user, company_id)
    return get_values_table(
        db,
        report_key=report_key,
        company_id=cid,
        region_id=region_id,
        country_id=country_id,
        model_id=model_id,
        latest_only=latest_only,
        node_code=node_code,
        year_from=year_from,
        year_to=year_to,
        report_month=report_month,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
        period_group=period_group,
    )
