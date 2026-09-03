import { defaultAssignment, normalizeWorldEdges } from "./graph";
import { nid, nowIso } from "./ids";
import type {
  CausesEdge,
  EventNode,
  Hypothesis,
  Thesis,
  World,
} from "./types";

type SeedSpec = {
  id: string;
  hypothesis: Hypothesis;
  thesis: Thesis;
  events: Omit<EventNode, "kind">[];
  causes: { from: string; to: string; label: string }[];
  impacts: { from: string; symbol: string; assetReturnPct: number }[];
  timelines: { id: string; label: string; assignment: Record<string, string> }[];
};

function ev(
  spec: Omit<EventNode, "kind" | "alternatives" | "weaknesses" | "transforms" | "timeIndex"> &
    Partial<Pick<EventNode, "alternatives" | "weaknesses" | "transforms" | "timeIndex">>,
): Omit<EventNode, "kind"> {
  return {
    alternatives: [],
    weaknesses: [],
    transforms: [],
    timeIndex: 0,
    ...spec,
  };
}

const HORMUZ: SeedSpec = {
  id: "world_hormuz",
  hypothesis: {
    mode: "explore",
    eventA: "The Strait of Hormuz is going to open next week.",
  },
  thesis: {
    horizonDays: 21,
    narrative:
      "Short prompt crude as Hormuz reopens — insurance and freight normalize, trapped supply clears. Long refiners as a partial hedge.",
    legs: [
      { symbol: "CL", side: "short", weight: 0.7 },
      { symbol: "XLE", side: "long", weight: 0.3 },
    ],
  },
  events: [
    ev({
      id: "hormuz_open",
      forkGroupId: "hormuz_open",
      title: "Hormuz reopens to commercial traffic",
      mechanism:
        "Transit restrictions lift and AIS tracks resume through the strait. This is the hypothesized shock — not yet the price.",
      pConditional: 0.78,
      confidence: "med",
      horizonDays: 7,
      alternatives: ["Opening is delayed 90 days", "Reopen is symbolic; insurance stays elevated"],
      weaknesses: ["‘Open’ can mean political announcement without war-risk premia actually falling."],
    }),
    ev({
      id: "aftermath_calm",
      forkGroupId: "aftermath",
      title: "No kinetic follow-up",
      mechanism:
        "The reopen holds. No strike on Iranian assets, no mining, no closure-by-another-name. The tail is allowed to decay.",
      pConditional: 0.62,
      confidence: "med",
      horizonDays: 10,
      alternatives: ["Iran is struck the next day"],
      weaknesses: ["A single incident re-opens the tail overnight. This hop is the fragile one."],
    }),
    ev({
      id: "insurance_down",
      forkGroupId: "insurance_down",
      title: "War-risk premia and wait times collapse",
      mechanism:
        "Lloyd’s war-risk rates and VLCC demurrage mean-revert as underwriters treat the strait as transitable again.",
      pConditional: 0.7,
      confidence: "med",
      horizonDays: 14,
      weaknesses: ["Premia can stay sticky if underwriters wait for a ‘quiet quarter’."],
    }),
    ev({
      id: "prompt_supply",
      forkGroupId: "prompt_supply",
      title: "Prompt barrel availability normalizes",
      mechanism:
        "Inventories rebuild at Fujairah and in Europe. Brent–Dubai structure loosens as trapped barrels clear.",
      pConditional: 0.66,
      confidence: "med",
      horizonDays: 21,
    }),
    ev({
      id: "crude_reprices",
      forkGroupId: "crude_reprices",
      title: "Prompt crude sheds the disruption premium",
      mechanism:
        "Front-month WTI/Brent lose the geopolitical premium; the curve re-steepens. This is the oil-down claim, made auditable.",
      pConditional: 0.64,
      confidence: "med",
      horizonDays: 21,
      weaknesses: ["OPEC+ can offset the signal. Positioning may already be short."],
    }),
    ev({
      id: "aftermath_strike",
      forkGroupId: "aftermath",
      title: "Iran is struck the next day",
      mechanism:
        "A kinetic event lands after the reopen. The strait is ‘open’ on paper and closed in the risk premium. This is the black swan on the same chain.",
      pConditional: 0.18,
      confidence: "low",
      horizonDays: 3,
      alternatives: ["No kinetic follow-up"],
    }),
    ev({
      id: "war_risk_up",
      forkGroupId: "war_risk_up",
      title: "War-risk and chokepoint premia reprice violently",
      mechanism:
        "Insurance, freight, and vol jump together. Flows treat Hormuz as option-like again; defense and gold catch a bid.",
      pConditional: 0.74,
      confidence: "high",
      horizonDays: 5,
    }),
    ev({
      id: "barrels_at_risk",
      forkGroupId: "barrels_at_risk",
      title: "Prompt supply is scared, not freed",
      mechanism:
        "Cargoes delay, owners self-insure or reroute. The physical market tightens even if a few ships still transit.",
      pConditional: 0.68,
      confidence: "med",
      horizonDays: 10,
    }),
  ],
  causes: [
    { from: "hormuz_open", to: "aftermath_calm", label: "enables" },
    { from: "hormuz_open", to: "aftermath_strike", label: "can be followed by" },
    { from: "aftermath_calm", to: "insurance_down", label: "causes" },
    { from: "insurance_down", to: "prompt_supply", label: "enables" },
    { from: "prompt_supply", to: "crude_reprices", label: "causes" },
    { from: "aftermath_strike", to: "war_risk_up", label: "causes" },
    { from: "war_risk_up", to: "barrels_at_risk", label: "raises P of" },
  ],
  impacts: [
    { from: "insurance_down", symbol: "FRO", assetReturnPct: -12 },
    { from: "prompt_supply", symbol: "XLE", assetReturnPct: 3 },
    { from: "crude_reprices", symbol: "CL", assetReturnPct: -11 },
    { from: "crude_reprices", symbol: "XLE", assetReturnPct: 4 },
    { from: "crude_reprices", symbol: "FRO", assetReturnPct: -6 },
    { from: "war_risk_up", symbol: "VIX", assetReturnPct: 8 },
    { from: "war_risk_up", symbol: "GLD", assetReturnPct: 3 },
    { from: "war_risk_up", symbol: "ITA", assetReturnPct: 6 },
    { from: "barrels_at_risk", symbol: "CL", assetReturnPct: 9 },
    { from: "barrels_at_risk", symbol: "XLE", assetReturnPct: -3 },
    { from: "barrels_at_risk", symbol: "FRO", assetReturnPct: 14 },
  ],
  timelines: [
    {
      id: "tl_base",
      label: "Base · reopen holds",
      assignment: {
        hormuz_open: "hormuz_open",
        aftermath: "aftermath_calm",
        insurance_down: "insurance_down",
        prompt_supply: "prompt_supply",
        crude_reprices: "crude_reprices",
      },
    },
    {
      id: "tl_strike",
      label: "Fork · Iran struck",
      assignment: {
        hormuz_open: "hormuz_open",
        aftermath: "aftermath_strike",
        war_risk_up: "war_risk_up",
        barrels_at_risk: "barrels_at_risk",
      },
    },
  ],
};

