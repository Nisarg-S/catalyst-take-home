import { activeEventIds, causesEdges, eventNodes, isNodeActive, nodeTransforms, registeredIdsOf, timelineById } from "./graph";
import { EXPECTED_PATH_ID } from "./types";
import type { EventNode, World } from "./types";

export const CARD_W = 248;
export const CARD_H = 158;
export const THESIS_W = 260;
export const THESIS_H = 158;
export const GAP_X = 88;
export const GAP_Y = 36;
export const PAD = 48;

export type PathRole = "live" | "registered" | "ghost";

export type LaidNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  ghost: boolean;
  role: PathRole;
  kind: "event" | "thesis";
};

export type LaidEdge = {
  id: string;
  from: string;
  to: string;
  kind: "causes" | "impacts";
  label?: string;
  probability?: number;
  ghost: boolean;
  role: PathRole;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type GraphLayout = {
  nodes: LaidNode[];
  edges: LaidEdge[];
  width: number;
  height: number;
};

function layersFor(world: World): Map<string, number> {
  const layer = new Map<string, number>();
  const events = eventNodes(world);
  const byId = new Map(events.map((n) => [n.id, n]));
  const preds = new Map<string, string[]>();
  for (const n of events) preds.set(n.id, []);
  for (const e of causesEdges(world)) {
    preds.get(e.to)?.push(e.from);
  }

  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = (preds.get(id) ?? []).filter((p) => byId.has(p));
    const l = ps.length ? 1 + Math.max(...ps.map(visit)) : 0;
    visiting.delete(id);
    layer.set(id, l);
    return l;
  };
  for (const n of events) visit(n.id);
  return layer;
}

export function layoutWorld(world: World, timelineId?: string): GraphLayout {
  const tid = timelineId ?? world.activeTimelineId;
  const isExpected = tid === EXPECTED_PATH_ID;
  const timeline = isExpected ? undefined : timelineById(world, tid);
  const registered = registeredIdsOf(world)
    .map((id) => world.timelines.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const registeredNodeIds = new Set<string>();
  for (const t of registered) {
    for (const id of activeEventIds(world, t)) registeredNodeIds.add(id);
  }
  const liveIds = isExpected
    ? new Set(eventNodes(world).map((n) => n.id))
    : timeline
      ? activeEventIds(world, timeline)
      : new Set<string>();

  const roleOf = (id: string): PathRole => {
    if (liveIds.has(id)) return isExpected ? "live" : "live";
    if (registeredNodeIds.has(id)) return "registered";
    return "ghost";
  };
  const events = eventNodes(world);
  const layerOf = layersFor(world);
  const maxLayer = Math.max(0, ...layerOf.values());
  const thesisLayer = maxLayer + 1;

  const byLayer = new Map<number, EventNode[]>();
  for (const n of events) {
    const l = layerOf.get(n.id) ?? n.timeIndex ?? 0;
    const list = byLayer.get(l) ?? [];
    list.push(n);
    byLayer.set(l, list);
  }
  for (const [, list] of byLayer) {
    list.sort((a, b) => {
      const ag = a.forkGroupId.localeCompare(b.forkGroupId);
      if (ag) return ag;
      if (timeline) {
        const aActive = isNodeActive(a, timeline) ? 0 : 1;
        const bActive = isNodeActive(b, timeline) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
      }
      return a.horizonDays - b.horizonDays || a.title.localeCompare(b.title);
    });
  }

  const colHeights: number[] = [];
  for (let l = 0; l <= maxLayer; l++) {
    const count = byLayer.get(l)?.length ?? 0;
    colHeights.push(PAD * 2 + count * CARD_H + Math.max(0, count - 1) * GAP_Y);
  }
  const thesisHeight = PAD * 2 + THESIS_H;
  const height = Math.max(thesisHeight, ...colHeights, 420);

  const laid: LaidNode[] = [];
  for (let l = 0; l <= maxLayer; l++) {
    const list = byLayer.get(l) ?? [];
    const colH = list.length * CARD_H + Math.max(0, list.length - 1) * GAP_Y;
    let y = (height - colH) / 2;
    for (const n of list) {
      laid.push({
        id: n.id,
        x: PAD + l * (CARD_W + GAP_X),
        y,
        w: CARD_W,
        h: CARD_H,
        layer: l,
        role: roleOf(n.id),
        ghost: roleOf(n.id) === "ghost",
        kind: "event",
      });
      y += CARD_H + GAP_Y;
    }
  }

  const thesisY = (height - THESIS_H) / 2;
  laid.push({
    id: "thesis",
    x: PAD + thesisLayer * (CARD_W + GAP_X),
    y: thesisY,
    w: THESIS_W,
    h: THESIS_H,
    layer: thesisLayer,
    ghost: false,
    role: "live",
    kind: "thesis",
  });

  const byLaid = new Map(laid.map((n) => [n.id, n]));
  const edges: LaidEdge[] = [];

  const port = (n: LaidNode, side: "out" | "in") => ({
    x: side === "out" ? n.x + n.w : n.x,
    y: n.y + n.h / 2,
  });

  for (const e of causesEdges(world)) {
    const a = byLaid.get(e.from);
    const b = byLaid.get(e.to);
    if (!a || !b) continue;
    const p1 = port(a, "out");
    const p2 = port(b, "in");
    const role: PathRole =
      a.role === "live" && b.role === "live"
        ? "live"
        : a.role !== "ghost" && b.role !== "ghost"
          ? "registered"
          : "ghost";
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      kind: "causes",
      label: e.label,
      probability: e.probability,
      ghost: role === "ghost",
      role,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
    });
  }

  for (const n of events) {
    const transforms = nodeTransforms(world, n.id);
    if (!transforms.length) continue;
    const a = byLaid.get(n.id);
    const b = byLaid.get("thesis");
    if (!a || !b) continue;
    const p1 = port(a, "out");
    const p2 = port(b, "in");
    const role: PathRole = a.role === "ghost" ? "ghost" : a.role;
    edges.push({
      id: `impact_${n.id}`,
      from: n.id,
      to: "thesis",
      kind: "impacts",
      ghost: role === "ghost",
      role,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
    });
  }

  const width = PAD + thesisLayer * (CARD_W + GAP_X) + THESIS_W + PAD;
  return { nodes: laid, edges, width, height };
}

export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, (x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
