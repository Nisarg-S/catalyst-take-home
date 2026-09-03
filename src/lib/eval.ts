import {
  applyNodeTransform,
  blendBookStates,
  cloneBookState,
  enumeratePaths,
  eventNodes,
  forkGroupMembers,
  incomingEdges,
  initialBookState,
  marginalReachProbabilities,
  nodeTransforms,
  normalizeThesis,
  registeredIdsOf,
  scoreBook,
  timelineById,
  timelineToPath,
  topologicalOrder,
} from "./graph";
import type {
  BookState,
  DagPath,
  EvalResult,
  ForkWatch,
  NodeContribution,
  NodeEval,
  SymbolPnl,
  Thesis,
  Timeline,
  World,
} from "./types";
import { EXPECTED_PATH_ID } from "./types";

const STOP_THRESHOLD = -1.5;

const STOPWORDS = new Set([
  "the",
  "and",
  "but",
  "for",
  "are",
  "was",
  "will",
  "going",
  "that",
  "this",
  "with",
  "from",
  "into",
  "than",
  "then",
  "does",
  "next",
  "week",
]);

const CLAIM_ASSETS: { re: RegExp; symbol: string }[] = [
  { re: /oil|crude|wti|brent/, symbol: "CL" },
  { re: /gold/, symbol: "GLD" },
  { re: /vol|vix/, symbol: "VIX" },
  { re: /bond|duration|treasur/, symbol: "TLT" },
];

function claimedDirection(text: string): 1 | -1 | 0 {
  if (/decreas|fall|drop|lower|\bdown\b|cheap/.test(text)) return -1;
  if (/increas|rise|rall|higher|\bup\b|spike/.test(text)) return 1;
  return 0;
}

function nodeContribution(stateIn: BookState, stateOut: BookState): number {
  const before = scoreBook(stateIn).pnl;
  const after = scoreBook(stateOut).pnl;
  return after - before;
}

function runPathPipeline(
  world: World,
  nodeIds: string[],
  thesis: Thesis,
  reachProbability: number,
): { nodeEvals: NodeEval[]; finalState: BookState } {
  const nodeEvals: NodeEval[] = [];
  let state = initialBookState(thesis);
  const byId = new Map(eventNodes(world).map((n) => [n.id, n]));

  for (const nodeId of nodeIds) {
    const n = byId.get(nodeId);
    if (!n) continue;
    const stateIn = cloneBookState(state);
    const stateOut = applyNodeTransform(stateIn, nodeTransforms(world, nodeId));
    state = stateOut;
    nodeEvals.push({
      nodeId,
      title: n.title,
      timeIndex: n.timeIndex,
      reachProbability,
      stateIn,
      stateOut,
      contributionPct: nodeContribution(stateIn, stateOut),
    });
  }

  return { nodeEvals, finalState: state };
}

