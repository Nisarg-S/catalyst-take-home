import { evalWorld, suggestThesisFromEval } from "./eval";
import { defaultAssignment, eventNode, forkGroupMembers, MAX_REGISTERED, normalizeWorldEdges, parentsOf, registeredIdsOf, timelineById } from "./graph";
import { nid, nowIso, slug } from "./ids";
import { freshSeedCopy, matchSeed } from "./seeds";
import type { CausesEdge, EventNode, Hypothesis, NodeTransform, Thesis, Timeline, World } from "./types";

function event(
  partial: Omit<EventNode, "kind" | "alternatives" | "weaknesses" | "transforms" | "timeIndex"> &
    Partial<Pick<EventNode, "alternatives" | "weaknesses" | "transforms" | "timeIndex">>,
): EventNode {
  return {
    kind: "event",
    alternatives: ["The event is delayed 90 days", "The event happens but is already priced in"],
    weaknesses: [],
    transforms: [],
    timeIndex: 0,
    ...partial,
  };
}

function causes(from: string, to: string, label: string, probability: number): CausesEdge {
  return { id: nid("e"), from, to, kind: "causes", label, probability };
}

function syntheticWorld(hypothesis: Hypothesis, thesis: Thesis): World {
  const originId = slug(hypothesis.eventA, "origin");
  const txId = "transmission";
  const xaId = "cross_asset";
  const termId = hypothesis.eventB ? slug(hypothesis.eventB, "terminal") : "terminal";
  const altTxId = "transmission_fail";

  const origin = event({
    id: originId,
    forkGroupId: originId,
    title: hypothesis.eventA.replace(/\.$/, ""),
    mechanism: "User-hypothesized shock. Downstream hops are an illustrative transmission, not a forecast market.",
    pConditional: 0.55,
    confidence: "low",
    horizonDays: 14,
    timeIndex: 0,
    weaknesses: ["This chain is a sketch until a hop is pinned to a resolvable market."],
  });

  const tx = event({
    id: txId,
    forkGroupId: txId,
    title: "Positioning and vol absorb the shock",
    mechanism:
      "The event hits dealer positioning first: implied vol, crowding, and the usual cross-asset beta before any fundamental hop.",
    pConditional: 0.65,
    confidence: "low",
    horizonDays: 21,
    timeIndex: 1,
    alternatives: ["The event is a nothing-burger / already in the price"],
  });

  const xa = event({
    id: xaId,
    forkGroupId: xaId,
    title: "Rates, credit, and beta reprice the tail",
    mechanism: "Once vol is bid, duration, HY, and equity beta take a side. This is the generic macro transmission.",
    pConditional: 0.48,
    confidence: "low",
    horizonDays: 30,
    timeIndex: 2,
    transforms: [
      { symbol: "VIX", assetReturnPct: 6 },
      { symbol: "TLT", assetReturnPct: 2 },
    ],
  });

  const term = event({
    id: termId,
    forkGroupId: termId,
    title: hypothesis.eventB?.replace(/\.$/, "") ?? "A liquid expression shows up in futures and ETFs",
    mechanism: hypothesis.eventB
      ? `Audit target: does the chain actually realize “${hypothesis.eventB}”, or is that hop a leap?`
      : "Terminal hop: the shock is expressed in a small liquid book (index, rates, vol) rather than a story.",
    pConditional: hypothesis.eventB ? 0.4 : 0.45,
    confidence: "low",
    horizonDays: 45,
    timeIndex: 3,
    transforms: [{ symbol: "SPY", assetReturnPct: -4 }],
    weaknesses: hypothesis.eventB
      ? ["Sign and timing of the concluding event are the usual failure modes."]
      : [],
  });

  const fail = event({
    id: altTxId,
    forkGroupId: txId,
    title: "Already priced in — the event is a nothing-burger",
    mechanism:
      "The hypothesized shock was in the tape. Vol sells off, the fundamental hop never fires, and the book that paid for ‘news’ loses.",
    pConditional: 0.35,
    confidence: "low",
    horizonDays: 14,
    timeIndex: 1,
  });

  const fade = event({
    id: "fade",
    forkGroupId: "fade",
    title: "Mean-reversion; no lasting cross-asset move",
    mechanism: "Without a binding constraint, the tape fades. This is the competing branch, not a refinement of the base chain.",
    pConditional: 0.5,
    confidence: "low",
    horizonDays: 21,
    timeIndex: 2,
    transforms: [
      { symbol: "VIX", assetReturnPct: -5 },
      { symbol: "SPY", assetReturnPct: 3 },
    ],
  });

  const causeEdges: CausesEdge[] = [
    causes(originId, txId, "transmits via", 0.65),
    causes(originId, altTxId, "can instead be", 0.35),
    causes(txId, xaId, "raises P of", 1),
    causes(xaId, termId, "expressed as", 1),
    causes(altTxId, "fade", "implies", 1),
  ];

  const t0 = nowIso();
  const world: World = {
    id: nid("world"),
    createdAt: t0,
    updatedAt: t0,
    hypothesis,
    thesis,
    nodes: [origin, tx, xa, term, fail, fade, { kind: "thesis", id: "thesis" }],
    edges: causeEdges,
    timelines: [
      {
        id: "tl_base",
        label: "Base",
        assignment: {
          [originId]: originId,
          [txId]: txId,
          [xaId]: xaId,
          [termId]: termId,
        },
      },
      {
        id: "tl_fade",
        label: "Fork · already priced",
        assignment: {
          [originId]: originId,
          [txId]: altTxId,
          fade: "fade",
        },
      },
    ],
    activeTimelineId: "tl_base",
    registeredIds: ["tl_base", "tl_fade"],
  };

  if (!thesis.legs.length) {
    world.thesis = suggestThesisFromEval(world, "tl_base");
  }
  return world;
}

