import { NextResponse } from "next/server";
import { evalWorld, suggestThesisFromEval } from "@/lib/eval";
import { replaceThesis } from "@/lib/graph";
import { getWorld, saveWorld } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const timelineId = url.searchParams.get("timelineId") ?? world.activeTimelineId;
  const next = saveWorld(replaceThesis(world, suggestThesisFromEval(world, timelineId)));
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
