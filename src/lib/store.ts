import fs from "node:fs";
import path from "node:path";
import type { World, WorldSummary } from "./types";
import { migrateWorld, thesisLabel } from "./graph";

const DIR = path.join(process.cwd(), "data", "worlds");

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function fileFor(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid world id");
  return path.join(DIR, `${id}.json`);
}

export function listWorlds(): WorldSummary[] {
  ensureDir();
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const world = migrateWorld(JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as World);
      return {
        id: world.id,
        eventA: world.hypothesis.eventA,
        mode: world.hypothesis.mode,
        updatedAt: world.updatedAt,
        thesis: thesisLabel(world.thesis),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getWorld(id: string): World | null {
  ensureDir();
  const file = fileFor(id);
  if (!fs.existsSync(file)) return null;
  return migrateWorld(JSON.parse(fs.readFileSync(file, "utf8")) as World);
}

export function saveWorld(world: World): World {
  ensureDir();
  const next = migrateWorld({ ...world, updatedAt: new Date().toISOString() });
  fs.writeFileSync(fileFor(world.id), JSON.stringify(next, null, 2));
  return next;
}

export function deleteWorld(id: string) {
  const file = fileFor(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
