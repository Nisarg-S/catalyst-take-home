import type { StrategyImpact, StrategySuggestion, Thesis, WorldPayload, WorldSummary } from "./types";

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export async function listWorlds(): Promise<WorldSummary[]> {
  const data = await parse<{ worlds: WorldSummary[] }>(await fetch("/api/worlds"));
  return data.worlds;
}

export async function createWorld(body: {
  mode: "explore" | "audit";
  eventA: string;
  eventB?: string;
  thesis?: Thesis;
}): Promise<WorldPayload> {
  return parse(
    await fetch("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getWorld(id: string): Promise<WorldPayload> {
  return parse(await fetch(`/api/worlds/${id}`));
}

export async function putThesis(id: string, thesis: Thesis): Promise<WorldPayload> {
  return parse(
    await fetch(`/api/worlds/${id}/thesis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thesis),
    }),
  );
}

export async function forkWorld(
  id: string,
  nodeId: string,
  counterfactual: string,
): Promise<WorldPayload> {
  return parse(
    await fetch(`/api/worlds/${id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, counterfactual }),
    }),
  );
}

export async function suggestThesis(id: string, timelineId?: string): Promise<WorldPayload> {
  const q = timelineId ? `?timelineId=${encodeURIComponent(timelineId)}` : "";
  return parse(await fetch(`/api/worlds/${id}/suggest-thesis${q}`, { method: "POST" }));
}

export async function activateTimeline(id: string, timelineId: string): Promise<WorldPayload> {
  return parse(await fetch(`/api/worlds/${id}/timelines/${timelineId}`, { method: "POST" }));
}

export async function registerPath(
  id: string,
  timelineId: string,
  on: boolean,
): Promise<WorldPayload> {
  return parse(
    await fetch(`/api/worlds/${id}/timelines/${timelineId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    }),
  );
}

export async function registerAllPaths(id: string): Promise<WorldPayload> {
  return parse(await fetch(`/api/worlds/${id}/register-all`, { method: "POST" }));
}

export async function previewStrategy(
  id: string,
  narrative: string,
  timelineId?: string,
): Promise<StrategyImpact> {
  return parse(
    await fetch(`/api/worlds/${id}/strategy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative, timelineId }),
    }),
  );
}

export async function fetchStrategySuggestions(
  id: string,
  timelineId?: string,
): Promise<StrategySuggestion[]> {
  const q = timelineId ? `?timelineId=${encodeURIComponent(timelineId)}` : "";
  const data = await parse<{ suggestions: StrategySuggestion[] }>(
    await fetch(`/api/worlds/${id}/strategy${q}`),
  );
  return data.suggestions;
}
