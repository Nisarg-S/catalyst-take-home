"use client";

import { cx } from "@/lib/cx";
import { pct, pnlTone } from "@/lib/format";
import { registeredIdsOf } from "@/lib/graph";
import type { EvalResult, World } from "@/lib/types";

type Props = {
  world: World;
  evals: Record<string, EvalResult>;
  busy: boolean;
  onActivate: (timelineId: string) => void;
  onRegister: (timelineId: string, on: boolean) => void;
  onRegisterAll: () => void;
};

export function WorldsPane({ world, evals, busy, onActivate, onRegister, onRegisterAll }: Props) {
  const pinned = new Set(registeredIdsOf(world));

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy || world.timelines.length < 2}
        onClick={onRegisterAll}
        className="w-full rounded-lg bg-sky-400/15 px-3 py-2 text-[13px] text-sky-50 disabled:opacity-40"
      >
        Add every world to compare
      </button>
      {world.timelines.map((t) => {
        const live = t.id === world.activeTimelineId;
        const inCompare = pinned.has(t.id);
        const ev = evals[t.id];
        return (
          <div key={t.id} className="rounded-xl border border-white/10 p-3">
            <div className="font-medium">{t.label}</div>
            {ev && (
              <div className={cx("font-mono text-sm", `tone-${pnlTone(ev.pnlPct)}`)}>
                {pct(ev.pnlPct)} if this world happens
              </div>
            )}
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                disabled={busy || live}
                onClick={() => onActivate(t.id)}
                className="rounded-md border border-white/12 px-2 py-1.5 text-left text-[13px] disabled:opacity-40"
              >
                {live ? "On the canvas now" : "Show this world on the canvas"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRegister(t.id, !inCompare)}
                className={cx(
                  "rounded-md px-2 py-1.5 text-left text-[13px]",
                  inCompare ? "bg-sky-400/15 text-sky-50" : "border border-sky-400/25 text-sky-100",
                )}
              >
                {inCompare ? "Remove from compare" : "Add to compare"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
