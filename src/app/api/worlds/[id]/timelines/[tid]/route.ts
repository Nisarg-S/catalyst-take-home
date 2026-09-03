import { NextResponse } from "next/server";
import { evalWorld, activateTimeline } from "@/lib/generate";
import { getWorld, saveWorld } from "@/lib/store";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const next = saveWorld(activateTimeline(world, tid));
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
