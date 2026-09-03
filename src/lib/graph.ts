import type {
  BookState,
  CausesEdge,
  DagPath,
  EventNode,
  ImpactEdge,
  NodeTransform,
  Thesis,
  Timeline,
  World,
} from "./types";
import { EXPECTED_PATH_ID } from "./types";

export function eventNodes(world: World): EventNode[] {
  return world.nodes.filter((n): n is EventNode => n.kind === "event");
}

export function eventNode(world: World, id: string): EventNode | undefined {
  const n = world.nodes.find((x) => x.id === id);
  return n?.kind === "event" ? n : undefined;
}

export function causesEdges(world: World): CausesEdge[] {
  return world.edges.filter((e): e is CausesEdge => e.kind === "causes");
}

/** @deprecated Legacy impact edges — prefer EventNode.transforms */
export function impactEdges(world: World): ImpactEdge[] {
  return world.edges.filter((e): e is ImpactEdge => e.kind === "impacts");
}

export function nodeTransforms(world: World, nodeId: string): NodeTransform[] {
  const n = eventNode(world, nodeId);
  if (n?.transforms?.length) return n.transforms;
  return impactEdges(world)
    .filter((e) => e.from === nodeId)
    .map((e) => ({ symbol: e.symbol, assetReturnPct: e.assetReturnPct }));
}

export function parentsOf(world: World, nodeId: string): string[] {
  return causesEdges(world)
    .filter((e) => e.to === nodeId)
    .map((e) => e.from);
}

export function childrenOf(world: World, nodeId: string): string[] {
  return causesEdges(world)
    .filter((e) => e.from === nodeId)
    .map((e) => e.to);
}

export function incomingEdges(world: World, nodeId: string): CausesEdge[] {
  return causesEdges(world).filter((e) => e.to === nodeId);
}

export function outgoingEdges(world: World, nodeId: string): CausesEdge[] {
  return causesEdges(world).filter((e) => e.from === nodeId);
}

export function roots(world: World): EventNode[] {
  const incoming = new Set(causesEdges(world).map((e) => e.to));
  return eventNodes(world).filter((n) => !incoming.has(n.id));
}

export function timelineById(world: World, id = world.activeTimelineId): Timeline | undefined {
  if (id === "__expected__") return undefined;
  return world.timelines.find((t) => t.id === id) ?? world.timelines[0];
}

export function isNodeActive(node: EventNode, timeline: Timeline): boolean {
  const chosen = timeline.assignment[node.forkGroupId];
  return !chosen || chosen === node.id;
}

export function activeEventIds(world: World, timeline: Timeline): Set<string> {
  const active = new Set<string>();
  const nodes = eventNodes(world);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const start = roots(world).filter((n) => isNodeActive(n, timeline));
  const queue = [...start];
  for (const n of start) active.add(n.id);

  while (queue.length) {
    const cur = queue.shift()!;
    for (const cid of childrenOf(world, cur.id)) {
      const child = byId.get(cid);
      if (!child || active.has(cid)) continue;
      if (!isNodeActive(child, timeline)) continue;
      active.add(cid);
      queue.push(child);
    }
  }
  return active;
}

export function forkGroupMembers(world: World, forkGroupId: string): EventNode[] {
  return eventNodes(world).filter((n) => n.forkGroupId === forkGroupId);
}

export function defaultAssignment(nodes: EventNode[]): Record<string, string> {
  const assignment: Record<string, string> = {};
  for (const n of nodes) {
    if (!(n.forkGroupId in assignment)) assignment[n.forkGroupId] = n.id;
  }
  return assignment;
}

