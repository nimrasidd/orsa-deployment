from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from ..db import get_db
from ..schemas import ReportNodeOut, TreeNode
from ..services.report_queries import get_report_nodes

router = APIRouter(prefix="/uploads", tags=["reports"])


@router.get("/{upload_id}/debug")
def upload_debug(
    upload_id: str,
    db: Annotated[Any, Depends(get_db)],
):
    """Debug: return upload info and node count for troubleshooting."""
    nodes = get_report_nodes(db, upload_id)
    return {
        "upload_id": upload_id,
        "node_count": len(nodes),
        "has_nodes": len(nodes) > 0,
    }


def _code_sort_key(code: str) -> tuple:
    parts = [p for p in code.split(".") if p != ""]
    key: list[tuple[int, object]] = []
    for p in parts:
        try:
            key.append((0, int(p)))
        except ValueError:
            key.append((1, p))
    return tuple(key)


@router.get("/{upload_id}/nodes", response_model=list[ReportNodeOut])
def list_nodes(
    upload_id: str,
    db: Annotated[Any, Depends(get_db)],
):
    nodes = get_report_nodes(db, upload_id)
    nodes.sort(key=lambda n: _code_sort_key(n["code"]))
    return nodes


@router.get("/{upload_id}/tree", response_model=list[TreeNode])
def get_tree(
    upload_id: str,
    db: Annotated[Any, Depends(get_db)],
):
    nodes = get_report_nodes(db, upload_id)
    by_code: dict[str, dict] = {n["code"]: n for n in nodes}
    children_map: dict[str, list[dict]] = {n["code"]: [] for n in nodes}

    roots: list[dict] = []
    for n in nodes:
        parent_code = n.get("parent_code")
        if parent_code and parent_code in children_map:
            children_map[parent_code].append(n)
        else:
            roots.append(n)

    for code, kids in children_map.items():
        kids.sort(key=lambda x: _code_sort_key(x["code"]))

    roots.sort(key=lambda x: _code_sort_key(x["code"]))

    def to_tree(node: dict) -> dict:
        code = node["code"]
        return {
            "id": node["id"],
            "code": code,
            "description": node.get("description"),
            "value": node.get("value"),
            "sheet_name": node["sheet_name"],
            "cell_ref": node["cell_ref"],
            "level": node["level"],
            "children": [to_tree(child) for child in children_map.get(code, [])],
        }

    return [to_tree(r) for r in roots]

