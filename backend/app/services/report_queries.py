from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
import sqlite3
from typing import Any
from uuid import uuid4

import psycopg

logger = logging.getLogger(__name__)

# numeric(18,4) max ~10^14; cap values to avoid DB overflow (works before migration to numeric(28,6))
# float(99999999999999.9999) rounds to 1e14 which overflows; use str for large values
_MAX_VALUE = Decimal("99999999999999.9999")
_MIN_VALUE = Decimal("-99999999999999.9999")


def _round_to_sig_figs(d: Decimal, n: int = 6) -> Decimal:
    """Round to n significant digits."""
    if d == 0:
        return d
    sign, digits, exp = d.as_tuple()
    magnitude = len(digits) + exp - 1
    quant_exp = magnitude - n + 1
    quant = Decimal(10) ** quant_exp
    return d.quantize(quant)


def _cap_value(v: Any) -> float | str | None:
    """Round to 6 significant digits and cap to fit numeric(18,4). Uses str for large values to avoid float overflow."""
    if v is None:
        return None
    try:
        d = Decimal(str(v))
        d = _round_to_sig_figs(d, 6)
        if d > _MAX_VALUE:
            return "99999999999999.9999"
        if d < _MIN_VALUE:
            return "-99999999999999.9999"
        # For values near limit, use str to avoid float overflow
        if d >= Decimal("99999999999999") or d <= Decimal("-99999999999999"):
            return str(d)
        return float(d)
    except Exception:
        return None


