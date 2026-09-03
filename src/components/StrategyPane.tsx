"use client";

import { useEffect, useState } from "react";
import { fetchStrategySuggestions, previewStrategy } from "@/lib/api";
import { cx } from "@/lib/cx";
import { pct, pnlTone } from "@/lib/format";
import { thesisLabel } from "@/lib/graph";
import type { EvalResult, Side, StrategyImpact, StrategySuggestion, Thesis, World } from "@/lib/types";

type Props = {
  worldId: string;
  timelineId: string;
  world: World;
  active: EvalResult;
  busy: boolean;
  onSave: (thesis: Thesis) => void;
};

export function StrategyPane({ worldId, timelineId, world, active, busy, onSave }: Props) {
  const [narrative, setNarrative] = useState(world.thesis.narrative ?? "");
  const [legs, setLegs] = useState(world.thesis.legs);
  const [horizon, setHorizon] = useState(world.thesis.horizonDays ?? 21);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<Side>("long");
  const [impact, setImpact] = useState<StrategyImpact | null>(null);
  const [suggestions, setSuggestions] = useState<StrategySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchStrategySuggestions(worldId, timelineId).then((s) => {
      if (!cancelled) {
        setSuggestions(s);
        setLoadingSuggestions(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [worldId, timelineId]);

  const runPreview = async (text: string) => {
    if (text.trim().length < 3) return;
    setPreviewing(true);
    try {
      setImpact(await previewStrategy(worldId, text, timelineId));
    } finally {
      setPreviewing(false);
    }
  };

  const applyThesis = (t: Thesis) => {
    setNarrative(t.narrative ?? "");
    setLegs(t.legs);
    setHorizon(t.horizonDays ?? 21);
    onSave(t);
  };

  return (
    <div className="space-y-5">
      {/* 1 — NL input → chain impact */}
      <section className="space-y-2">
        <div className="text-[13px] font-medium">Describe a strategy in plain English</div>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={3}
          placeholder="e.g. Short crude and long energy if Hormuz reopens cleanly — 3 week hold"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] outline-none focus:border-gold/40"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || previewing || narrative.trim().length < 3}
            onClick={() => void runPreview(narrative)}
            className="rounded-lg bg-gold px-3 py-2 text-[13px] font-medium text-[#1a140c] disabled:opacity-40"
          >
            {previewing ? "Scoring…" : "See how the chain affects this"}
          </button>
          <button
            type="button"
            disabled={busy || !impact?.thesis.legs.length}
            onClick={() => impact && applyThesis(impact.thesis)}
            className="rounded-lg border border-gold/30 px-3 py-2 text-[13px] text-gold disabled:opacity-40"
          >
            Use this strategy
          </button>
        </div>
        {impact && (
          <div className="rounded-xl border border-white/10 bg-white/3 p-3 text-[13px]">
            <p>{impact.summary}</p>
            {impact.parseWarnings.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-muted">
                {impact.parseWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className={cx("mt-2 font-mono text-lg", `tone-${pnlTone(impact.eval.pnlPct)}`)}>
              {pct(impact.eval.pnlPct)} on the path you’re viewing
            </div>
            {impact.helpful.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] text-muted">Chain events that pay you</div>
                <ul className="mt-1 space-y-0.5">
                  {impact.helpful.slice(0, 3).map((h) => (
                    <li key={h.nodeId} className="flex justify-between gap-2">
                      <span>{h.title}</span>
                      <span className="font-mono tone-pos">{pct(h.contributionPct, 1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {impact.harmful.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] text-muted">Chain events that hurt you</div>
                <ul className="mt-1 space-y-0.5">
                  {impact.harmful.slice(0, 3).map((h) => (
                    <li key={h.nodeId} className="flex justify-between gap-2">
                      <span>{h.title}</span>
                      <span className="font-mono tone-neg">{pct(h.contributionPct, 1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {impact.eval.stops.length > 0 && (
              <p className="mt-2 text-muted">
                Stop if: {impact.eval.stops[0].title} ({pct(impact.eval.stops[0].pnlIfRealized)})
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2 — Suggestions from chain */}
      <section className="space-y-2 border-t border-white/8 pt-4">
        <div className="text-[13px] font-medium">Suggested from this chain</div>
        <p className="text-[12px] text-muted">
          Generated from the path you’re viewing — primary expression, relative value, and a tail hedge.
        </p>
        {loadingSuggestions ? (
          <p className="text-[13px] text-muted">Loading suggestions…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-[13px] text-muted">No suggestions yet. Fork the chain to create alternate paths.</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-[13px] leading-snug">{s.narrative}</p>
                <p className="mt-1 text-[12px] text-muted">{s.rationale}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={cx("font-mono text-sm", `tone-${pnlTone(s.pnlPct)}`)}>
                    {pct(s.pnlPct)} on this path
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => applyThesis(s.thesis)}
                    className="rounded-md bg-gold/15 px-2 py-1 text-[12px] text-gold"
                  >
                    Use this strategy
                  </button>
                </div>
                {s.invalidation && (
                  <p className="mt-1 text-[11px] text-muted">Invalidated if: {s.invalidation}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3 — Active strategy + manual legs */}
      <section className="space-y-2 border-t border-white/8 pt-4">
        <div className="text-[13px] font-medium">Active strategy</div>
        <p className="text-[12px] text-muted">{thesisLabel(world.thesis)}</p>
        <div className="font-mono text-sm">
          <span className="mr-2 text-muted">Live P&amp;L</span>
          <span className={cx(`tone-${pnlTone(active.pnlPct)}`)}>
            {world.thesis.legs.length ? pct(active.pnlPct) : "—"}
          </span>
        </div>
        {legs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {legs.map((leg, i) => (
              <div
                key={`${leg.symbol}-${i}`}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs"
              >
                <span className="font-mono text-gold">
                  {leg.side} {leg.symbol}
                </span>
                <span className="text-muted">{Math.round(leg.weight * 100)}%</span>
                <button type="button" onClick={() => setLegs((xs) => xs.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="CL"
            className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs"
          />
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs"
          >
            <option value="long">long</option>
            <option value="short">short</option>
          </select>
          <button
            type="button"
            disabled={!symbol.trim()}
            onClick={() => {
              setLegs((xs) => [...xs, { symbol: symbol.trim().toUpperCase(), side, weight: 1 }]);
              setSymbol("");
            }}
            className="text-xs text-gold"
          >
            Add ticker
          </button>
          <button
            type="button"
            disabled={busy || legs.length === 0}
            onClick={() => onSave({ legs, horizonDays: horizon, narrative: narrative.trim() || undefined })}
            className="rounded-md border border-white/15 px-2 py-1 text-xs"
          >
            Save manual book
          </button>
        </div>
      </section>
    </div>
  );
}