const MIDTERMS: SeedSpec = {
  id: "world_midterms",
  hypothesis: {
    mode: "explore",
    eventA: "Republicans win the House but Democrats take the Senate during the Midterms.",
  },
  thesis: {
    horizonDays: 60,
    legs: [
      { symbol: "TLT", side: "long", weight: 0.6 },
      { symbol: "XLF", side: "short", weight: 0.4 },
    ],
  },
  events: [
    ev({
      id: "split_gov",
      forkGroupId: "split_gov",
      title: "Split Congress: House R / Senate D",
      mechanism: "Neither party can move a partisan fiscal package. The hypothesized political shock.",
      pConditional: 0.35,
      confidence: "low",
      horizonDays: 70,
      alternatives: ["Republican sweep", "Democratic sweep"],
    }),
    ev({
      id: "gridlock",
      forkGroupId: "gridlock",
      title: "Legislative gridlock, no fiscal impulse",
      mechanism: "Reconciliation is blocked. Spending and tax changes stall. Deficits are inertial, not new.",
      pConditional: 0.72,
      confidence: "med",
      horizonDays: 120,
      alternatives: ["A must-pass bill becomes a Christmas tree"],
    }),
    ev({
      id: "duration_bid",
      forkGroupId: "duration_bid",
      title: "Duration catches a bid; fiscal-beta fades",
      mechanism:
        "The market takes ‘no new impulse’ as a modest tailwind for long bonds and a headwind for fiscal-sensitive financials.",
      pConditional: 0.58,
      confidence: "med",
      horizonDays: 90,
      weaknesses: ["Deficit path can still steepen via interest costs alone. Fed path dominates this hop."],
    }),
    ev({
      id: "sweep",
      forkGroupId: "gridlock",
      title: "Must-pass vehicle becomes a fiscal package",
      mechanism:
        "CR / debt-ceiling theater is stuffed with stimulus. Split government still produces a pulse — the opposite of the gridlock thesis.",
      pConditional: 0.22,
      confidence: "low",
      horizonDays: 150,
    }),
    ev({
      id: "yields_up",
      forkGroupId: "yields_up",
      title: "Issuance scare, yields backup",
      mechanism: "Net supply and a growth pulse lift the long end. Financials catch a steepener bid.",
      pConditional: 0.55,
      confidence: "med",
      horizonDays: 90,
    }),
  ],
  causes: [
    { from: "split_gov", to: "gridlock", label: "usually implies" },
    { from: "gridlock", to: "duration_bid", label: "causes" },
    { from: "split_gov", to: "sweep", label: "can still produce" },
    { from: "sweep", to: "yields_up", label: "causes" },
  ],
  impacts: [
    { from: "duration_bid", symbol: "TLT", assetReturnPct: 6 },
    { from: "duration_bid", symbol: "XLF", assetReturnPct: -3 },
    { from: "duration_bid", symbol: "SPY", assetReturnPct: 1 },
    { from: "yields_up", symbol: "TLT", assetReturnPct: -7 },
    { from: "yields_up", symbol: "XLF", assetReturnPct: 5 },
  ],
  timelines: [
    {
      id: "tl_base",
      label: "Base · gridlock",
      assignment: { split_gov: "split_gov", gridlock: "gridlock", duration_bid: "duration_bid" },
    },
    {
      id: "tl_impulse",
      label: "Fork · fiscal pulse anyway",
      assignment: { split_gov: "split_gov", gridlock: "sweep", yields_up: "yields_up" },
    },
  ],
};

