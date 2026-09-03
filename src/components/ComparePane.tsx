"use client";

import { useMemo } from "react";
import { cx } from "@/lib/cx";
import { nwayCompare } from "@/lib/eval";
import { pathStepsForTimeline, registeredIdsOf } from "@/lib/graph";
import { PATH_COLORS, type PathHighlight } from "@/lib/paths";
import { pct, pLabel, pnlTone } from "@/lib/format";
import { EXPECTED_PATH_ID } from "@/lib/types";
import type { EvalResult, World } from "@/lib/types";
import { PathViewer } from "@/components/PathViewer";

type Props = {
  world: World;
  evals: Record<string, EvalResult>;
  busy: boolean;
  hoverPathId: string | null;
  onHoverPath: (pathId: string | null) => void;
  onActivate: (timelineId: string) => void;
  onRegisterAll: () => void;
  onOpenWorlds: () => void;
};

export function buildPathHighlights(world: World, hoverPathId: string | null): PathHighlight[] {
  const ids = [...registeredIdsOf(world)];
  return ids.flatMap((pathId, i) => {
    const steps = pathStepsForTimeline(world, pathId);
    if (!steps) return [];
    const emphasized = hoverPathId === pathId;
    return [
      {
        pathId,
        label: steps.label,
        color: PATH_COLORS[i % PATH_COLORS.length],
        nodeIds: new Set(steps.nodeIds),
        edgeIds: new Set(steps.edgeIds),
        emphasized,
      },
    ];
  });
}

export function ComparePane({
  world,
  evals,
  busy,
  hoverPathId,
  onHoverPath,
  onActivate,
  onRegisterAll,
  onOpenWorlds,
}: Props) {
  const { paths, symbols, spreadPct, bestId, worstId } = nwayCompare(world, evals);
  const pathIds = useMemo(
    () => [EXPECTED_PATH_ID, ...registeredIdsOf(world)],
    [world],
  );

  if (paths.length < 2) {
    return (
      <div className="space-y-3 text-[13px]">
        <p className="text-muted">
          Compare needs two or more paths. Create another path with What if on an event, then add worlds here.
        </p>
        {world.timelines.length >= 2 ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRegisterAll}
            className="rounded-lg bg-sky-400/20 px-3 py-2 text-sky-50"
          >
            Add every world to compare
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenWorlds}
            className="rounded-lg border border-white/15 px-3 py-2"
          >
            Open worlds list
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PathViewer
        world={world}
        pathIds={pathIds}
        activePathId={world.activeTimelineId}
        hoverPathId={hoverPathId}
        onHover={onHoverPath}
        onSelect={onActivate}
      />

      <p className="text-[12px] text-muted">
        Same strategy across expected + pinned paths. Range {pct(spreadPct, 1)}
        {bestId && worstId && bestId !== worstId
          ? ` · best ${paths.find((p) => p.id === bestId)?.label}`
          : ""}
        . Hover a path to highlight it on the map.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead>
            <tr>
              <th className="pb-2 pr-2 font-normal text-muted"> </th>
              {paths.map((p, i) => {
                const color = p.id === EXPECTED_PATH_ID ? "#8ee0b0" : PATH_COLORS[(i - 1) % PATH_COLORS.length];
                return (
                  <th key={p.id} className="pb-2 pr-2 font-normal">
                    <button
                      type="button"
                      onMouseEnter={() => p.id !== EXPECTED_PATH_ID && onHoverPath(p.id)}
                      onMouseLeave={() => onHoverPath(null)}
                      onClick={() => onActivate(p.id)}
                      className={cx("text-left", p.active ? "text-gold" : "")}
                      style={p.id !== EXPECTED_PATH_ID ? { color } : { color: "#8ee0b0" }}
                    >
                      {p.label}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/8">
              <td className="py-1.5 pr-2 text-muted">P&amp;L</td>
              {paths.map((p) => (
                <td key={p.id} className={cx("py-1.5 pr-2 font-mono", `tone-${pnlTone(p.pnlPct)}`)}>
                  {pct(p.pnlPct)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1 pr-2 text-muted">vs viewing</td>
              {paths.map((p) => (
                <td
                  key={p.id}
                  className={cx(
                    "py-1 pr-2 font-mono",
                    p.active ? "text-muted" : `tone-${pnlTone(p.deltaVsActive)}`,
                  )}
                >
                  {p.active ? "—" : pct(p.deltaVsActive)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1 pr-2 text-muted">Path weight</td>
              {paths.map((p) => (
                <td key={p.id} className="py-1 pr-2 font-mono text-muted">
                  {p.pathProbability !== undefined ? pLabel(p.pathProbability) : "—"}
                </td>
              ))}
            </tr>
            {symbols.map((sym) => (
              <tr key={sym}>
                <td className="py-1 pr-2 font-mono text-muted">{sym}</td>
                {paths.map((p) => {
                  const row = p.bySymbol.find((s) => s.symbol === sym);
                  return (
                    <td key={p.id} className="py-1 pr-2 font-mono">
                      {row ? (
                        <span className={cx(`tone-${pnlTone(row.assetReturnPct)}`)}>
                          {pct(row.assetReturnPct, 0)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
