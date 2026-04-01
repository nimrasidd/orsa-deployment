import { Button } from "./Button";

type Props = {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  canExpand?: boolean;
  className?: string;
};

export function HierarchyExpandControls({
  onExpandAll,
  onCollapseAll,
  canExpand = true,
  className
}: Props) {
  if (!canExpand) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onExpandAll}>
          Expand all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCollapseAll}>
          Collapse all
        </Button>
      </div>
    </div>
  );
}