const EXPORTS: SeedSpec = {
  id: "world_exports",
  hypothesis: {
    mode: "explore",
    eventA: "Models more capable than Fable get export restricted by the United States.",
  },
  thesis: {
    horizonDays: 90,
    legs: [
      { symbol: "NVDA", side: "short", weight: 0.45 },
      { symbol: "AVGO", side: "long", weight: 0.55 },
    ],
  },
  events: [
    ev({
      id: "controls",
      forkGroupId: "controls",
      title: "Frontier-class models are export-restricted",
      mechanism:
        "Weights, APIs, and supporting silicon above a capability line cannot ship to a defined set of destinations. A compute bifurcation, not a ban on ‘AI’.",
      pConditional: 0.4,
      confidence: "med",
      horizonDays: 180,
      alternatives: ["Controls leak / delayed a year", "Open-weight models clear the line first"],
    }),
    ev({
      id: "bifurcate",
      forkGroupId: "bifurcate",
      title: "US closed models vs. open weights abroad",
      mechanism:
        "Domestic labs keep the frontier. Foreign demand shifts to open weights and non-US clouds. China-revenue silicon is the first cut.",
      pConditional: 0.6,
      confidence: "med",
      horizonDays: 120,
    }),
    ev({
      id: "capex_mix",
      forkGroupId: "capex_mix",
      title: "Domestic inference capex up; China GPU mix down",
      mechanism:
        "US/allied spend rotates toward inference clusters and networking. NVDA’s China mix is a hit; domestic interconnect still compounds.",
      pConditional: 0.55,
      confidence: "med",
      horizonDays: 180,
      weaknesses: ["NVDA domestic demand can swamp the China cut. Sign on the name is not the sign on the mix."],
    }),
    ev({
      id: "leak",
      forkGroupId: "bifurcate",
      title: "Controls leak or are gamed via third countries",
      mechanism:
        "The restriction is real on paper and porous in practice. China mix does not gap down; the trade is mostly headline vol.",
      pConditional: 0.28,
      confidence: "low",
      horizonDays: 150,
    }),
    ev({
      id: "fade",
      forkGroupId: "fade",
      title: "Headline fades; hardware demand unchanged",
      mechanism: "Buyers pre-ship, reroute, or substitute. The capability line does not bind on volumes that matter.",
      pConditional: 0.5,
      confidence: "med",
      horizonDays: 120,
    }),
  ],
  causes: [
    { from: "controls", to: "bifurcate", label: "intended to cause" },
    { from: "bifurcate", to: "capex_mix", label: "causes" },
    { from: "controls", to: "leak", label: "can instead yield" },
    { from: "leak", to: "fade", label: "causes" },
  ],
  impacts: [
    { from: "capex_mix", symbol: "NVDA", assetReturnPct: -8 },
    { from: "capex_mix", symbol: "AVGO", assetReturnPct: 7 },
    { from: "capex_mix", symbol: "SMH", assetReturnPct: -2 },
    { from: "fade", symbol: "NVDA", assetReturnPct: 5 },
    { from: "fade", symbol: "AVGO", assetReturnPct: 1 },
  ],
  timelines: [
    {
      id: "tl_base",
      label: "Base · controls bind",
      assignment: { controls: "controls", bifurcate: "bifurcate", capex_mix: "capex_mix" },
    },
    {
      id: "tl_leak",
      label: "Fork · controls leak",
      assignment: { controls: "controls", bifurcate: "leak", fade: "fade" },
    },
  ],
};

