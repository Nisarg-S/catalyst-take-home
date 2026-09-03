"use client";

import { useMemo, useRef } from "react";
import { cx } from "@/lib/cx";
import { days, pLabel, pct, pnlTone } from "@/lib/format";
import { eventNodes, nodeTransforms, thesisLabel } from "@/lib/graph";
import { bezier, layoutWorld } from "@/lib/layout";
import { usePanZoom } from "@/lib/usePanZoom";
import type { PathHighlight } from "@/lib/paths";
import type { EvalResult, World } from "@/lib/types";

type Props = {
  world: World;
  evalResult: EvalResult;
  selectedId: string | null;
  pathHighlights?: PathHighlight[];
  onSelect: (id: string | null) => void;
  onWhatIf: (nodeId: string) => void;
  onOpenStrategy: () => void;
};

export function ChainCanvas({
  world,
  evalResult,
  selectedId,
  pathHighlights,
  onSelect,
  onWhatIf,
  onOpenStrategy,
}: Props) {
  const layout = useMemo(() => layoutWorld(world), [world]);
  const events = eventNodes(world);
  const eventById = useMemo(() => new Map(events.map((n) => [n.id, n])), [events]);
  const impactsByFrom = useMemo(() => {
    const m = new Map<string, { symbol: string; assetReturnPct: number }[]>();
    for (const n of events) {
      const transforms = nodeTransforms(world, n.id);
      if (transforms.length) m.set(n.id, transforms);
    }
    return m;
  }, [world, events]);

  const highlightForEdge = (edgeId: string) => {
    if (!pathHighlights?.length) return undefined;
    return (
      pathHighlights.find((h) => h.emphasized && h.edgeIds.has(edgeId)) ??
      pathHighlights.find((h) => h.edgeIds.has(edgeId))
    );
  };

  const highlightForNode = (nodeId: string) => {
    if (!pathHighlights?.length) return undefined;
    return (
      pathHighlights.find((h) => h.emphasized && h.nodeIds.has(nodeId)) ??
      pathHighlights.find((h) => h.nodeIds.has(nodeId))
    );
  };

  const compareMode = Boolean(pathHighlights?.length);
  const dragDistance = useRef(0);
  const { viewportRef, transform, fitToView, zoomIn, zoomOut, mapHandlers } = usePanZoom({
    contentWidth: layout.width,
    contentHeight: layout.height,
    fitKey: `${world.id}:${layout.width}x${layout.height}`,
  });

  const mapHandlersWithClick = {
    ...mapHandlers,
    onPointerMove: (e: React.PointerEvent) => {
      mapHandlers.onPointerMove(e);
      dragDistance.current += Math.abs(e.movementX) + Math.abs(e.movementY);
    },
    onPointerDown: (e: React.PointerEvent) => {
      dragDistance.current = 0;
      mapHandlers.onPointerDown(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      mapHandlers.onPointerUp(e);
      if (dragDistance.current < 6 && !(e.target as HTMLElement).closest("[data-chain-interactive]")) {
        onSelect(null);
      }
    },
  };

  return (
    <div ref={viewportRef} className="chain-map relative h-full min-h-0 w-full touch-none select-none overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between px-3 py-2">
        <span className="rounded-full border border-white/8 bg-[#0b0c11]/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur-sm">
          Drag to pan · scroll to zoom
        </span>
        <div className="pointer-events-auto flex items-center gap-1">
          <MapButton label="−" title="Zoom out" onClick={zoomOut} />
          <MapButton
            label={`${Math.round(transform.scale * 100)}%`}
            title="Fit to view"
            onClick={fitToView}
            wide
          />
          <MapButton label="+" title="Zoom in" onClick={zoomIn} />
        </div>
      </div>

      <div
        className="chain-map-surface absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
        {...mapHandlersWithClick}
      >
        <svg className="absolute inset-0" width={layout.width} height={layout.height} fill="none">
          {layout.edges.map((e) => {
            const impact = e.kind === "impacts";
            const hl = highlightForEdge(e.id);
            const onPath = Boolean(hl);
            const dim = compareMode && !onPath;
            return (
              <g
                key={e.id}
                opacity={
                  dim ? 0.1 : onPath ? (hl?.emphasized ? 1 : 0.5) : e.role === "ghost" ? 0.22 : e.role === "registered" ? 0.7 : 1
                }
              >
                <path
                  d={bezier(e.x1, e.y1, e.x2, e.y2)}
                  stroke={
                    onPath && hl
                      ? hl.color
                      : impact
                        ? "#6aae96"
                        : e.role === "live"
                          ? "#d4a574"
                          : e.role === "registered"
                            ? "#7eb8d8"
                            : "#6b6e76"
                  }
                  strokeWidth={onPath && hl?.emphasized ? 2.8 : e.role === "live" ? 1.8 : 1.3}
                  strokeDasharray={onPath || (e.role === "live" && !impact) ? undefined : "5 5"}
                />
                {(e.label || e.probability !== undefined) && (onPath || e.role === "live") && !impact && (
                  <text
                    x={(e.x1 + e.x2) / 2}
                    y={(e.y1 + e.y2) / 2 - 6}
                    textAnchor="middle"
                    className="fill-[#8b909c]"
                    fontSize="9"
                  >
                    {e.probability !== undefined ? `${Math.round(e.probability * 100)}% · ${e.label ?? ""}`.trim() : e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {layout.nodes.map((ln) => {
          if (ln.kind === "thesis") {
            return (
              <button
                key="thesis"
                type="button"
                data-chain-interactive
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStrategy();
                }}
                style={{ left: ln.x, top: ln.y, width: ln.w, height: ln.h }}
                className="absolute cursor-pointer rounded-2xl border border-emerald-500/25 bg-[#0e1613]/90 p-3.5 text-left shadow-lg shadow-black/30"
              >
                <div className="text-[11px] text-emerald-200/80">Strategy</div>
                <div className="mt-1 line-clamp-3 font-serif text-[14px] leading-snug text-emerald-50">
                  {world.thesis.narrative?.trim() || thesisLabel(world.thesis)}
                </div>
                <div className={cx("mt-2 font-mono text-xl", `tone-${pnlTone(evalResult.pnlPct)}`)}>
                  {world.thesis.legs.length ? pct(evalResult.pnlPct) : "—"}
                </div>
              </button>
            );
          }

          const node = eventById.get(ln.id);
          if (!node) return null;
          const chips = impactsByFrom.get(ln.id) ?? [];
          const hl = highlightForNode(ln.id);
          const onPath = Boolean(hl);
          const dim = compareMode && !onPath;
          return (
            <div
              key={ln.id}
              data-chain-interactive
              style={{
                left: ln.x,
                top: ln.y,
                width: ln.w,
                height: ln.h,
                boxShadow: hl ? `0 0 0 2px ${hl.color}${hl.emphasized ? "cc" : "66"}` : undefined,
              }}
              className={cx(
                "absolute flex cursor-pointer flex-col rounded-2xl border p-3 shadow-lg shadow-black/25 backdrop-blur-sm transition-opacity",
                !compareMode && ln.role === "live" && "border-gold/25 bg-[#141820]/90",
                !compareMode && ln.role === "registered" && "border-sky-400/30 bg-[#10161c]/85",
                !compareMode && ln.role === "ghost" && "border-dashed border-white/12 bg-[#0d0f14]/70 opacity-60",
                compareMode && onPath && "border-white/20 bg-[#141820]/90",
                compareMode && dim && "opacity-20",
                selectedId === ln.id && "ring-1 ring-gold/50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(ln.id);
              }}
            >
              <div className="flex justify-between text-[10px] text-muted">
                <span className={ln.role === "live" ? "text-gold/80" : ln.role === "registered" ? "text-sky-200/80" : ""}>
                  {ln.role === "live" ? "Viewing" : ln.role === "registered" ? "Compared" : "Hidden"}
                </span>
                <span className="font-mono">
                  {pLabel(evalResult.nodeEvals.find((n) => n.nodeId === ln.id)?.reachProbability ?? node.pConditional)} · {days(node.horizonDays)}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 flex-1 font-serif text-[15px] leading-snug">{node.title}</div>
              {chips.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chips.slice(0, 3).map((c) => (
                    <span key={c.symbol} className="font-mono text-[10px] text-muted">
                      {c.symbol} {pct(c.assetReturnPct, 0)}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                data-chain-interactive
                className="mt-2 rounded-md bg-gold/15 px-2 py-1 text-[11px] text-gold hover:bg-gold/25"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ln.id);
                  onWhatIf(ln.id);
                }}
              >
                What if…
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapButton({
  label,
  title,
  onClick,
  wide,
}: {
  label: string;
  title: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        "rounded-md border border-white/12 bg-[#0b0c11]/90 text-[12px] text-foreground backdrop-blur-sm hover:border-gold/30",
        wide ? "min-w-[52px] px-2 py-1 font-mono" : "h-7 w-7",
      )}
    >
      {label}
    </button>
  );
}
