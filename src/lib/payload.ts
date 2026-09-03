import type { EvalResult, WorldPayload } from "./types";
import { EXPECTED_PATH_ID } from "./types";

export function pickActiveEval(payload: WorldPayload | null | undefined): EvalResult | undefined {
  if (!payload?.world || !payload.evals) return undefined;
  const { world, evals } = payload;
  return (
    evals[world.activeTimelineId] ??
    evals[world.timelines[0]?.id ?? ""] ??
    evals[EXPECTED_PATH_ID] ??
    Object.values(evals)[0]
  );
}