const PHOTONIC: SeedSpec = {
  id: "world_photonic",
  hypothesis: {
    mode: "explore",
    eventA: "Photonic chips get adopted faster than expected.",
  },
  thesis: {
    horizonDays: 365,
    legs: [
      { symbol: "AVGO", side: "long", weight: 0.6 },
      { symbol: "NVDA", side: "short", weight: 0.4 },
    ],
  },
  events: [
    ev({
      id: "adopt",
      forkGroupId: "adopt",
      title: "Co-packaged optics land in training clusters faster than consensus",
      mechanism:
        "CPO / silicon photonics crosses a cost and yield line. Interconnect, not GPU FLOPs, becomes the binding constraint that eases.",
      pConditional: 0.3,
      confidence: "low",
      horizonDays: 540,
      alternatives: ["Yield stalls; copper holds for another gen"],
      weaknesses: ["‘Faster than expected’ is a relative claim. Need a date and a rack share."],
    }),
    ev({
      id: "cost_down",
      forkGroupId: "cost_down",
      title: "Interconnect cost per token falls",
      mechanism: "Optical IO cuts power and reach cost inside the scale-up domain. Cluster designs rebalance toward network.",
      pConditional: 0.55,
      confidence: "med",
      horizonDays: 400,
    }),
    ev({
      id: "mix_shift",
      forkGroupId: "mix_shift",
      title: "BOM mix shifts: optics / switch silicon vs. GPU networking",
      mechanism:
        "A dollar of training capex buys more optical and switch content, slightly less proprietary GPU-scale-up. Relative value, not ‘AI is over’.",
      pConditional: 0.5,
      confidence: "med",
      horizonDays: 500,
    }),
    ev({
      id: "stall",
      forkGroupId: "cost_down",
      title: "Yield and packaging stall; copper holds",
      mechanism:
        "CPO slips a generation. The ‘faster than expected’ claim fails. Incumbent scale-up roadmaps keep the spend.",
      pConditional: 0.4,
      confidence: "med",
      horizonDays: 400,
    }),
    ev({
      id: "status_quo",
      forkGroupId: "status_quo",
      title: "GPU networking share holds",
      mechanism: "The relative-value short on NVDA vs optical is the wrong expression if CPO does not actually ship.",
      pConditional: 0.6,
      confidence: "med",
      horizonDays: 400,
    }),
  ],
  causes: [
    { from: "adopt", to: "cost_down", label: "causes" },
    { from: "cost_down", to: "mix_shift", label: "causes" },
    { from: "adopt", to: "stall", label: "can fail via" },
    { from: "stall", to: "status_quo", label: "implies" },
  ],
  impacts: [
    { from: "mix_shift", symbol: "AVGO", assetReturnPct: 12 },
    { from: "mix_shift", symbol: "NVDA", assetReturnPct: -4 },
    { from: "mix_shift", symbol: "SMH", assetReturnPct: 3 },
    { from: "status_quo", symbol: "AVGO", assetReturnPct: -2 },
    { from: "status_quo", symbol: "NVDA", assetReturnPct: 6 },
  ],
  timelines: [
    {
      id: "tl_base",
      label: "Base · CPO lands",
      assignment: { adopt: "adopt", cost_down: "cost_down", mix_shift: "mix_shift" },
    },
    {
      id: "tl_stall",
      label: "Fork · yield stalls",
      assignment: { adopt: "adopt", cost_down: "stall", status_quo: "status_quo" },
    },
  ],
};

