import { NextResponse } from "next/server";
import { z } from "zod";
import { explainParsedStrategy, suggestStrategiesFromChain } from "@/lib/strategy";
import { getWorld } from "@/lib/store";

const Body = z.object({
  narrative: z.string().min(3),
  timelineId: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { narrative, timelineId } = Body.parse(await req.json());
  const impact = explainParsedStrategy(world, narrative, timelineId ?? world.activeTimelineId);
  return NextResponse.json(impact);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const world = getWorld(id);
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const timelineId = url.searchParams.get("timelineId") ?? world.activeTimelineId;
  const suggestions = suggestStrategiesFromChain(world, timelineId);
  return NextResponse.json({ suggestions });
}
