import { evalExpectedWithThesis, evalTimelineWithThesis } from "./eval";
import {
  activeEventIds,
  eventNodes,
  nodeTransforms,
  normalizeThesis,
  timelineById,
} from "./graph";
import { EXPECTED_PATH_ID } from "./types";
import type { ParsedLeg, Side, StrategyImpact, StrategySuggestion, Thesis, World } from "./types";

type AssetAlias = { re: RegExp; symbol: string; label: string };

const ASSETS: AssetAlias[] = [
  { re: /\b(?:crude|wti|brent|oil)\b/i, symbol: "CL", label: "crude" },
  { re: /\b(?:xle|energy|refiner(?:s|ies)?)\b/i, symbol: "XLE", label: "energy" },
  { re: /\b(?:fro|tanker(?:s)?|shipping)\b/i, symbol: "FRO", label: "tankers" },
  { re: /\b(?:gld|gold)\b/i, symbol: "GLD", label: "gold" },
  { re: /\b(?:vix|vol(?:atility)?)\b/i, symbol: "VIX", label: "vol" },
  { re: /\b(?:ita|defense)\b/i, symbol: "ITA", label: "defense" },
  { re: /\b(?:tlt|duration|treasur(?:y|ies)|bonds?)\b/i, symbol: "TLT", label: "duration" },
  { re: /\b(?:spy|equit(?:y|ies)|s&p|stocks?)\b/i, symbol: "SPY", label: "equities" },
  { re: /\b(?:nvda|nvidia)\b/i, symbol: "NVDA", label: "NVDA" },
  { re: /\b(?:avgo|broadcom)\b/i, symbol: "AVGO", label: "AVGO" },
  { re: /\b(?:smh|semis?|semiconductor(?:s)?)\b/i, symbol: "SMH", label: "semis" },
  { re: /\b(?:xlf|financials?|banks?)\b/i, symbol: "XLF", label: "financials" },
];

const KNOWN_SYMBOLS = new Set([
  "CL", "XLE", "FRO", "GLD", "VIX", "ITA", "TLT", "SPY", "NVDA", "AVGO", "SMH", "XLF",
]);

function sideNear(text: string, idx: number): Side {
  const before = text.slice(Math.max(0, idx - 24), idx);
  const shortBefore = before.search(/\b(short|sell|underweight|fade)\b/i);
  const longBefore = before.search(/\b(long|buy|overweight|own)\b/i);
  if (shortBefore >= 0 && (longBefore < 0 || shortBefore > longBefore)) return "short";
  if (longBefore >= 0 && (shortBefore < 0 || longBefore > shortBefore)) return "long";
  return "long";
}

function parseHorizon(text: string): number | undefined {
  const w = text.match(/(\d+)\s*weeks?/i);
  if (w) return Number(w[1]) * 7;
  const d = text.match(/(\d+)\s*days?/i);
  if (d) return Number(d[1]);
  const mo = text.match(/(\d+)\s*months?/i);
  if (mo) return Number(mo[1]) * 30;
  return undefined;
}

export function parseStrategyNarrative(text: string): {
  thesis: Thesis;
  parsed: ParsedLeg[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const raw = text.trim();
  if (!raw) {
    return { thesis: { legs: [], narrative: "" }, parsed: [], warnings: ["Empty strategy."] };
  }

  const parsed: ParsedLeg[] = [];
  const usedSymbols = new Set<string>();

  // Explicit tickers only when uppercase: "short CL", "70% long XLE"
  const tickerRe = /(?:(\d+)\s*%?\s*)?(short|long|sell|buy)\s+([A-Z]{2,5})\b/g;
  let m: RegExpExecArray | null;
  while ((m = tickerRe.exec(raw))) {
    const symbol = m[3].toUpperCase();
    if (!KNOWN_SYMBOLS.has(symbol)) continue;
    const weight = m[1] ? Number(m[1]) / 100 : 1;
    const side: Side = /short|sell/i.test(m[2]) ? "short" : "long";
    if (!usedSymbols.has(symbol)) {
      parsed.push({ symbol, side, weight, matchedText: m[0] });
      usedSymbols.add(symbol);
    }
  }

  // Alias phrases: "short crude", "long gold" (fills gaps alongside tickers)
  for (const a of ASSETS) {
    const re = new RegExp(a.re.source, "gi");
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(raw))) {
      if (usedSymbols.has(a.symbol)) continue;
      const pctMatch = raw.slice(Math.max(0, hit.index - 8), hit.index).match(/(\d+)\s*%/);
      parsed.push({
        symbol: a.symbol,
        side: sideNear(raw, hit.index),
        weight: pctMatch ? Number(pctMatch[1]) / 100 : 1,
        matchedText: hit[0],
      });
      usedSymbols.add(a.symbol);
    }
  }

  if (!parsed.length) {
    warnings.push("Could not map tickers. Try “short CL and long XLE” or name assets like crude, gold, vol.");
    return { thesis: { legs: [], narrative: raw }, parsed: [], warnings };
  }

  const thesis = normalizeThesis({
    narrative: raw,
    horizonDays: parseHorizon(raw) ?? 21,
    legs: parsed.map((p) => ({ symbol: p.symbol, side: p.side, weight: p.weight })),
  });

  if (parsed.length === 1) warnings.push("Single-leg book. Add a hedge leg if you want relative-value.");
  return { thesis, parsed, warnings };
}

