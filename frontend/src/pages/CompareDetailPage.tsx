import * as React from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { SplitView } from "../components/SplitView";
import { ReportDetailPanel } from "../components/ReportDetailPanel";
import { Button } from "../components/Button";
import { ArrowLeft } from "lucide-react";

export function CompareDetailPage() {
  const { leftId, rightId } = useParams<{ leftId: string; rightId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { leftTitle?: string; rightTitle?: string } | null;
  const leftTitle = state?.leftTitle ?? (leftId ? `Left (${leftId.slice(0, 8)}…)` : "Left");
  const rightTitle = state?.rightTitle ?? (rightId ? `Right (${rightId.slice(0, 8)}…)` : "Right");

  if (!leftId || !rightId) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        <p>Missing report IDs. Go to Models → Compare and select two reports, then click &quot;Open side by side&quot;.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/models", { state: { tab: "compare" } })}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Compare
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Compare side by side</div>
          <div className="mt-1 text-xs text-slate-400">
            Left and right reports displayed in split view. Switch between Tree, Nodes, and Diagram per panel.
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate("/models", { state: { tab: "compare" } })}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Compare
        </Button>
      </div>
      <SplitView
        left={<ReportDetailPanel uploadId={leftId} title={leftTitle} />}
        right={<ReportDetailPanel uploadId={rightId} title={rightTitle} />}
        initialLeftPx={480}
        minLeftPx={320}
        minRightPx={320}
      />
    </>
  );
}
