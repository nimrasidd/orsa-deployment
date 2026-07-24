import * as React from "react";
import type { MappingItemOut } from "../types";

export type MappingTreeNode = {
  item: MappingItemOut;
  children: MappingTreeNode[];
};

function inferParentCode(code: string): string | null {
  const lastDot = code.lastIndexOf(".");
  return lastDot > 0 ? code.slice(0, lastDot) : null;
}

export function buildMappingTree(items: MappingItemOut[]): MappingTreeNode[] {
  if (!items.length) return [];
  const byCode = new Map<string, MappingItemOut>();
  for (const it of items) {
    byCode.set(it.code, it);
  }
  const getParent = (it: MappingItemOut): string | null =>
    it.parent_code?.trim() || inferParentCode(it.code);

  const buildNode = (item: MappingItemOut): MappingTreeNode => {
    const children = items
      .filter((c) => getParent(c) === item.code)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map((c) => buildNode(c));
    return { item, children };
  };

  const roots = items.filter((it) => {
    const parent = getParent(it);
    return !parent || !byCode.has(parent);
  });
  roots.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return roots.map((r) => buildNode(r));
}

// Layout: left-to-right (root on left, children to the right)
const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;
const H_GAP = 36;
const V_GAP = 20;
const PAD = 30;

type LayoutNode = {
  node: MappingTreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  subtreeHeight: number;
  children: LayoutNode[];
};

function computeLayout(
  node: MappingTreeNode,
  depth: number,
  yStart: number,
  expanded: Set<string>
): { layout: LayoutNode; totalHeight: number } {
  const showChildren = expanded.has(node.item.code) && node.children.length > 0;

  if (!showChildren) {
    const layout: LayoutNode = {
      node,
      x: depth * (NODE_WIDTH + H_GAP),
      y: yStart,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      subtreeHeight: NODE_HEIGHT,
      children: []
    };
    return { layout, totalHeight: NODE_HEIGHT };
  }

  let y = yStart;
  const layoutChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const { layout, totalHeight } = computeLayout(child, depth + 1, y, expanded);
    layoutChildren.push(layout);
    y += totalHeight + V_GAP;
  }
  const subtreeHeight = y - yStart - V_GAP;
  const nodeY = yStart + (subtreeHeight - NODE_HEIGHT) / 2;

  const layout: LayoutNode = {
    node,
    x: depth * (NODE_WIDTH + H_GAP),
    y: nodeY,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    subtreeHeight,
    children: layoutChildren
  };
  return { layout, totalHeight: subtreeHeight };
}

type Props = {
  roots: MappingTreeNode[];
  /** Optional: controlled expanded state. If not provided, uses internal state. */
  expanded?: Set<string>;
  onExpandedChange?: (expanded: Set<string>) => void;
  /** Optional: called when a leaf/subnode is clicked. Parent nodes still toggle expand/collapse. */
  onSelect?: (item: MappingItemOut) => void;
};

export function MappingTreeDiagram({ roots, expanded: controlledExpanded, onExpandedChange, onSelect }: Props) {
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(() => new Set());
  const expanded = controlledExpanded ?? internalExpanded;

  const setExpanded = React.useCallback(
    (next: Set<string>) => {
      if (onExpandedChange) onExpandedChange(next);
      else setInternalExpanded(next);
    },
    [onExpandedChange]
  );

  const toggleExpanded = React.useCallback(
    (code: string) => {
      const next = new Set(expanded);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      setExpanded(next);
    },
    [expanded, setExpanded]
  );

  if (roots.length === 0) return null;

  const { layouts, svgWidth, svgHeight } = React.useMemo(() => {
    let yOffset = 0;
    const layouts: { layout: LayoutNode }[] = [];
    for (const node of roots) {
      const { layout, totalHeight } = computeLayout(node, 0, yOffset, expanded);
      layouts.push({ layout });
      yOffset += totalHeight + V_GAP;
    }
    const totalHeight = Math.max(300, yOffset - V_GAP + PAD * 2);
    let maxDepth = 0;
    function walk(n: MappingTreeNode, d: number, exp: Set<string>) {
      maxDepth = Math.max(maxDepth, d);
      if (exp.has(n.item.code)) {
        for (const c of n.children) walk(c, d + 1, exp);
      }
    }
    for (const r of roots) walk(r, 0, expanded);
    const width = Math.max(500, (maxDepth + 1) * (NODE_WIDTH + H_GAP) + PAD * 2);
    return { layouts, svgWidth: width, svgHeight: totalHeight };
  }, [roots, expanded]);

  return (
    <div className="flex h-full min-h-[min(250px,35vh)] w-full flex-col overflow-auto rounded-lg border border-line bg-surface-panel/60 p-4">
      <div className="mb-2 shrink-0 text-xs text-ink-muted">
        Click nodes to expand/collapse. Subnodes are also clickable.
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMinYMin meet"
          className="min-w-max"
        >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>
        <g transform={`translate(${PAD}, ${PAD})`}>
          {layouts.map(({ layout }, rootIdx) => (
            <DiagramGroup
              key={rootIdx}
              layout={layout}
              parentRightX={null}
              parentCy={null}
              expanded={expanded}
              onToggle={toggleExpanded}
              onSelect={onSelect}
            />
          ))}
        </g>
        </svg>
      </div>
    </div>
  );
}

function DiagramGroup({
  layout,
  parentRightX,
  parentCy,
  expanded,
  onToggle,
  onSelect
}: {
  layout: LayoutNode;
  parentRightX: number | null;
  parentCy: number | null;
  expanded: Set<string>;
  onToggle: (code: string) => void;
  onSelect?: (item: MappingItemOut) => void;
}) {
  const { node, x, y, width, height, children } = layout;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.item.code);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (hasChildren) {
        onToggle(node.item.code);
      } else if (onSelect) {
        onSelect(node.item);
      }
    },
    [hasChildren, node.item, onToggle, onSelect]
  );

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      {/* Connector line from parent (left) to this node */}
      {parentRightX != null && parentCy != null && (
        <path
          d={`M ${parentRightX} ${parentCy} L ${parentRightX + 12} ${parentCy} L ${parentRightX + 12} ${cy} L ${x} ${cy}`}
          fill="none"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Node box */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        ry="8"
        fill={!parentRightX ? "#0c4a6e" : "#1e293b"}
        stroke={!parentRightX ? "#38bdf8" : "#64748b"}
        strokeWidth="1.5"
      />
      {/* Expand/collapse indicator for nodes with children */}
      {hasChildren && (
        <g transform={`translate(${x + 6}, ${y + 16}) scale(0.8)`}>
          {isExpanded ? (
            <path d="M1 4 L5 8 L9 4" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 1 L8 5 L4 9" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </g>
      )}
      {/* Node label - centered in box (offset right if has expand icon) */}
      <text
        x={cx}
        y={y + 22}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="12"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {(() => {
          const s = node.item.description ?? node.item.code;
          return s && s.length > 20 ? s.slice(0, 19) + "…" : s;
        })()}
      </text>
      {(node.item.sheet_name || node.item.cell_ref) && (
        <text
          x={cx}
          y={y + 40}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
          style={{ pointerEvents: "none" }}
        >
          {[node.item.sheet_name, node.item.cell_ref].filter(Boolean).join(" → ")}
        </text>
      )}
      {/* Children (only rendered when expanded) */}
      {children.map((child) => (
        <DiagramGroup
          key={child.node.item.id}
          layout={child}
          parentRightX={x + width}
          parentCy={cy}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
}
