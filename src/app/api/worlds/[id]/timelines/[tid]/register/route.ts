import { NextResponse } from "next/server";
import { z } from "zod";
import { evalWorld, registerPath } from "@/lib/generate";
import { getWorld, saveWorld } from "@/lib/store";

const Body = z.object({ on: z.boolean() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { on } = Body.parse(await req.json());
  try {
    const next = saveWorld(registerPath(world, tid, on));
    return NextResponse.json({ world: next, evals: evalWorld(next) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "register failed" },
      { status: 400 },
    );
  }
}
