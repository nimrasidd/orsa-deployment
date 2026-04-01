/** Rows that can be arranged as a tree using `code` + optional `parent_code`. */
export type HierarchyLink = { code: string; parent_code?: string | null };

export function buildChildrenMap<T extends HierarchyLink>(rows: T[]) {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const children = new Map<string | null, T[]>();
  for (const r of rows) {
    let p: string | null =
      r.parent_code != null && String(r.parent_code).trim() !== "" ? String(r.parent_code).trim() : null;
    if (p && !byCode.has(p)) p = null;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(r);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  const roots = children.get(null) ?? [];
  const codesWithChildren = new Set<string>();
  for (const r of rows) {
    if ((children.get(r.code)?.length ?? 0) > 0) codesWithChildren.add(r.code);
  }
  return { children, roots, byCode, codesWithChildren };
}

export function collectAncestorCodes<T extends HierarchyLink>(
  rowsByCode: Map<string, T>,
  leafCodes: Iterable<string>
): Set<string> {
  const ancestors = new Set<string>();
  for (const start of leafCodes) {
    let cur = rowsByCode.get(start);
    while (cur) {
      const raw = cur.parent_code;
      if (raw == null || String(raw).trim() === "") break;
      const p = String(raw).trim();
      const par = rowsByCode.get(p);
      if (!par) break;
      ancestors.add(par.code);
      cur = par;
    }
  }
  return ancestors;
}

export function flattenVisibleHierarchy<T extends HierarchyLink>(
  roots: T[],
  children: Map<string | null, T[]>,
  expanded: Set<string>,
  onlyCodes?: Set<string>
): Array<{ row: T; depth: number }> {
  const out: Array<{ row: T; depth: number }> = [];
  const visit = (row: T, depth: number) => {
    if (onlyCodes && !onlyCodes.has(row.code)) return;
    out.push({ row, depth });
    const kids = children.get(row.code);
    if (!kids?.length) return;
    if (!expanded.has(row.code)) return;
    for (const k of kids) visit(k, depth + 1);
  };
  for (const r of roots) visit(r, 0);
  return out;
}

export type HierarchyTableView<T extends HierarchyLink> = {
  flat: Array<{ row: T; depth: number }>;
  expandedForWalk: Set<string>;
  codesWithChildren: Set<string>;
};

/**
 * @param allRows Full set (defines tree shape).
 * @param filteredRows Rows matching active filters; when `hasRowFilter`, paths to these rows are expanded and ancestors included.
 */
export function computeHierarchyTableView<T extends HierarchyLink>(
  allRows: T[],
  filteredRows: T[],
  expanded: Set<string>,
  hasRowFilter: boolean
): HierarchyTableView<T> {
  if (allRows.length === 0) {
    return { flat: [], expandedForWalk: new Set(), codesWithChildren: new Set() };
  }
  const { children, roots, byCode, codesWithChildren } = buildChildrenMap(allRows);
  let expandedForWalk: Set<string> = expanded;
  let onlyCodes: Set<string> | undefined;
  if (hasRowFilter) {
    const matchCodes = new Set(filteredRows.map((r) => r.code));
    const showCodes = new Set(matchCodes);
    for (const c of matchCodes) {
      let cur = byCode.get(c);
      while (cur) {
        const raw = cur.parent_code;
        if (raw == null || String(raw).trim() === "") break;
        const p = String(raw).trim();
        const par = byCode.get(p);
        if (!par) break;
        showCodes.add(par.code);
        cur = par;
      }
    }
    onlyCodes = showCodes;
    const ancestors = collectAncestorCodes(byCode, matchCodes);
    expandedForWalk = new Set([...expanded, ...ancestors]);
  }
  const flat = flattenVisibleHierarchy(roots, children, expandedForWalk, onlyCodes);
  return { flat, expandedForWalk, codesWithChildren };
}

/** When API rows omit `parent_code`, infer parent from dotted codes (e.g. 1.2.3 → 1.2). */
export function inferParentCodeFromDottedPath(code: string, allCodes: Set<string>): string | null {
  if (!code.includes(".")) return null;
  let end = code.length;
  while (true) {
    const dot = code.lastIndexOf(".", end - 1);
    if (dot <= 0) return null;
    const cand = code.slice(0, dot);
    if (allCodes.has(cand)) return cand;
    end = dot;
  }
}

export function withInferredDottedParents<T extends { code: string }>(
  rows: T[]
): Array<T & { parent_code: string | null }> {
  const set = new Set(rows.map((r) => r.code));
  return rows.map((r) => ({
    ...r,
    parent_code: inferParentCodeFromDottedPath(r.code, set)
  }));
}