export function thesisLabel(thesis: Thesis): string {
  if (thesis.narrative?.trim()) {
    const s = thesis.narrative.trim();
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  if (!thesis.legs.length) return "No strategy";
  return thesis.legs
    .map((l) => `${l.side === "short" ? "−" : "+"}${l.symbol} ${Math.round(l.weight * 100)}%`)
    .join("  ");
}

export function normalizeThesis(thesis: Thesis): Thesis {
  const legs = thesis.legs
    .map((l) => ({
      symbol: l.symbol.trim().toUpperCase(),
      side: l.side,
      weight: l.weight,
    }))
    .filter((l) => l.symbol && l.weight > 0);
  const sum = legs.reduce((s, l) => s + l.weight, 0);
  if (sum <= 0) return { ...thesis, legs: [] };
  const normalized = legs.map((l) => ({ ...l, weight: l.weight / sum }));
  return {
    ...thesis,
    legs: normalized.map((l, i) => {
      if (i < normalized.length - 1) return { ...l, weight: Math.round(l.weight * 100) / 100 };
      const used = normalized
        .slice(0, -1)
        .reduce((s, x) => s + Math.round(x.weight * 100) / 100, 0);
      return { ...l, weight: Math.round((1 - used) * 100) / 100 };
    }),
  };
}

export function hasThesis(world: World) {
  return world.thesis.legs.length > 0;
}

export function replaceThesis(world: World, thesis: Thesis): World {
  return {
    ...world,
    thesis: normalizeThesis(thesis),
    updatedAt: new Date().toISOString(),
  };
}

export const MAX_REGISTERED = 8;

export function knownTimelineIds(world: World): Set<string> {
  return new Set(world.timelines.map((t) => t.id));
}

export function registeredIdsOf(world: World): string[] {
  const known = knownTimelineIds(world);
  return (world.registeredIds ?? []).filter((id) => known.has(id));
}

export function nodeOnTimeline(world: World, node: EventNode, timeline: Timeline): boolean {
  return isNodeActive(node, timeline) && activeEventIds(world, timeline).has(node.id);
}

export function topologicalOrder(world: World): EventNode[] {
  const layer = new Map<string, number>();
  const nodes = eventNodes(world);
  const preds = new Map<string, string[]>();
  for (const n of nodes) preds.set(n.id, []);
  for (const e of causesEdges(world)) preds.get(e.to)?.push(e.from);

  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = preds.get(id) ?? [];
    const l = ps.length ? 1 + Math.max(...ps.map(visit)) : 0;
    visiting.delete(id);
    layer.set(id, l);
    return l;
  };
  for (const n of nodes) visit(n.id);

  return [...nodes].sort(
    (a, b) =>
      (layer.get(a.id) ?? 0) - (layer.get(b.id) ?? 0) ||
      a.horizonDays - b.horizonDays ||
      a.title.localeCompare(b.title),
  );
}

export function computeTimeIndices(world: World): Map<string, number> {
  const order = topologicalOrder(world);
  const idx = new Map<string, number>();
  order.forEach((n, i) => idx.set(n.id, i));
  return idx;
}

function normalizeSiblingProbabilities(edges: CausesEdge[]): CausesEdge[] {
  const byParent = new Map<string, CausesEdge[]>();
  for (const e of edges) {
    const list = byParent.get(e.from) ?? [];
    list.push(e);
    byParent.set(e.from, list);
  }

  const scaled = edges.map((e) => {
    const siblings = byParent.get(e.from) ?? [e];
    if (siblings.length <= 1) {
      return { ...e, probability: 1 };
    }
    const sum = siblings.reduce((s, x) => s + Math.max(0, x.probability), 0);
    const denom = sum > 0 ? sum : siblings.length;
    return { ...e, probability: Math.max(0, e.probability) / denom };
  });

  // Round and force exact sum = 1 per parent fork
  for (const [, siblings] of byParent) {
    if (siblings.length <= 1) continue;
    const ids = siblings.map((s) => s.id);
    let used = 0;
    for (let i = 0; i < ids.length - 1; i++) {
      const idx = scaled.findIndex((e) => e.id === ids[i]);
      if (idx < 0) continue;
      const p = Math.round(scaled[idx].probability * 1000) / 1000;
      scaled[idx] = { ...scaled[idx], probability: p };
      used += p;
    }
    const lastIdx = scaled.findIndex((e) => e.id === ids[ids.length - 1]);
    if (lastIdx >= 0) {
      scaled[lastIdx] = { ...scaled[lastIdx], probability: Math.round((1 - used) * 1000) / 1000 };
    }
  }

  return scaled;
}

