import { NextResponse } from "next/server";
import { z } from "zod";
import { evalWorld, forkWorld } from "@/lib/generate";
import { getWorld, saveWorld } from "@/lib/store";

const Body = z.object({
  nodeId: z.string(),
  counterfactual: z.string().min(2),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { nodeId, counterfactual } = Body.parse(await req.json());
  const next = saveWorld(forkWorld(world, nodeId, counterfactual));
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