def list_uploads(
    conn: Any,
    report_key: str | None = None,
    latest_only: bool = False,
    region_id: str | None = None,
    country_id: str | None = None,
    model_id: str | None = None,
    company_id: str | None = None,
    report_year: int | None = None,
    report_month: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    quarter: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    params: dict = {
        "report_key": report_key,
        "region_id": region_id,
        "country_id": country_id,
        "model_id": model_id,
        "company_id": company_id,
        "report_year": report_year,
        "report_month": report_month,
        "year_from": year_from,
        "year_to": year_to,
    }
    wheres = ["(:report_key is null or report_key = :report_key)"]
    if region_id:
        wheres.append("(region_id = :region_id)")
    if country_id:
        wheres.append("(country_id = :country_id)")
    if model_id:
        wheres.append("(model_id = :model_id)")
    if company_id:
        wheres.append("(company_id = :company_id)")
    if report_year is not None:
        wheres.append("(report_year = :report_year)")
    if report_month is not None:
        wheres.append("(report_month = :report_month)")
    if year_from is not None:
        wheres.append("(report_year >= :year_from)")
    if year_to is not None:
        wheres.append("(report_year <= :year_to)")
    if quarter is not None and 1 <= quarter <= 4:
        # Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12
        m_from = (quarter - 1) * 3 + 1
        m_to = quarter * 3
        params["quarter_m_from"] = m_from
        params["quarter_m_to"] = m_to
        wheres.append("(report_month >= :quarter_m_from and report_month <= :quarter_m_to)")
    # date_from/date_to: YYYY-MM-DD -> filter by report_year, report_month
    if date_from:
        try:
            parts = date_from.split("-")
            if len(parts) >= 2:
                yf, mf = int(parts[0]), int(parts[1])
                params["date_from_y"] = yf
                params["date_from_m"] = mf
                wheres.append("(report_year > :date_from_y or (report_year = :date_from_y and report_month >= :date_from_m))")
        except (ValueError, IndexError):
            pass
    if date_to:
        try:
            parts = date_to.split("-")
            if len(parts) >= 2:
                yt, mt = int(parts[0]), int(parts[1])
                params["date_to_y"] = yt
                params["date_to_m"] = mt
                wheres.append("(report_year < :date_to_y or (report_year = :date_to_y and report_month <= :date_to_m))")
        except (ValueError, IndexError):
            pass
    where_clause = " and ".join(wheres)

    if isinstance(conn, sqlite3.Connection):
        cols = "id, report_key, version_no, original_filename, uploaded_at, notes, region_id, country_id, model_id, company_id, report_year, report_month"
        if latest_only:
            sql = f"""
            select {cols}
            from (
              select
                id, report_key, version_no, original_filename, uploaded_at, notes, region_id, country_id, model_id, company_id, report_year, report_month,
                row_number() over (partition by report_key order by version_no desc, uploaded_at desc) as rn
              from uploads
              where {where_clause}
            ) t
            where rn = 1
            order by uploaded_at desc
            """
        else:
            sql = f"""
            select {cols}
            from uploads
            where {where_clause}
            order by uploaded_at desc
            """
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    # Postgres / Supabase
    cols = "id, report_key, version_no, original_filename, uploaded_at, notes, region_id, country_id, model_id, company_id, report_year, report_month"
    pg_wheres = []
    if report_key is not None:
        pg_wheres.append("(report_key = %(report_key)s)")
    if region_id:
        pg_wheres.append("region_id = %(region_id)s")
    if country_id:
        pg_wheres.append("country_id = %(country_id)s")
    if model_id:
        pg_wheres.append("model_id = %(model_id)s")
    if company_id:
        pg_wheres.append("company_id = %(company_id)s")
    if report_year is not None:
        pg_wheres.append("report_year = %(report_year)s")
    if report_month is not None:
        pg_wheres.append("report_month = %(report_month)s")
    if year_from is not None:
        pg_wheres.append("report_year >= %(year_from)s")
    if year_to is not None:
        pg_wheres.append("report_year <= %(year_to)s")
    if quarter is not None and 1 <= quarter <= 4:
        m_from = (quarter - 1) * 3 + 1
        m_to = quarter * 3
        params["quarter_m_from"] = m_from
        params["quarter_m_to"] = m_to
        pg_wheres.append("(report_month >= %(quarter_m_from)s and report_month <= %(quarter_m_to)s)")
    if date_from:
        try:
            parts = date_from.split("-")
            if len(parts) >= 2:
                yf, mf = int(parts[0]), int(parts[1])
                params["date_from_y"] = yf
                params["date_from_m"] = mf
                pg_wheres.append("(report_year > %(date_from_y)s or (report_year = %(date_from_y)s and report_month >= %(date_from_m)s))")
        except (ValueError, IndexError):
            pass
    if date_to:
        try:
            parts = date_to.split("-")
            if len(parts) >= 2:
                yt, mt = int(parts[0]), int(parts[1])
                params["date_to_y"] = yt
                params["date_to_m"] = mt
                pg_wheres.append("(report_year < %(date_to_y)s or (report_year = %(date_to_y)s and report_month <= %(date_to_m)s))")
        except (ValueError, IndexError):
            pass
    pg_where_clause = " and ".join(pg_wheres) if pg_wheres else "true"

    with conn.cursor() as cur:
        if latest_only:
            sql = f"""
            select distinct on (report_key) {cols}
            from public.uploads
            where {pg_where_clause}
            order by report_key, version_no desc, uploaded_at desc
            """
        else:
            sql = f"""
            select {cols}
            from public.uploads
            where {pg_where_clause}
            order by uploaded_at desc
            """
        cur.execute(sql, params)
        return list(cur.fetchall())


def list_report_nodes(
    conn: Any,
    upload_id: str | None = None,
    report_key: str | None = None,
    limit: int = 5000,
) -> list[dict]:
    """
    List report nodes joined with upload info. Used for Reports tabular view.
    """
    if isinstance(conn, sqlite3.Connection):
        sql = """
        select
          rn.id, rn.upload_id, rn.code, rn.level, rn.parent_code, rn.description, rn.value,
          rn.sheet_name, rn.cell_ref, rn.created_at,
          u.report_key, u.version_no, u.original_filename, u.uploaded_at,
          c.name as company_name
        from report_nodes rn
        join uploads u on u.id = rn.upload_id
        left join companies c on c.id = u.company_id
        where (:upload_id is null or rn.upload_id = :upload_id)
          and (:report_key is null or u.report_key = :report_key)
        order by u.uploaded_at desc, rn.level, rn.code
        limit :limit
        """
        cur = conn.execute(sql, {
            "upload_id": upload_id,
            "report_key": report_key,
            "limit": limit,
        })
        return [dict(r) for r in cur.fetchall()]

    # Postgres: build WHERE dynamically to avoid "could not determine data type of parameter"
    # when passing NULL for optional filters (psycopg can't infer type of NULL)
    wheres: list[str] = []
    params: dict[str, Any] = {"limit": limit}
    if upload_id is not None:
        wheres.append("rn.upload_id = %(upload_id)s::uuid")
        params["upload_id"] = upload_id
    if report_key is not None:
        wheres.append("u.report_key = %(report_key)s")
        params["report_key"] = report_key
    where_clause = " and ".join(wheres) if wheres else "true"

    sql = f"""
    select
      rn.id, rn.upload_id, rn.code, rn.level, rn.parent_code, rn.description, rn.value,
      rn.sheet_name, rn.cell_ref, rn.created_at,
      u.report_key, u.version_no, u.original_filename, u.uploaded_at,
      c.name as company_name
    from public.report_nodes rn
    join public.uploads u on u.id = rn.upload_id
    left join public.companies c on c.id = u.company_id
    where {where_clause}
    order by u.uploaded_at desc, rn.level, rn.code
    limit %(limit)s
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def get_values_by_year(
    conn: Any,
    report_key: str | None = None,
    company_id: str | None = None,
    node_code: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    report_month: int | None = None,
    quarter: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """
    Get values by report_year for charting. One value per year from latest upload.
    date_from/date_to: YYYY-MM-DD filter by report period. Overrides year_from/year_to when provided.
    Returns: [{"year": int, "value": float, "label": str, "upload_id": str}, ...]
    """
    uploads = list_uploads(
        conn,
        report_key=report_key,
        company_id=company_id,
        latest_only=False,
        report_year=None,
        report_month=report_month,
        year_from=year_from,
        year_to=year_to,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
    )
    # Filter to uploads with report_year
    uploads = [u for u in uploads if u.get("report_year") is not None]
    # Group by year, keep latest per year (by version_no desc, uploaded_at desc)
    by_year: dict[int, dict] = {}
    for u in uploads:
        yr = int(u["report_year"])
        if yr not in by_year or (
            u.get("version_no", 0) > by_year[yr].get("version_no", 0)
            or (
                u.get("version_no") == by_year[yr].get("version_no")
                and (u.get("uploaded_at") or "") > (by_year[yr].get("uploaded_at") or "")
            )
        ):
            by_year[yr] = u

    result: list[dict] = []
    node_code_lower = (node_code or "").strip().lower()

    for year in sorted(by_year.keys()):
        u = by_year[year]
        upload_id = u.get("id")
        try:
            nodes = get_report_nodes(conn, str(upload_id))
        except (TypeError, ValueError):
            nodes = []

        def _parse_value(v: Any) -> float | None:
            if v is None:
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        def _matches(n: dict) -> bool:
            if not node_code_lower:
                return _parse_value(n.get("value")) is not None
            code = (n.get("code") or "").lower()
            desc = (n.get("description") or "").lower()
            return node_code_lower in code or node_code_lower in desc

        value = None
        label = ""
        for n in nodes:
            if _matches(n):
                v = _parse_value(n.get("value"))
                if v is not None:
                    value = v
                    label = n.get("description") or n.get("code") or ""
                    break

        if value is not None:
            result.append({"year": year, "value": value, "label": label, "upload_id": str(upload_id)})

    return sorted(result, key=lambda x: x["year"])


def get_values_table(
    conn: Any,
    report_key: str | None = None,
    company_id: str | None = None,
    node_code: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    report_month: int | None = None,
    quarter: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """
    Get values as table: rows = metric names, columns = years.
    date_from/date_to: YYYY-MM-DD filter by report period.
    Returns: {"years": [2020, 2021, ...], "rows": [{"name": str, "code": str, "values": {year: value}}, ...]}
    """
    uploads = list_uploads(
        conn,
        report_key=report_key,
        company_id=company_id,
        latest_only=False,
        report_year=None,
        report_month=report_month,
        year_from=year_from,
        year_to=year_to,
        quarter=quarter,
        date_from=date_from,
        date_to=date_to,
    )
    uploads = [u for u in uploads if u.get("report_year") is not None]
    by_year: dict[int, dict] = {}
    for u in uploads:
        yr = int(u["report_year"])
        if yr not in by_year or (
            u.get("version_no", 0) > by_year[yr].get("version_no", 0)
            or (
                u.get("version_no") == by_year[yr].get("version_no")
                and (u.get("uploaded_at") or "") > (by_year[yr].get("uploaded_at") or "")
            )
        ):
            by_year[yr] = u

    years = sorted(by_year.keys())
    node_code_lower = (node_code or "").strip().lower()

    # rows: code -> {name, values: {year: value}}
    rows: dict[str, dict] = {}

    def _parse_value(v: Any) -> float | None:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    for year in years:
        u = by_year[year]
        upload_id = u.get("id")
        try:
            nodes = get_report_nodes(conn, str(upload_id))
        except (TypeError, ValueError):
            nodes = []
        code_to_desc = {n.get("code") or "": (n.get("description") or n.get("code") or "") for n in nodes}
        for n in nodes:
            v = _parse_value(n.get("value"))
            if v is None:
                continue
            code = n.get("code") or ""
            desc = n.get("description") or code
            if node_code_lower:
                if node_code_lower not in (code or "").lower() and node_code_lower not in (desc or "").lower():
                    continue
            if code not in rows:
                lvl = n.get("level")
                parent_code = n.get("parent_code") or ""
                parent_name = code_to_desc.get(parent_code, "")
                rows[code] = {"name": desc or code, "code": code, "level": lvl if lvl is not None else 0, "parent_name": parent_name, "values": {}}
            rows[code]["values"][year] = v

    return {
        "years": years,
        "rows": [{"name": r["name"], "code": r["code"], "level": r["level"], "parent_name": r["parent_name"], "values": r["values"]} for r in rows.values()],
    }


def get_report_nodes(conn: Any, upload_id: str) -> list[dict]:
    if isinstance(conn, sqlite3.Connection):
        sql = """
        select
          id, upload_id, code, level, parent_code, description, value, sheet_name, cell_ref, created_at
        from report_nodes
        where upload_id = :upload_id
        """
        cur = conn.execute(sql, {"upload_id": upload_id})
        return [dict(r) for r in cur.fetchall()]

    sql = """
    select
      id, upload_id, code, level, parent_code, description, value, sheet_name, cell_ref, created_at
    from public.report_nodes
    where upload_id = %(upload_id)s
    """
    with conn.cursor() as cur:
        cur.execute(sql, {"upload_id": upload_id})  # pass UUID directly for Postgres
        return list(cur.fetchall())


def create_upload_with_nodes(
    conn: Any,
    report_key: str,
    original_filename: str,
    notes: str | None,
    nodes: list[dict],
    mapping_id: str | None = None,
    region_id: str | None = None,
    country_id: str | None = None,
    model_id: str | None = None,
    company_id: str | None = None,
    report_year: int | None = None,
    report_month: int | None = None,
    applicable_region_ids: list[str] | None = None,
) -> dict:
    """
    Creates an upload (with version auto-increment per report_key) and inserts report_nodes.
    All operations are executed in a single transaction.

    nodes: list of dicts containing:
      code, level, parent_code, description, value, sheet_name, cell_ref
    """
    db_type = "sqlite" if isinstance(conn, sqlite3.Connection) else "postgres"
    logger.info(
        "create_upload_with_nodes: db=%s nodes=%d applicable_regions=%s",
        db_type,
        len(nodes),
        len(applicable_region_ids or []),
    )
    if isinstance(conn, sqlite3.Connection):
        now = datetime.now(timezone.utc).isoformat()
        upload_id = str(uuid4())
        with conn:
            cur = conn.execute(
                "select coalesce(max(version_no), 0) + 1 as next_version from uploads where report_key = :report_key",
                {"report_key": report_key},
            )
            row = cur.fetchone()
            next_version = int(row["next_version"] if row else 1)

            conn.execute(
                """
                insert into uploads (id, report_key, version_no, original_filename, uploaded_at, notes, mapping_config_id, region_id, country_id, model_id, company_id, report_year, report_month)
                values (:id, :report_key, :version_no, :original_filename, :uploaded_at, :notes, :mapping_config_id, :region_id, :country_id, :model_id, :company_id, :report_year, :report_month)
                """,
                {
                    "id": upload_id,
                    "report_key": report_key,
                    "version_no": next_version,
                    "original_filename": original_filename,
                    "uploaded_at": now,
                    "notes": notes,
                    "mapping_config_id": mapping_id,
                    "region_id": region_id,
                    "country_id": country_id,
                    "model_id": model_id,
                    "company_id": company_id,
                    "report_year": report_year,
                    "report_month": report_month,
                },
            )

            if applicable_region_ids:
                for rid in applicable_region_ids:
                    conn.execute(
                        "insert into report_region_applicability (id, upload_id, region_id) values (?, ?, ?)",
                        (str(uuid4()), upload_id, rid),
                    )

            if nodes:
                def _prepare_node(n: dict) -> dict:
                    out = {**n, "value": _cap_value(n.get("value"))}
                    out["sheet_name"] = n.get("sheet_name") or ""
                    out["cell_ref"] = n.get("cell_ref") or ""
                    out["level"] = n.get("level") if n.get("level") is not None else 0
                    return out

                conn.executemany(
                    """
                    insert into report_nodes (
                      id, upload_id, code, level, parent_code, description, value, sheet_name, cell_ref, created_at
                    ) values (
                      :id, :upload_id, :code, :level, :parent_code, :description, :value, :sheet_name, :cell_ref, :created_at
                    )
                    """,
                    [
                        {
                            "id": str(uuid4()),
                            "upload_id": upload_id,
                            "created_at": now,
                            **_prepare_node(n),
                        }
                        for n in nodes
                    ],
                )

        return {
            "id": upload_id,
            "report_key": report_key,
            "version_no": next_version,
            "original_filename": original_filename,
            "uploaded_at": now,
            "notes": notes,
            "region_id": region_id,
            "country_id": country_id,
            "model_id": model_id,
            "company_id": company_id,
            "report_year": report_year,
            "report_month": report_month,
        }

    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(
                """
                select coalesce(max(version_no), 0) + 1 as next_version
                from public.uploads
                where report_key = %(report_key)s
                """,
                {"report_key": report_key},
            )
            next_version = int(cur.fetchone()["next_version"])

            cur.execute(
                """
                insert into public.uploads (report_key, version_no, original_filename, notes, mapping_config_id, region_id, country_id, model_id, company_id, report_year, report_month)
                values (%(report_key)s, %(version_no)s, %(original_filename)s, %(notes)s, %(mapping_config_id)s, %(region_id)s, %(country_id)s, %(model_id)s, %(company_id)s, %(report_year)s, %(report_month)s)
                returning id, report_key, version_no, original_filename, uploaded_at, notes, region_id, country_id, model_id, company_id, report_year, report_month
                """,
                {
                    "report_key": report_key,
                    "version_no": next_version,
                    "original_filename": original_filename,
                    "notes": notes,
                    "mapping_config_id": mapping_id,
                    "region_id": region_id,
                    "country_id": country_id,
                    "model_id": model_id,
                    "company_id": company_id,
                    "report_year": report_year,
                    "report_month": report_month,
                },
            )
            upload = cur.fetchone()
            upload_id = upload["id"]

            if applicable_region_ids:
                try:
                    for rid in applicable_region_ids:
                        cur.execute(
                            """
                            insert into public.report_region_applicability (upload_id, region_id)
                            values (%(upload_id)s, %(region_id)s)
                            """,
                            {"upload_id": upload_id, "region_id": rid},
                        )
                    logger.info("create_upload_with_nodes: inserted %d report_region_applicability rows", len(applicable_region_ids))
                except Exception as e:
                    logger.exception("create_upload_with_nodes: report_region_applicability insert failed: %s", e)
                    raise

            if nodes:
                def _prepare_node(n: dict) -> dict:
                    out = {**n, "value": _cap_value(n.get("value"))}
                    # Ensure NOT NULL columns have values (schema requires sheet_name, cell_ref)
                    out["sheet_name"] = n.get("sheet_name") or ""
                    out["cell_ref"] = n.get("cell_ref") or ""
                    # level is NOT NULL; default to 0 if missing
                    out["level"] = n.get("level") if n.get("level") is not None else 0
                    return out

                try:
                    cur.executemany(
                        """
                        insert into public.report_nodes (
                          upload_id, code, level, parent_code, description, value, sheet_name, cell_ref
                        ) values (
                          %(upload_id)s, %(code)s, %(level)s, %(parent_code)s, %(description)s, %(value)s, %(sheet_name)s, %(cell_ref)s
                        )
                        """,
                        [{"upload_id": upload_id, **_prepare_node(n)} for n in nodes],
                    )
                    logger.info("create_upload_with_nodes: inserted %d report_nodes for upload %s", len(nodes), upload_id)
                except Exception as e:
                    logger.exception("create_upload_with_nodes: report_nodes insert failed: %s", e)
                    raise

    # CRITICAL: Connection may already have had an active transaction from get_active_mapping_items()
    # (SELECT). In that case conn.transaction() only created a SAVEPOINT, so exiting the block did
    # NOT commit. We must explicitly commit to persist uploads, report_nodes, report_region_applicability.
    conn.commit()
    return upload

