import { NextResponse } from "next/server";
import { z } from "zod";
import { evalWorld } from "@/lib/eval";
import { normalizeThesis, replaceThesis } from "@/lib/graph";
import { getWorld, saveWorld } from "@/lib/store";

const Body = z.object({
  horizonDays: z.number().optional(),
  narrative: z.string().optional(),
  legs: z.array(
    z.object({
      symbol: z.string(),
      side: z.enum(["long", "short"]),
      weight: z.number(),
    }),
  ),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const thesis = normalizeThesis(Body.parse(await req.json()));
  const next = saveWorld(replaceThesis(world, thesis));
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