/** Ensure every parent's outgoing edges sum to exactly 1 */
export function normalizeWorldEdges(edges: CausesEdge[]): CausesEdge[] {
  return normalizeSiblingProbabilities(edges);
}

export function withNormalizedEdges(world: World): World {
  return { ...world, edges: normalizeWorldEdges(causesEdges(world)) };
}

function migrateEdgeProbabilities(world: World): World {
  const causes = causesEdges(world).map((e) => ({
    ...e,
    probability: typeof e.probability === "number" ? e.probability : 0,
  }));
  return { ...world, edges: normalizeWorldEdges(causes) };
}

function migrateImpactsToTransforms(world: World): World {
  const nodes = world.nodes.map((n) => {
    if (n.kind !== "event") return n;
    const transforms =
      n.transforms?.length
        ? n.transforms
        : impactEdges(world)
            .filter((e) => e.from === n.id)
            .map((e) => ({ symbol: e.symbol, assetReturnPct: e.assetReturnPct }));
    return { ...n, transforms, timeIndex: n.timeIndex ?? 0 };
  });
  const edges = world.edges.filter((e) => e.kind !== "impacts");
  return { ...world, nodes, edges };
}

function migrateTimeIndices(world: World): World {
  const indices = computeTimeIndices(world);
  return {
    ...world,
    nodes: world.nodes.map((n) =>
      n.kind === "event" ? { ...n, timeIndex: indices.get(n.id) ?? n.timeIndex ?? 0 } : n,
    ),
  };
}

/** Upgrade legacy worlds to weighted DAG shape */
export function migrateWorld(raw: World): World {
  let world = raw;
  if (world.registeredIds === undefined) {
    world = { ...world, registeredIds: world.timelines.map((t) => t.id) };
  } else {
    world = { ...world, registeredIds: registeredIdsOf(world) };
  }
  world = migrateImpactsToTransforms(world);
  world = migrateEdgeProbabilities(world);
  world = migrateTimeIndices(world);

  const timelineIds = new Set(world.timelines.map((t) => t.id));
  if (
    world.activeTimelineId !== EXPECTED_PATH_ID &&
    !timelineIds.has(world.activeTimelineId)
  ) {
    world = {
      ...world,
      activeTimelineId: world.timelines[0]?.id ?? EXPECTED_PATH_ID,
    };
  }

  return world;
}

export function initialBookState(thesis: Thesis): BookState {
  return {
    legs: thesis.legs.map((l) => ({ ...l })),
    cumulativeReturns: {},
  };
}

export function cloneBookState(state: BookState): BookState {
  return {
    legs: state.legs.map((l) => ({ ...l })),
    cumulativeReturns: { ...state.cumulativeReturns },
  };
}

export function applyNodeTransform(state: BookState, transforms: NodeTransform[]): BookState {
  const next = cloneBookState(state);
  for (const t of transforms) {
    next.cumulativeReturns[t.symbol] = (next.cumulativeReturns[t.symbol] ?? 0) + t.assetReturnPct;
  }
  return next;
}

export function blendBookStates(items: { state: BookState; weight: number }[]): BookState {
  if (!items.length) return { legs: [], cumulativeReturns: {} };
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return cloneBookState(items[0].state);
  const cumulativeReturns: Record<string, number> = {};
  for (const { state, weight } of items) {
    for (const [sym, r] of Object.entries(state.cumulativeReturns)) {
      cumulativeReturns[sym] = (cumulativeReturns[sym] ?? 0) + (weight / total) * r;
    }
  }
  return { legs: items[0].state.legs.map((l) => ({ ...l })), cumulativeReturns };
}

