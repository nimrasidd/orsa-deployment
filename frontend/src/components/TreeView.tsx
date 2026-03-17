import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatValueToSigFigs } from "../lib/format";
import type { TreeNode } from "../types";
import { cn } from "../lib/cn";

type Props = {
  roots: TreeNode[];
  search: string;
  expanded: Set<string>;
  onToggle: (code: string) => void;
  selectedCode?: string;
  onSelect: (node: TreeNode) => void;
};

function nodeMatches(node: TreeNode, q: string) {
  if (!q) return true;
  const hay = `${node.code} ${node.description ?? ""}`.toLowerCase();
  return hay.includes(q);
}

function shouldShow(node: TreeNode, q: string): boolean {
  if (!q) return true;
  if (nodeMatches(node, q)) return true;
  return node.children.some((c) => shouldShow(c, q));
}

function renderNode(
  node: TreeNode,
  depth: number,
  props: Omit<Props, "roots" | "search"> & { q: string }
) {
  const { q, expanded, onToggle, onSelect, selectedCode } = props;
  if (!shouldShow(node, q)) return null;

  const hasKids = node.children.length > 0;
  const isOpen = expanded.has(node.code);
  const isSelected = selectedCode === node.code;

  return (
    <div key={node.id}>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-transparent transition hover:bg-white/5",
          isSelected && "bg-sky-500/15 ring-sky-400/25"
        )}
        style={{ marginLeft: depth * 14 }}
        onClick={() => onSelect(node)}
      >
        <button
          type="button"
          className={cn(
            "grid h-6 w-6 place-items-center rounded-lg text-slate-300 hover:bg-white/5",
            !hasKids && "opacity-0 pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) onToggle(node.code);
          }}
          aria-label={hasKids ? (isOpen ? "Collapse" : "Expand") : undefined}
        >
          {hasKids ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-100">{node.code}</span>
            {node.value != null && node.value !== "" ? (
              <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-slate-200 ring-1 ring-white/10">
                {formatValueToSigFigs(node.value)}
              </span>
            ) : null}
          </div>
          {node.description ? (
            <div className="mt-0.5 truncate text-xs text-slate-400">{node.description}</div>
          ) : null}
        </div>
      </div>

      {hasKids && isOpen ? (
        <div className="mt-1 space-y-1">
          {node.children.map((c) =>
            renderNode(c, depth + 1, {
              q,
              expanded,
              onToggle,
              onSelect,
              selectedCode
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TreeView({ roots, search, expanded, onToggle, selectedCode, onSelect }: Props) {
  const q = search.trim().toLowerCase();
  return (
    <div className="space-y-1">
      {roots.map((r) =>
        renderNode(r, 0, {
          q,
          expanded,
          onToggle,
          onSelect,
          selectedCode
        })
      )}
    </div>
  );
}