export function createWorld(hypothesis: Hypothesis, thesis?: Thesis): World {
  const matched = matchSeed(hypothesis.eventA);
  if (matched) {
    const world = freshSeedCopy(matched, {
      ...hypothesis,
      eventA: hypothesis.eventA,
      eventB: hypothesis.eventB ?? matched.hypothesis.eventB,
    });
    if (thesis?.legs.length) world.thesis = thesis;
    return world;
  }
  return syntheticWorld(hypothesis, thesis ?? { legs: [] });
}

function signedTransforms(text: string): NodeTransform[] {
  const t = text.toLowerCase();
  const hawkish = /struck|war|attack|mine|restrict|ban|stall|fail|default|invasion|shutdown/.test(t);
  const dovish = /open|peace|adopt|faster|breakthrough|ceasefire|reopen/.test(t);
  const riskOn = dovish && !hawkish;
  const mag = hawkish ? 1 : riskOn ? -1 : 0.4;
  return [
    { symbol: "CL", assetReturnPct: 8 * mag },
    { symbol: "XLE", assetReturnPct: 3 * mag },
    { symbol: "VIX", assetReturnPct: hawkish ? 7 : -3 },
    { symbol: "GLD", assetReturnPct: hawkish ? 3 : -1 },
    { symbol: "SPY", assetReturnPct: hawkish ? -4 : 3 },
  ];
}

