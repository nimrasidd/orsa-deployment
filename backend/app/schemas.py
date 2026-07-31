from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# Use str for ids to support both SQLite (text ids like "r-APAC") and Postgres (UUID)
class RegionOut(BaseModel):
    id: str
    name: str


class CountryOut(BaseModel):
    id: str
    region_id: str
    name: str


class ApplicationModelOut(BaseModel):
    id: str
    country_id: str
    name: str


class CompanyOut(BaseModel):
    id: str
    name: str
    region_id: str
    country_id: str | None = None
    region_name: str | None = None
    country_name: str | None = None


class UploadOut(BaseModel):
    id: str | UUID
    report_key: str
    version_no: int
    original_filename: str
    uploaded_at: datetime
    notes: str | None = None
    region_id: str | UUID | None = None
    country_id: str | UUID | None = None
    model_id: str | UUID | None = None
    company_id: str | UUID | None = None
    report_year: int | None = None
    report_month: int | None = None


class ReportNodeOut(BaseModel):
    id: str | UUID
    upload_id: str | UUID
    code: str
    level: int
    parent_code: str | None = None
    description: str | None = None
    value: Decimal | None = None
    sheet_name: str
    cell_ref: str
    created_at: datetime


class TreeNode(BaseModel):
    id: str | UUID
    code: str
    description: str | None = None
    value: Decimal | None = None
    sheet_name: str
    cell_ref: str
    level: int
    children: list["TreeNode"] = Field(default_factory=list)


class HealthOut(BaseModel):
    status: Literal["ok"] = "ok"
    details: dict[str, Any] = Field(default_factory=dict)


class MappingOut(BaseModel):
    # Postgres returns UUID objects; accept both and serialize as JSON strings.
    id: str | UUID
    model_id: str | UUID | None = None
    model_name: str | None = None
    name: str
    version: int
    is_active: bool
    uploaded_at: datetime
    uploaded_by: str | None = None
    notes: str | None = None
    item_count: int | None = None


class MappingItemOut(BaseModel):
    id: str | UUID
    mapping_id: str | UUID
    code: str
    description: str | None = None
    sheet_name: str
    cell_ref: str
    level: int
    parent_code: str | None = None
    created_at: datetime


class InsightMetric(BaseModel):
    code: str
    name: str
    value: float | None = None
    change_pct: float | None = None
    period: str


class InsightsSummaryOut(BaseModel):
    company_name: str | None = None
    reporting_period: str | None = None
    headline_metrics: list[InsightMetric] = Field(default_factory=list)
    top_movers: list[InsightMetric] = Field(default_factory=list)
    alerts: list[str] = Field(default_factory=list)
    narrative: str = ""
    generated_at: str
    source_upload_id: str | None = None
    llm_used: bool = False
    upload_count: int = 0

