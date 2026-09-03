import { NextResponse } from "next/server";
import { evalWorld } from "@/lib/eval";
import { getWorld } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ world, evals: evalWorld(world) });
}
