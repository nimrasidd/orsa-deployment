"""
GET /insights/summary — AI-powered solvency insights for the logged-in user's company.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..schemas import InsightsSummaryOut
from .auth import UserOut, effective_company_id, get_current_user
from ..services.insights_service import build_insights_summary, generate_fallback_narrative
from ..services.llm_service import generate_narrative
from ..config import settings

router = APIRouter(prefix="/insights", tags=["insights"])

# Simple in-memory cache: key -> (result, timestamp)
_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 900  # 15 minutes


def _cache_key(company_id: str | None, model_id: str | None, report_key: str | None) -> str:
    return f"{company_id or ''}|{model_id or ''}|{report_key or ''}"


@router.get("/summary", response_model=InsightsSummaryOut)
async def get_insights_summary(
    model_id: str | None = Query(default=None),
    report_key: str | None = Query(default=None),
    company_id: str | None = Query(default=None),
    user: UserOut = Depends(get_current_user),
    db: Any = Depends(get_db),
):
    if not settings.insights_enabled:
        return InsightsSummaryOut(
            narrative="Insights are currently disabled.",
            generated_at="",
            llm_used=False,
        )

    cid = effective_company_id(user, company_id)
    company_name = user.company_name

    # Check cache
    ck = _cache_key(cid, model_id, report_key)
    cached = _cache.get(ck)
    if cached:
        result, ts = cached
        if time.time() - ts < _CACHE_TTL:
            return InsightsSummaryOut(**result)

    # Build structured summary
    summary = build_insights_summary(
        conn=db,
        company_id=cid,
        company_name=company_name,
        model_id=model_id,
        report_key=report_key,
    )

    # Generate narrative (LLM or fallback)
    if summary.get("headline_metrics"):
        narrative, llm_used = await generate_narrative(summary)
        summary["narrative"] = narrative
        summary["llm_used"] = llm_used
    elif not summary.get("narrative"):
        summary["narrative"] = generate_fallback_narrative(summary)

    # Cache result
    _cache[ck] = (summary, time.time())

    return InsightsSummaryOut(**summary)
