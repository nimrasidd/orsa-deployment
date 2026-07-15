"""
LLM service: generates a short narrative summary from structured insight facts.
Falls back to template-based narrative if no API key or on error.
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a senior solvency and risk analyst advising a company's management on their ORSA (Own Risk and Solvency Assessment) position.

Given the company's latest figures (SCR, MCR, capital requirements, risk categories), tell them a story:
1. Open with a one-sentence executive summary of their solvency position
2. Highlight 3-5 key findings as bullet points:
   - Capital adequacy (SCR ratio, surplus/deficit)
   - Risk concentration (which risk categories are growing)
   - Trends vs prior period (improving or deteriorating)
   - Suggested Key Risk Indicators (KRIs) they should monitor based on their data patterns
3. End with a brief forward-looking recommendation

Write like you're briefing the CEO — professional, clear, actionable. Use plain numbers.
Do NOT repeat raw data — interpret and advise. Maximum 200 words."""


def _build_user_prompt(summary: dict) -> str:
    company = summary.get("company_name") or "the company"
    period = summary.get("reporting_period") or "latest"
    metrics = summary.get("headline_metrics") or []
    movers = summary.get("top_movers") or []
    alerts = summary.get("alerts") or []

    facts = {
        "company": company,
        "reporting_period": period,
        "headline_metrics": [
            {"name": m["name"], "value": m["value"], "change_pct": m.get("change_pct")}
            for m in metrics[:6]
        ],
        "notable_movers": [
            {"name": m["name"], "value": m["value"], "change_pct": m.get("change_pct")}
            for m in movers[:5]
        ],
        "alerts": alerts[:4],
    }
    return json.dumps(facts, indent=2)


async def generate_narrative(summary: dict) -> tuple[str, bool]:
    """
    Returns (narrative_text, llm_used).
    If LLM unavailable, returns fallback narrative.
    """
    from ..config import settings

    api_key = getattr(settings, "openai_api_key", "") or ""
    if not api_key.strip():
        from .insights_service import generate_fallback_narrative
        return generate_fallback_narrative(summary), False

    model = getattr(settings, "openai_model", "gpt-4o-mini") or "gpt-4o-mini"

    try:
        import openai

        client = openai.AsyncOpenAI(api_key=api_key, timeout=15.0)
        user_prompt = _build_user_prompt(summary)

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=300,
            temperature=0.4,
        )
        text = response.choices[0].message.content or ""
        return text.strip(), True

    except ImportError:
        logger.warning("openai package not installed; using fallback narrative")
        from .insights_service import generate_fallback_narrative
        return generate_fallback_narrative(summary), False

    except Exception as e:
        logger.warning(f"LLM call failed: {e}; using fallback narrative")
        from .insights_service import generate_fallback_narrative
        return generate_fallback_narrative(summary), False
