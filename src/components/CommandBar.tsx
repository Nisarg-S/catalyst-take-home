"use client";

import { PRESETS } from "@/lib/presets";
import { cx } from "@/lib/cx";
import { pct, pnlTone } from "@/lib/format";
import type { Mode, Thesis, World } from "@/lib/types";

type Pane = "worlds" | "compare" | "strategy";

type Props = {
  mode: Mode;
  eventA: string;
  eventB: string;
  busy: boolean;
  world?: World | null;
  pnlPct?: number;
  activePane?: Pane | null;
  compareCount?: number;
  onMode: (m: Mode) => void;
  onEventA: (v: string) => void;
  onEventB: (v: string) => void;
  onGenerate: () => void;
  onPreset: (eventA: string, eventB?: string) => void;
  onOpen: (pane: Pane) => void;
};

export function CommandBar({
  mode,
  eventA,
  eventB,
  busy,
  world,
  pnlPct,
  activePane,
  compareCount = 0,
  onMode,
  onEventA,
  onEventB,
  onGenerate,
  onPreset,
  onOpen,
}: Props) {
  const thesis = world?.thesis;
  const strategyOpen = activePane === "strategy";

  return (
    <header className="shrink-0 border-b border-white/8 bg-[#0b0c11]/90 px-4 py-2.5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-1 shrink-0 pt-0.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-gold/80">Catalyst</div>
          <div className="font-serif text-xl leading-none">Causal desk</div>
        </div>

        <div className="flex rounded-full border border-white/10 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onMode("explore")}
            className={cx(
              "rounded-full px-2.5 py-1",
              mode === "explore" ? "bg-gold/20 text-gold" : "text-muted",
            )}
          >
            What happens next
          </button>
          <button
            type="button"
            onClick={() => onMode("audit")}
            className={cx(
              "rounded-full px-2.5 py-1",
              mode === "audit" ? "bg-gold/20 text-gold" : "text-muted",
            )}
          >
            Does A lead to B?
          </button>
        </div>

        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <input
              value={eventA}
              onChange={(e) => onEventA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onGenerate()}
              placeholder="Starting event"
              className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm outline-none focus:border-gold/40"
            />
            {mode === "audit" && (
              <input
                value={eventB}
                onChange={(e) => onEventB(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onGenerate()}
                placeholder="Claimed outcome"
                className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm outline-none focus:border-gold/40"
              />
            )}
            <button
              type="button"
              disabled={busy || eventA.trim().length < 3}
              onClick={onGenerate}
              className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-sm font-medium text-[#1a140c] disabled:opacity-40"
            >
              {busy ? "Generating…" : "Generate chain"}
            </button>
          </div>

          <StrategyBookBar
            thesis={thesis}
            pnlPct={pnlPct}
            open={strategyOpen}
            onClick={() => onOpen("strategy")}
          />
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap gap-1.5 pt-0.5">
          <HeaderTool
            label="Worlds"
            detail={world ? `${world.timelines.length}` : "—"}
            onClick={() => onOpen("worlds")}
            active={activePane === "worlds"}
          />
          <HeaderTool
            label="Compare"
            detail={String(compareCount)}
            onClick={() => onOpen("compare")}
            active={activePane === "compare"}
          />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.eventA, "eventB" in p ? p.eventB : undefined)}
            className="rounded-full border border-white/8 px-2 py-0.5 text-[11px] text-muted hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function StrategyBookBar({
  thesis,
  pnlPct,
  open,
  onClick,
}: {
  thesis?: Thesis;
  pnlPct?: number;
  open: boolean;
  onClick: () => void;
}) {
  const legs = thesis?.legs ?? [];
  const hasBook = legs.length > 0;
  const narrative = thesis?.narrative?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        open
          ? "border-emerald-400/40 bg-emerald-500/10 ring-1 ring-emerald-400/30"
          : "border-emerald-500/25 bg-emerald-950/40 hover:border-emerald-400/35 hover:bg-emerald-500/8",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-200/90">
            Your book
          </span>
          {!hasBook && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200/70">
              Define strategy
            </span>
          )}
        </div>
        {hasBook ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {legs.map((leg) => (
              <span
                key={`${leg.side}-${leg.symbol}`}
                className={cx(
                  "rounded-md px-1.5 py-0.5 font-mono text-[11px]",
                  leg.side === "long" ? "bg-emerald-500/15 text-emerald-100" : "bg-rose-500/15 text-rose-100",
                )}
              >
                {leg.side === "long" ? "Long" : "Short"} {leg.symbol} {Math.round(leg.weight * 100)}%
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 truncate text-[12px] text-emerald-100/60">
            {narrative || "Click to describe your trade in plain English"}
          </div>
        )}
        {hasBook && narrative && (
          <div className="mt-1 truncate text-[11px] text-emerald-100/50">{narrative}</div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-wide text-emerald-200/60">Expected P&amp;L</div>
        <div className={cx("font-mono text-lg leading-tight", hasBook && pnlPct !== undefined ? `tone-${pnlTone(pnlPct)}` : "text-muted")}>
          {hasBook && pnlPct !== undefined ? pct(pnlPct) : "—"}
        </div>
        <div className="mt-0.5 text-[10px] text-emerald-200/50">{open ? "Editing…" : "Edit"}</div>
      </div>
    </button>
  );
}

function HeaderTool({
  label,
  detail,
  onClick,
  active,
}: {
  label: string;
  detail: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-lg border px-2.5 py-1 text-left hover:border-gold/30 hover:bg-gold/10",
        active ? "border-gold/35 bg-gold/10" : "border-white/12 bg-white/4",
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="max-w-[100px] truncate text-[12px] text-foreground">{detail}</div>
    </button>
  );
}
