"use client";

import { cx } from "@/lib/cx";
import { pct, pLabel, pnlTone } from "@/lib/format";
import { registeredIdsOf } from "@/lib/graph";
import { EXPECTED_PATH_ID } from "@/lib/types";
import type { EvalResult, World } from "@/lib/types";

type Props = {
  world: World;
  evals: Record<string, EvalResult>;
  onActivate: (timelineId: string) => void;
};

export function PathTabs({ world, evals, onActivate }: Props) {
  const pinned = new Set(registeredIdsOf(world));
  const expectedEv = evals[EXPECTED_PATH_ID];

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/8 px-3 py-1.5">
      <span className="mr-1 shrink-0 text-[11px] text-muted">Viewing</span>
      <button
        type="button"
        onClick={() => onActivate(EXPECTED_PATH_ID)}
        className={cx(
          "shrink-0 rounded-full border px-2.5 py-1 text-[12px]",
          world.activeTimelineId === EXPECTED_PATH_ID
            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
            : "border-white/10 text-muted hover:text-foreground",
        )}
      >
        Expected
        {expectedEv && (
          <span className={cx("ml-1.5 font-mono", `tone-${pnlTone(expectedEv.pnlPct)}`)}>
            {pct(expectedEv.pnlPct, 1)}
          </span>
        )}
      </button>
      {world.timelines.map((t) => {
        const live = t.id === world.activeTimelineId;
        const ev = evals[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onActivate(t.id)}
            className={cx(
              "shrink-0 rounded-full border px-2.5 py-1 text-[12px]",
              live ? "border-gold/40 bg-gold/15 text-gold" : "border-white/10 text-muted hover:text-foreground",
            )}
          >
            {t.label}
            {ev && (
              <>
                <span className={cx("ml-1.5 font-mono", `tone-${pnlTone(ev.pnlPct)}`)}>{pct(ev.pnlPct, 1)}</span>
                {ev.pathProbability !== undefined && (
                  <span className="ml-1 font-mono text-[10px] text-muted">{pLabel(ev.pathProbability)}</span>
                )}
              </>
            )}
            {pinned.has(t.id) && !live && <span className="ml-1 text-[10px] text-sky-200/80">in compare</span>}
          </button>
        );
      })}
    </div>
  );
}