function auditCoherence(
  world: World,
  nodeIds: Set<string>,
  returns: Record<string, number>,
): EvalResult["coherence"] {
  const target = world.hypothesis.eventB?.trim();
  if (!target || world.hypothesis.mode !== "audit") return null;

  const hayTarget = target.toLowerCase();
  const tokens = hayTarget.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const activeNodes = eventNodes(world).filter((n) => nodeIds.has(n.id));
  const match = activeNodes.find((n) => {
    const hay = `${n.title} ${n.mechanism}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });

  const weakest = [...activeNodes].sort((a, b) => a.pConditional - b.pConditional)[0] ?? null;
  const dir = claimedDirection(hayTarget);
  const returnsMap = new Map(Object.entries(returns));
  const assetHit = CLAIM_ASSETS.map((a) => ({ ...a, r: returnsMap.get(a.symbol) ?? 0 })).find(
    (a) => a.re.test(hayTarget) && dir !== 0 && Math.sign(a.r) === dir && Math.abs(a.r) >= 1,
  );

  if (!match && !assetHit) {
    return {
      connected: false,
      weakestNodeId: weakest?.id ?? null,
      note: `No active hop clearly realizes “${target}”. The chain may be correlational, mistimed, or the wrong sign.`,
    };
  }

  const via = match
    ? `A path to “${match.title}” exists`
    : `The live tape agrees: ${assetHit!.symbol} ${assetHit!.r >= 0 ? "+" : ""}${assetHit!.r.toFixed(0)}%`;

  return {
    connected: true,
    weakestNodeId: weakest?.id ?? null,
    note: weakest
      ? `${via}. Weakest hop: ${weakest.title} (${Math.round(weakest.pConditional * 100)}% · ${weakest.confidence} confidence).`
      : `${via} on this path.`,
  };
}

function evalPathCore(world: World, path: DagPath, thesis: Thesis): { pnlPct: number; nodeEvals: NodeEval[]; finalState: BookState } {
  const { nodeEvals, finalState } = runPathPipeline(world, path.nodeIds, thesis, path.probability);
  return { pnlPct: scoreBook(finalState).pnl, nodeEvals, finalState };
}

function buildStops(
  world: World,
  timeline: Timeline | undefined,
  thesis: Thesis,
  basePnl: number,
): ForkWatch[] {
  const stops: ForkWatch[] = [];
  const groups = new Set(eventNodes(world).map((n) => n.forkGroupId));
  const assignment = timeline?.assignment ?? {};

  for (const g of groups) {
    const members = forkGroupMembers(world, g);
    if (members.length < 2) continue;
    for (const alt of members) {
      if (assignment[g] === alt.id) continue;
      const hypothetical: Timeline = {
        id: `${timeline?.id ?? "path"}~${alt.id}`,
        label: alt.title,
        assignment: { ...assignment, [g]: alt.id },
      };
      const path = timelineToPath(world, hypothetical);
      if (!path) continue;
      const altPnl = evalPathCore(world, path, thesis).pnlPct;
      if (altPnl <= STOP_THRESHOLD && altPnl < basePnl - 0.5) {
        stops.push({
          nodeId: alt.id,
          title: alt.title,
          pnlIfRealized: altPnl,
          probability: path.probability,
        });
      }
    }
  }
  return stops;
}

function toContributions(nodeEvals: NodeEval[]): NodeContribution[] {
  return nodeEvals
    .map((n) => ({ nodeId: n.nodeId, title: n.title, contributionPct: n.contributionPct }))
    .sort((a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct));
}

export function evalPathWithThesis(world: World, path: DagPath, thesis: Thesis = world.thesis): EvalResult {
  const { nodeEvals, finalState } = runPathPipeline(world, path.nodeIds, thesis, path.probability);
  const { pnl, bySymbol } = scoreBook(finalState);
  const contributions = toContributions(nodeEvals);

  return {
    mode: "path",
    timelineId: path.id,
    pathProbability: path.probability,
    pnlPct: pnl,
    bySymbol,
    nodeEvals,
    nodeContributions: contributions,
    stops: buildStops(world, undefined, thesis, pnl),
    takeProfits: contributions.filter((c) => c.contributionPct >= 1.5),
    coherence: auditCoherence(world, new Set(path.nodeIds), finalState.cumulativeReturns),
  };
}

export function evalTimelineWithThesis(
  world: World,
  timeline: Timeline,
  thesis: Thesis = world.thesis,
): EvalResult {
  const path = timelineToPath(world, timeline);
  if (!path) {
    return {
      mode: "path",
      timelineId: timeline.id,
      pathProbability: 0,
      pnlPct: 0,
      bySymbol: [],
      nodeEvals: [],
      nodeContributions: [],
      stops: [],
      takeProfits: [],
      coherence: null,
    };
  }
  const { nodeEvals, finalState } = runPathPipeline(world, path.nodeIds, thesis, path.probability);
  const { pnl, bySymbol } = scoreBook(finalState);
  const contributions = toContributions(nodeEvals);

  return {
    mode: "path",
    timelineId: timeline.id,
    pathProbability: path.probability,
    pnlPct: pnl,
    bySymbol,
    nodeEvals,
    nodeContributions: contributions,
    stops: buildStops(world, timeline, thesis, pnl),
    takeProfits: contributions.filter((c) => c.contributionPct >= 1.5),
    coherence: auditCoherence(world, new Set(path.nodeIds), finalState.cumulativeReturns),
  };
}

export function evalExpectedWithThesis(world: World, thesis: Thesis = world.thesis): EvalResult {
  const marginal = marginalReachProbabilities(world);
  const nodeEvals: NodeEval[] = [];
  const stateOutByNode = new Map<string, BookState>();

  for (const n of topologicalOrder(world)) {
    const parents = incomingEdges(world, n.id);
    let stateIn: BookState;
    if (!parents.length) {
      stateIn = initialBookState(thesis);
    } else {
      stateIn = blendBookStates(
        parents.map((e) => ({
          state: stateOutByNode.get(e.from) ?? initialBookState(thesis),
          weight: (marginal.get(e.from) ?? 0) * e.probability,
        })),
      );
    }
    const stateOut = applyNodeTransform(stateIn, nodeTransforms(world, n.id));
    stateOutByNode.set(n.id, stateOut);
    nodeEvals.push({
      nodeId: n.id,
      title: n.title,
      timeIndex: n.timeIndex,
      reachProbability: marginal.get(n.id) ?? 0,
      stateIn,
      stateOut,
      contributionPct: nodeContribution(stateIn, stateOut) * (marginal.get(n.id) ?? 0),
    });
  }

  const paths = enumeratePaths(world);
  let expectedPnl = 0;
  for (const path of paths) {
    const { finalState } = runPathPipeline(world, path.nodeIds, thesis, path.probability);
    expectedPnl += path.probability * scoreBook(finalState).pnl;
  }

  const finalBlend = blendBookStates(
    [...stateOutByNode.entries()].map(([id, state]) => ({
      state,
      weight: marginal.get(id) ?? 0,
    })),
  );
  const { bySymbol } = scoreBook(finalBlend);
  const contributions = toContributions(nodeEvals);

  return {
    mode: "expected",
    timelineId: EXPECTED_PATH_ID,
    pnlPct: expectedPnl,
    bySymbol,
    nodeEvals,
    nodeContributions: contributions,
    stops: buildStops(world, timelineById(world), thesis, expectedPnl),
    takeProfits: contributions.filter((c) => c.contributionPct >= 1.5),
    coherence: auditCoherence(
      world,
      new Set(eventNodes(world).map((n) => n.id)),
      finalBlend.cumulativeReturns,
    ),
  };
}

export function evalTimeline(world: World, timeline: Timeline): EvalResult {
  return evalTimelineWithThesis(world, timeline, world.thesis);
}

export function evalWorld(world: World): Record<string, EvalResult> {
  const out: Record<string, EvalResult> = {};
  out[EXPECTED_PATH_ID] = evalExpectedWithThesis(world);
  for (const t of world.timelines) out[t.id] = evalTimeline(world, t);
  return out;
}

export function evalActive(world: World, thesis?: Thesis): EvalResult {
  if (world.activeTimelineId === EXPECTED_PATH_ID) {
    return evalExpectedWithThesis(world, thesis ?? world.thesis);
  }
  const timeline = timelineById(world, world.activeTimelineId);
  if (!timeline) return evalExpectedWithThesis(world, thesis ?? world.thesis);
  return evalTimelineWithThesis(world, timeline, thesis ?? world.thesis);
}

export function suggestThesisFromEval(world: World, timelineId?: string): Thesis {
  const tid = timelineId ?? world.activeTimelineId;
  const ev =
    tid === EXPECTED_PATH_ID
      ? evalExpectedWithThesis(world)
      : evalTimelineWithThesis(world, timelineById(world, tid)!);
  const returns = new Map<string, number>();
  for (const n of ev.nodeEvals) {
    for (const [sym, r] of Object.entries(n.stateOut.cumulativeReturns)) {
      returns.set(sym, (returns.get(sym) ?? 0) + r * n.reachProbability);
    }
  }
  const ranked = [...returns.entries()]
    .filter(([, r]) => Math.abs(r) >= 1)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  if (!ranked.length) return { legs: [], horizonDays: 21 };
  const mag = ranked.reduce((s, [, r]) => s + Math.abs(r), 0);
  const legsDesc = ranked.map(([sym, r]) => `${r < 0 ? "short" : "long"} ${sym}`).join(", ");
  return normalizeThesis({
    narrative: `Express the chain: ${legsDesc}.`,
    horizonDays: 21,
    legs: ranked.map(([symbol, r]) => ({
      symbol,
      side: r >= 0 ? "long" : "short",
      weight: Math.abs(r) / mag,
    })),
  });
}

export type ComparedPath = {
  id: string;
  label: string;
  active: boolean;
  pnlPct: number;
  pathProbability?: number;
  deltaVsActive: number;
  bySymbol: SymbolPnl[];
  coherence: EvalResult["coherence"];
};

export function nwayCompare(world: World, evals: Record<string, EvalResult>) {
  const activePnl = evals[world.activeTimelineId]?.pnlPct ?? 0;
  const paths: ComparedPath[] = [];
  const ids = [EXPECTED_PATH_ID, ...registeredIdsOf(world)];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const ev = evals[id];
    if (!ev) continue;
    const label =
      id === EXPECTED_PATH_ID ? "Expected (weighted)" : (world.timelines.find((t) => t.id === id)?.label ?? id);
    paths.push({
      id,
      label,
      active: id === world.activeTimelineId,
      pnlPct: ev.pnlPct,
      pathProbability: ev.pathProbability,
      deltaVsActive: ev.pnlPct - activePnl,
      bySymbol: ev.bySymbol,
      coherence: ev.coherence,
    });
  }
  const pnls = paths.map((p) => p.pnlPct);
  const spreadPct = pnls.length ? Math.max(...pnls) - Math.min(...pnls) : 0;
  const best = paths.reduce<ComparedPath | null>((a, p) => (!a || p.pnlPct > a.pnlPct ? p : a), null);
  const worst = paths.reduce<ComparedPath | null>((a, p) => (!a || p.pnlPct < a.pnlPct ? p : a), null);
  const symbols = [...new Set(paths.flatMap((p) => p.bySymbol.map((s) => s.symbol)))];
  return { paths, symbols, spreadPct, bestId: best?.id ?? null, worstId: worst?.id ?? null };
}
