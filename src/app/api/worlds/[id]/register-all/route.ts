import { NextResponse } from "next/server";
import { evalWorld, registerAllPaths } from "@/lib/generate";
import { getWorld, saveWorld } from "@/lib/store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const next = saveWorld(registerAllPaths(world));
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
