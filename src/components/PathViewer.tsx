"use client";

import { cx } from "@/lib/cx";
import { eventNode, pathStepsForTimeline } from "@/lib/graph";
import { PATH_COLORS } from "@/lib/paths";
import { EXPECTED_PATH_ID } from "@/lib/types";
import type { World } from "@/lib/types";

type Props = {
  world: World;
  pathIds: string[];
  activePathId: string | null;
  hoverPathId: string | null;
  onHover: (pathId: string | null) => void;
  onSelect: (pathId: string) => void;
};

export function PathViewer({ world, pathIds, activePathId, hoverPathId, onHover, onSelect }: Props) {
  const timelinePaths = pathIds.filter((id) => id !== EXPECTED_PATH_ID);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Path routes</div>
      {timelinePaths.length === 0 ? (
        <p className="text-[12px] text-muted">Pin paths in Worlds to compare routes here.</p>
      ) : (
        timelinePaths.map((pathId, i) => {
          const steps = pathStepsForTimeline(world, pathId);
          if (!steps) return null;
          const color = PATH_COLORS[i % PATH_COLORS.length];
          const lit = hoverPathId === pathId || activePathId === pathId;
          return (
            <button
              key={pathId}
              type="button"
              onMouseEnter={() => onHover(pathId)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(pathId)}
              className={cx(
                "w-full rounded-xl border p-2.5 text-left transition-opacity",
                lit ? "opacity-100" : "opacity-55 hover:opacity-80",
              )}
              style={{ borderColor: `${color}${lit ? "aa" : "55"}` }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium" style={{ color }}>
                  {steps.label}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {Math.round(steps.probability * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {steps.nodeIds.map((nodeId, j) => {
                  const node = eventNode(world, nodeId);
                  if (!node) return null;
                  const short =
                    node.title.length > 22 ? `${node.title.slice(0, 19)}…` : node.title;
                  return (
                    <span key={nodeId} className="flex items-center gap-1">
                      {j > 0 && <span className="text-[10px] text-muted">→</span>}
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px]"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {short}
                      </span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })
      )}
      {pathIds.includes(EXPECTED_PATH_ID) && (
        <p className="text-[11px] text-muted">
          Expected blends all routes by edge weight — hover a path above to highlight it on the map.
        </p>
      )}
    </div>
  );
}