function thesisFromReturns(
  returns: Map<string, number>,
  narrative: string,
  horizonDays = 21,
): Thesis {
  const ranked = [...returns.entries()]
    .filter(([, r]) => Math.abs(r) >= 0.5)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  if (!ranked.length) return { legs: [], narrative, horizonDays };
  const mag = ranked.reduce((s, [, r]) => s + Math.abs(r), 0);
  return normalizeThesis({
    narrative,
    horizonDays,
    legs: ranked.map(([symbol, r]) => ({
      symbol,
      side: r >= 0 ? "long" : "short",
      weight: Math.abs(r) / mag,
    })),
  });
}

function terminalNodes(world: World, timelineId?: string) {
  const tid = timelineId ?? world.activeTimelineId;
  if (tid === EXPECTED_PATH_ID) {
    return eventNodes(world).filter((n) => nodeTransforms(world, n.id).length > 0);
  }
  const timeline = timelineById(world, tid)!;
  const active = activeEventIds(world, timeline);
  return eventNodes(world)
    .filter((n) => active.has(n.id))
    .filter((n) => nodeTransforms(world, n.id).length > 0);
}

function returnsForView(world: World, timelineId: string) {
  const tid = timelineId ?? world.activeTimelineId;
  if (tid === EXPECTED_PATH_ID) {
    const ev = evalExpectedWithThesis(world);
    const bySymbol = new Map<string, number>();
    for (const n of ev.nodeEvals) {
      for (const [sym, r] of Object.entries(n.stateOut.cumulativeReturns)) {
        bySymbol.set(sym, (bySymbol.get(sym) ?? 0) + r * n.reachProbability);
      }
    }
    return bySymbol;
  }
  const timeline = timelineById(world, tid)!;
  const active = activeEventIds(world, timeline);
  const bySymbol = new Map<string, number>();
  for (const n of eventNodes(world)) {
    if (!active.has(n.id)) continue;
    for (const t of nodeTransforms(world, n.id)) {
      bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + t.assetReturnPct);
    }
  }
  return bySymbol;
}

function evalForView(world: World, timelineId: string, thesis: Thesis) {
  if (timelineId === EXPECTED_PATH_ID) return evalExpectedWithThesis(world, thesis);
  return evalTimelineWithThesis(world, timelineById(world, timelineId)!, thesis);
}

