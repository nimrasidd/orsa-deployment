"""
Build an insights summary for a user's company from their latest uploaded report data.
Returns structured KPIs, deltas, and rule-based alerts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .report_queries import get_report_nodes, list_uploads

logger = logging.getLogger(__name__)


def _parse_value(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / abs(previous)) * 100, 2)


def build_insights_summary(
    conn: Any,
    company_id: str | None,
    company_name: str | None = None,
    model_id: str | None = None,
    report_key: str | None = None,
) -> dict:
    """
    Produce a dict matching InsightsSummaryOut schema.
    Steps:
      1. Get latest upload for company (optionally filtered by model/report_key).
      2. Get the second-latest upload (same scope) for comparison.
      3. Extract level-1 nodes as headline metrics with % change.
      4. Extract level-2 nodes to find top movers.
      5. Generate rule-based alerts.
    """
    uploads = list_uploads(
        conn,
        report_key=report_key,
        latest_only=False,
        model_id=model_id,
        company_id=company_id,
    )

    if not uploads:
        return _empty_summary(company_name)

    # Sort descending by uploaded_at
    uploads.sort(key=lambda u: u.get("uploaded_at") or "", reverse=True)

    latest = uploads[0]
    previous = uploads[1] if len(uploads) > 1 else None

    latest_id = str(latest["id"])
    previous_id = str(previous["id"]) if previous else None

    # Period label
    yr = latest.get("report_year")
    mo = latest.get("report_month")
    if yr and mo:
        period = f"{yr}-{int(mo):02d}"
    elif yr:
        period = str(yr)
    else:
        period = "Latest"

    # Get nodes
    latest_nodes = get_report_nodes(conn, latest_id)
    previous_nodes = get_report_nodes(conn, previous_id) if previous_id else []

    # Build lookup for previous values by code
    prev_by_code: dict[str, float] = {}
    for n in previous_nodes:
        code = n.get("code") or ""
        val = _parse_value(n.get("value"))
        if val is not None:
            prev_by_code[code] = val

    # Headline metrics: level 1 nodes
    headline_metrics: list[dict] = []
    all_metrics: list[dict] = []

    for n in latest_nodes:
        code = n.get("code") or ""
        name = n.get("description") or code
        val = _parse_value(n.get("value"))
        level = n.get("level")
        try:
            level_int = int(level) if level is not None else 99
        except (TypeError, ValueError):
            level_int = 99

        if val is None:
            continue

        prev_val = prev_by_code.get(code)
        change_pct = _pct_change(val, prev_val) if prev_val is not None else None

        metric = {
            "code": code,
            "name": name,
            "value": val,
            "change_pct": change_pct,
            "period": period,
        }

        if level_int == 1:
            headline_metrics.append(metric)
        all_metrics.append({**metric, "level": level_int})

    # Top movers: level-2 nodes with biggest absolute % change
    level2 = [m for m in all_metrics if m.get("level") == 2 and m.get("change_pct") is not None]
    level2.sort(key=lambda m: abs(m["change_pct"] or 0), reverse=True)
    top_movers = level2[:5]

    # Rule-based alerts
    alerts = _generate_alerts(headline_metrics, top_movers)

    return {
        "company_name": company_name,
        "reporting_period": period,
        "headline_metrics": headline_metrics[:8],
        "top_movers": top_movers,
        "alerts": alerts,
        "narrative": "",  # filled by llm_service or fallback
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_upload_id": latest_id,
        "llm_used": False,
        "upload_count": len(uploads),
    }


def _generate_alerts(headlines: list[dict], movers: list[dict]) -> list[str]:
    alerts: list[str] = []

    for m in headlines:
        pct = m.get("change_pct")
        if pct is None:
            continue
        name = m.get("name") or m.get("code") or "Metric"
        if pct <= -10:
            alerts.append(f"{name} dropped {abs(pct):.1f}% - review required")
        elif pct >= 20:
            alerts.append(f"{name} increased {pct:.1f}% - significant growth")
        elif pct <= -5:
            alerts.append(f"{name} decreased {abs(pct):.1f}%")

    for m in movers[:3]:
        pct = m.get("change_pct")
        if pct is None:
            continue
        name = m.get("name") or m.get("code") or "Item"
        if abs(pct) >= 15:
            direction = "up" if pct > 0 else "down"
            alerts.append(f"{name} moved {direction} {abs(pct):.1f}%")

    return alerts[:6]


def _empty_summary(company_name: str | None) -> dict:
    return {
        "company_name": company_name,
        "reporting_period": None,
        "headline_metrics": [],
        "top_movers": [],
        "alerts": [],
        "narrative": "No data found for your company. If reports have been uploaded, insights will appear here shortly.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_upload_id": None,
        "llm_used": False,
        "upload_count": 0,
    }


def generate_fallback_narrative(summary: dict) -> str:
    """Template-based narrative when LLM is unavailable."""
    period = summary.get("reporting_period") or "the latest period"
    metrics = summary.get("headline_metrics") or []
    alerts = summary.get("alerts") or []
    company = summary.get("company_name") or "Your company"

    if not metrics:
        return f"No solvency metrics available for {company} in {period}. Once your report data is processed, capital adequacy, risk breakdowns, and KRI suggestions will appear here automatically."

    # Executive summary
    improving = sum(1 for m in metrics if (m.get("change_pct") or 0) > 0)
    declining = sum(1 for m in metrics if (m.get("change_pct") or 0) < 0)

    if improving > declining:
        trend = "an improving trend"
    elif declining > improving:
        trend = "areas requiring attention"
    else:
        trend = "a stable position"

    lines = [f"Solvency Overview for {period}: {company} shows {trend} across {len(metrics)} key capital metrics."]
    lines.append("")

    # Key metrics narrative
    lines.append("Key Figures:")
    for m in metrics[:4]:
        name = m.get("name") or m.get("code")
        val = m.get("value")
        pct = m.get("change_pct")
        if val is not None:
            val_str = f"{val:,.0f}" if abs(val) >= 1000 else f"{val:,.2f}"
            change_str = ""
            if pct is not None:
                direction = "increased" if pct > 0 else "decreased"
                change_str = f" - {direction} {abs(pct):.1f}% vs prior period"
            lines.append(f"  - {name}: {val_str}{change_str}")

    # KRI suggestions based on alerts
    if alerts:
        lines.append("")
        lines.append("Suggested KRIs to monitor:")
        for a in alerts[:3]:
            lines.append(f"  - {a}")

    lines.append("")
    lines.append("Recommendation: Review flagged metrics and ensure capital buffers remain within risk appetite thresholds.")

    return "\n".join(lines)