function assignProbabilities(
  causes: { from: string; to: string; label: string }[],
  events: Omit<EventNode, "kind">[],
): CausesEdge[] {
  const byParent = new Map<string, typeof causes>();
  for (const c of causes) {
    const list = byParent.get(c.from) ?? [];
    list.push(c);
    byParent.set(c.from, list);
  }
  const byId = new Map(events.map((e) => [e.id, e]));
  return causes.map((c) => {
    const siblings = byParent.get(c.from) ?? [c];
    const weights = siblings.map((s) => byId.get(s.to)?.pConditional ?? 1);
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    const mine = byId.get(c.to)?.pConditional ?? 1;
    return {
      id: `e_${c.from}_${c.to}`,
      from: c.from,
      to: c.to,
      kind: "causes" as const,
      label: c.label,
      probability: Math.round((mine / total) * 1000) / 1000,
    };
  });
}

function materialize(spec: SeedSpec): World {
  const impactMap = new Map<string, { symbol: string; assetReturnPct: number }[]>();
  for (const i of spec.impacts) {
    const list = impactMap.get(i.from) ?? [];
    list.push({ symbol: i.symbol, assetReturnPct: i.assetReturnPct });
    impactMap.set(i.from, list);
  }

  const nodes: World["nodes"] = [
    ...spec.events.map((e, idx) => ({
      ...e,
      kind: "event" as const,
      timeIndex: idx,
      transforms: impactMap.get(e.id) ?? [],
    })),
    { kind: "thesis", id: "thesis" },
  ];
  const edges: World["edges"] = normalizeWorldEdges(assignProbabilities(spec.causes, spec.events));
  const t0 = nowIso();
  return {
    id: spec.id,
    createdAt: t0,
    updatedAt: t0,
    hypothesis: spec.hypothesis,
    thesis: spec.thesis,
    nodes,
    edges,
    timelines: spec.timelines,
    activeTimelineId: spec.timelines[0].id,
    registeredIds: spec.timelines.map((t) => t.id),
  };
}

export function matchSeed(eventA: string): World | null {
  const t = eventA.toLowerCase();
  if (/hormuz/.test(t)) return materialize(HORMUZ);
  if (/midterm|senate|house/.test(t) && /republican|democrat/.test(t)) return materialize(MIDTERMS);
  if (/export restrict|fable|frontier/.test(t) || (/model/.test(t) && /export/.test(t)))
    return materialize(EXPORTS);
  if (/photonic/.test(t)) return materialize(PHOTONIC);
  return null;
}

export function seedWorld(name: "hormuz" | "midterms" | "exports" | "photonic"): World {
  const spec = { hormuz: HORMUZ, midterms: MIDTERMS, exports: EXPORTS, photonic: PHOTONIC }[name];
  const world = materialize(spec);
  world.id = `${spec.id}_${nid("w")}`;
  return world;
}

export function freshSeedCopy(world: World, hypothesis: Hypothesis): World {
  const copy = structuredClone(world);
  copy.id = nid("world");
  copy.hypothesis = hypothesis;
  copy.createdAt = nowIso();
  copy.updatedAt = copy.createdAt;
  const events = copy.nodes.filter((n) => n.kind === "event");
  if (copy.timelines[0] && Object.keys(copy.timelines[0].assignment).length === 0) {
    copy.timelines[0].assignment = defaultAssignment(events);
  }
  return copy;
}