export function suggestStrategiesFromChain(world: World, timelineId?: string): StrategySuggestion[] {
  const tid = timelineId ?? world.activeTimelineId;
  const timeline = tid === EXPECTED_PATH_ID ? undefined : timelineById(world, tid);
  const active =
    tid === EXPECTED_PATH_ID
      ? new Set(eventNodes(world).map((n) => n.id))
      : activeEventIds(world, timeline!);
  const terminals = terminalNodes(world, tid);
  const returns = returnsForView(world, tid);
  const out: StrategySuggestion[] = [];

  // 1 — Primary: express the base chain
  if (returns.size) {
    const top = [...returns.entries()].sort((a, b) => Math.abs(b[1]) - a[1]).slice(0, 2);
    const lead = terminals.sort((a, b) => b.horizonDays - a.horizonDays)[0];
    const legsDesc = top
      .map(([sym, r]) => `${r < 0 ? "short" : "long"} ${sym}`)
      .join(", ");
    const narrative = lead
      ? `If “${lead.title}”, ${legsDesc}. Hold ~${lead.horizonDays} days while the chain pays through.`
      : `Express this path: ${legsDesc}.`;
    const thesis = thesisFromReturns(returns, narrative, lead?.horizonDays ?? 21);
    const ev = evalForView(world, tid, thesis);
    out.push({
      id: "primary",
      narrative,
      rationale: lead?.mechanism ?? "Largest market moves on the viewing path.",
      thesis,
      pnlPct: ev.pnlPct,
      invalidation: ev.stops[0]?.title,
    });
  }

  // 2 — Relative value: long/short pair with opposite signs on same path
  const pos = [...returns.entries()].filter(([, r]) => r >= 2);
  const neg = [...returns.entries()].filter(([, r]) => r <= -2);
  if (pos.length && neg.length) {
    const longLeg = pos[0];
    const shortLeg = neg[0];
    const narrative = `Relative value: long ${longLeg[0]} vs short ${shortLeg[0]} — the chain pushes them opposite ways on this path.`;
    const thesis = normalizeThesis({
      narrative,
      horizonDays: 21,
      legs: [
        { symbol: longLeg[0], side: "long", weight: 0.55 },
        { symbol: shortLeg[0], side: "short", weight: 0.45 },
      ],
    });
    const ev = evalForView(world, tid, thesis);
    out.push({
      id: "relative",
      narrative,
      rationale: "Pairs the strongest up and down expressions without taking outright beta.",
      thesis,
      pnlPct: ev.pnlPct,
      invalidation: ev.stops[0]?.title,
    });
  }

  // 3 — Tail hedge from a fork alternative on an active fork group
  for (const n of eventNodes(world).filter((x) => active.has(x.id))) {
    const alts = n.alternatives;
    if (!alts.length) continue;
    const altText = alts[0];
    const members = eventNodes(world).filter(
      (x) => x.forkGroupId === n.forkGroupId && x.title.toLowerCase().includes(altText.toLowerCase().slice(0, 12)),
    );
    const altNode = members.find((x) => x.id !== n.id);
    if (!altNode) continue;
    const altReturns = new Map<string, number>();
    for (const t of nodeTransforms(world, altNode.id)) {
      altReturns.set(t.symbol, (altReturns.get(t.symbol) ?? 0) + t.assetReturnPct);
    }
    if (!altReturns.size) continue;
    const narrative = `Tail hedge if “${altNode.title}”: ${[...altReturns.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 2)
      .map(([sym, r]) => `${r >= 0 ? "long" : "short"} ${sym}`)
      .join(", ")}.`;
    const thesis = thesisFromReturns(altReturns, narrative, altNode.horizonDays);
    const hypothetical = {
      ...(timeline ?? { id: "hyp", label: "hyp", assignment: {} }),
      assignment: { ...(timeline?.assignment ?? {}), [n.forkGroupId]: altNode.id },
    };
    const ev = evalTimelineWithThesis(world, hypothetical, thesis);
    out.push({
      id: `tail_${altNode.id}`,
      narrative,
      rationale: `Expression if the fork “${altNode.title}” fires instead of “${n.title}”.`,
      thesis,
      pnlPct: ev.pnlPct,
      invalidation: n.title,
    });
    break;
  }

  // Dedupe by narrative, cap at 3
  const seen = new Set<string>();
  return out
    .filter((s) => {
      if (seen.has(s.narrative)) return false;
      seen.add(s.narrative);
      return s.thesis.legs.length > 0;
    })
    .slice(0, 3);
}

export function explainStrategyImpact(
  world: World,
  thesis: Thesis,
  timelineId?: string,
): StrategyImpact {
  const tid = timelineId ?? world.activeTimelineId;
  const ev = evalForView(world, tid, thesis);
  const helpful = ev.nodeContributions.filter((c) => c.contributionPct > 0.3);
  const harmful = ev.nodeContributions.filter((c) => c.contributionPct < -0.3);

  const modeLabel = ev.mode === "expected" ? "expected chain" : "viewing path";
  let summary: string;
  if (!thesis.legs.length) {
    summary = "No book to score against the chain.";
  } else if (ev.pnlPct > 1) {
    summary =
      helpful.length > 0
        ? `This strategy aligns with the ${modeLabel} (+${ev.pnlPct.toFixed(1)}%). Main payoff: ${helpful[0].title}.`
        : `Net positive on the ${modeLabel} (+${ev.pnlPct.toFixed(1)}%).`;
  } else if (ev.pnlPct < -1) {
    summary =
      harmful.length > 0
        ? `The chain works against this book (${ev.pnlPct.toFixed(1)}%). Problem hop: ${harmful[0].title}.`
        : `Net negative on the ${modeLabel} (${ev.pnlPct.toFixed(1)}%).`;
  } else {
    summary = `Flat vs the ${modeLabel} (${ev.pnlPct.toFixed(1)}%) — the chain does not strongly help or hurt.`;
  }

  if (ev.pathProbability !== undefined && ev.mode === "path") {
    summary += ` Path weight: ${Math.round(ev.pathProbability * 100)}%.`;
  }

  if (ev.stops[0]) {
    summary += ` Invalidated if “${ev.stops[0].title}” (${ev.stops[0].pnlIfRealized.toFixed(1)}%).`;
  }

  return {
    thesis,
    eval: ev,
    summary,
    helpful,
    harmful,
    parseWarnings: [],
  };
}

export function explainParsedStrategy(
  world: World,
  text: string,
  timelineId?: string,
): StrategyImpact {
  const { thesis, warnings } = parseStrategyNarrative(text);
  const impact = explainStrategyImpact(world, thesis, timelineId);
  return { ...impact, parseWarnings: warnings };
}
