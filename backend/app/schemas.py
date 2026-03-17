from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

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


class UploadOut(BaseModel):
    id: str
    report_key: str
    version_no: int
    original_filename: str
    uploaded_at: datetime
    notes: str | None = None
    region_id: str | None = None
    country_id: str | None = None
    model_id: str | None = None
    company_id: str | None = None
    report_year: int | None = None
    report_month: int | None = None


class ReportNodeOut(BaseModel):
    id: str
    upload_id: str
    code: str
    level: int
    parent_code: str | None = None
    description: str | None = None
    value: Decimal | None = None
    sheet_name: str
    cell_ref: str
    created_at: datetime


class TreeNode(BaseModel):
    id: str
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
    id: str
    model_id: str | None = None
    model_name: str | None = None
    name: str
    version: int
    is_active: bool
    uploaded_at: datetime
    uploaded_by: str | None = None
    notes: str | None = None
    item_count: int | None = None


class MappingItemOut(BaseModel):
    id: str
    mapping_id: str
    code: str
    description: str | None = None
    sheet_name: str
    cell_ref: str
    level: int
    parent_code: str | None = None
    created_at: datetime