export function forkWorld(world: World, nodeId: string, counterfactual: string): World {
  const target = eventNode(world, nodeId);
  if (!target) throw new Error("event not found");
  const text = counterfactual.trim();
  if (!text) throw new Error("counterfactual required");

  const existing = forkGroupMembers(world, target.forkGroupId).find(
    (n) => n.id !== target.id && n.title.toLowerCase().includes(text.toLowerCase().slice(0, 18)),
  );
  if (existing) {
    const matching = world.timelines.find((t) => t.assignment[target.forkGroupId] === existing.id);
    if (matching) {
      return registerPath(
        { ...world, activeTimelineId: matching.id, updatedAt: nowIso() },
        matching.id,
        true,
      );
    }
  }

  const forkId = nid("evt");
  const midId = nid("evt");
  const leafId = nid("evt");
  const forkNode = event({
    id: forkId,
    forkGroupId: target.forkGroupId,
    title: text.replace(/\.$/, ""),
    mechanism: `Counterfactual at “${target.title}”. Prefix of the chain is pinned; only this hop and its downstream are new.`,
    pConditional: 0.28,
    confidence: "low",
    horizonDays: Math.max(3, Math.round(target.horizonDays * 0.6)),
    timeIndex: target.timeIndex,
    weaknesses: ["Generated fork — treat magnitudes as directional, not a model."],
  });
  const mid = event({
    id: midId,
    forkGroupId: midId,
    title: `Transmission if: ${text.replace(/\.$/, "")}`,
    mechanism: "How the counterfactual hits positioning, insurance, or policy before it hits the terminal tape.",
    pConditional: 0.5,
    confidence: "low",
    horizonDays: target.horizonDays,
    timeIndex: target.timeIndex + 1,
  });
  const leaf = event({
    id: leafId,
    forkGroupId: leafId,
    title: "Terminal tape in the forked world",
    mechanism: "Liquid expression of the counterfactual. Compare this branch's impacts to the base chain.",
    pConditional: 0.45,
    confidence: "low",
    horizonDays: target.horizonDays + 7,
    timeIndex: target.timeIndex + 2,
    transforms: signedTransforms(text),
  });

  const parentIds = parentsOf(world, target.id);
  let causeEdges = world.edges.filter((e): e is CausesEdge => e.kind === "causes");
  for (const pid of parentIds) {
    causeEdges.push(causes(pid, forkId, "counterfactual of", 0.25));
  }
  causeEdges = normalizeWorldEdges(causeEdges);
  causeEdges.push(causes(forkId, midId, "causes", 1));
  causeEdges.push(causes(midId, leafId, "expressed as", 1));
  causeEdges = normalizeWorldEdges(causeEdges);

  const baseAssignment =
    timelineById(world)?.assignment ??
    defaultAssignment(world.nodes.filter((n): n is EventNode => n.kind === "event"));

  const newTimeline: Timeline = {
    id: nid("tl"),
    label: `Fork · ${text.slice(0, 32)}`,
    assignment: {
      ...baseAssignment,
      [target.forkGroupId]: forkId,
      [midId]: midId,
      [leafId]: leafId,
    },
  };

  return {
    ...world,
    nodes: [...world.nodes, forkNode, mid, leaf],
    edges: causeEdges,
    timelines: [...world.timelines, newTimeline],
    activeTimelineId: newTimeline.id,
    registeredIds: pinId(world, newTimeline.id),
    updatedAt: nowIso(),
  };
}

function pinId(world: World, timelineId: string): string[] {
  const ids = registeredIdsOf(world);
  if (ids.includes(timelineId)) return ids;
  if (ids.length >= MAX_REGISTERED) return ids;
  return [...ids, timelineId];
}

export function activateTimeline(world: World, timelineId: string): World {
  if (timelineId !== "__expected__" && !world.timelines.some((t) => t.id === timelineId)) {
    throw new Error("timeline not found");
  }
  return { ...world, activeTimelineId: timelineId, updatedAt: nowIso() };
}

export function registerPath(world: World, timelineId: string, on: boolean): World {
  if (!world.timelines.some((t) => t.id === timelineId)) throw new Error("timeline not found");
  const ids = new Set(registeredIdsOf(world));
  if (on) {
    if (!ids.has(timelineId) && ids.size >= MAX_REGISTERED) {
      throw new Error(`at most ${MAX_REGISTERED} registered paths`);
    }
    ids.add(timelineId);
  } else {
    ids.delete(timelineId);
  }
  return { ...world, registeredIds: [...ids], updatedAt: nowIso() };
}

export function registerAllPaths(world: World): World {
  return {
    ...world,
    registeredIds: world.timelines.map((t) => t.id).slice(0, MAX_REGISTERED),
    updatedAt: nowIso(),
  };
}

export { evalWorld, suggestThesisFromEval };