export function scoreBook(state: BookState): {
  pnl: number;
  bySymbol: { symbol: string; assetReturnPct: number; contributionPct: number }[];
} {
  const bySymbol: { symbol: string; assetReturnPct: number; contributionPct: number }[] = [];
  let pnl = 0;
  for (const leg of state.legs) {
    const assetReturnPct = state.cumulativeReturns[leg.symbol] ?? 0;
    const sign = leg.side === "long" ? 1 : -1;
    const contributionPct = sign * leg.weight * assetReturnPct;
    pnl += contributionPct;
    bySymbol.push({ symbol: leg.symbol, assetReturnPct, contributionPct });
  }
  return { pnl, bySymbol };
}

export function marginalReachProbabilities(world: World): Map<string, number> {
  const marginal = new Map<string, number>();
  for (const r of roots(world)) marginal.set(r.id, 1);
  for (const n of topologicalOrder(world)) {
    if (marginal.has(n.id)) continue;
    let p = 0;
    for (const e of incomingEdges(world, n.id)) {
      p += (marginal.get(e.from) ?? 0) * e.probability;
    }
    marginal.set(n.id, p);
  }
  return marginal;
}

export function pathProbability(world: World, nodeIds: string[]): number {
  if (!nodeIds.length) return 0;
  for (let i = 1; i < nodeIds.length; i++) {
    const edge = causesEdges(world).find((e) => e.from === nodeIds[i - 1] && e.to === nodeIds[i]);
    if (!edge) return 0;
  }
  let p = 1;
  for (let i = 1; i < nodeIds.length; i++) {
    const edge = causesEdges(world).find((e) => e.from === nodeIds[i - 1] && e.to === nodeIds[i])!;
    p *= edge.probability;
  }
  return p;
}

export function enumeratePaths(world: World): DagPath[] {
  const paths: DagPath[] = [];
  const byId = new Map(eventNodes(world).map((n) => [n.id, n]));

  function walk(nodeId: string, soFar: string[], prob: number) {
    const next = [...soFar, nodeId];
    const children = outgoingEdges(world, nodeId);
    if (!children.length) {
      const label = next.map((id) => byId.get(id)?.title.split(" ").slice(0, 3).join(" ") ?? id).join(" → ");
      paths.push({
        id: `path_${next.join("_")}`,
        label: label.length > 72 ? `${label.slice(0, 69)}…` : label,
        nodeIds: next,
        probability: prob,
      });
      return;
    }
    for (const edge of children) walk(edge.to, next, prob * edge.probability);
  }

  for (const root of roots(world)) walk(root.id, [], 1);
  return paths.sort((a, b) => b.probability - a.probability);
}

export function timelineToPath(world: World, timeline: Timeline): DagPath | null {
  const active = activeEventIds(world, timeline);
  const ordered = topologicalOrder(world).filter((n) => active.has(n.id)).map((n) => n.id);
  if (!ordered.length) return null;
  return {
    id: timeline.id,
    label: timeline.label,
    nodeIds: ordered,
    probability: pathProbability(world, ordered),
  };
}

export function pathStepsForTimeline(
  world: World,
  timelineId: string,
): { nodeIds: string[]; edgeIds: string[]; label: string; probability: number } | null {
  const timeline = world.timelines.find((t) => t.id === timelineId);
  if (!timeline) return null;
  const path = timelineToPath(world, timeline);
  if (!path) return null;
  const edgeIds: string[] = [];
  for (let i = 1; i < path.nodeIds.length; i++) {
    const edge = causesEdges(world).find(
      (e) => e.from === path.nodeIds[i - 1] && e.to === path.nodeIds[i],
    );
    if (edge) edgeIds.push(edge.id);
  }
  return { nodeIds: path.nodeIds, edgeIds, label: path.label, probability: path.probability };
}

export function renormalizeOutgoing(edges: CausesEdge[]): CausesEdge[] {
  return normalizeWorldEdges(edges);
}
