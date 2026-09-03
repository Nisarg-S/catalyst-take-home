import { NextResponse } from "next/server";
import { z } from "zod";
import { createWorld } from "@/lib/generate";
import { evalWorld } from "@/lib/eval";
import { listWorlds, saveWorld } from "@/lib/store";
import { normalizeThesis } from "@/lib/graph";

const Create = z.object({
  mode: z.enum(["explore", "audit"]).default("explore"),
  eventA: z.string().min(3),
  eventB: z.string().optional(),
  thesis: z
    .object({
      horizonDays: z.number().optional(),
      legs: z.array(
        z.object({
          symbol: z.string(),
          side: z.enum(["long", "short"]),
          weight: z.number(),
        }),
      ),
    })
    .optional(),
});

export async function GET() {
  return NextResponse.json({ worlds: listWorlds() });
}

export async function POST(req: Request) {
  const body = Create.parse(await req.json());
  const next = saveWorld(
    createWorld(
      {
        mode: body.mode,
        eventA: body.eventA.trim(),
        eventB: body.eventB?.trim() || undefined,
      },
      body.thesis ? normalizeThesis(body.thesis) : undefined,
    ),
  );
  return NextResponse.json({ world: next, evals: evalWorld(next) });
}
