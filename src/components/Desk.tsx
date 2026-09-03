"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChainCanvas } from "@/components/ChainCanvas";
import { CommandBar } from "@/components/CommandBar";
import { buildPathHighlights, ComparePane } from "@/components/ComparePane";
import { EventPane } from "@/components/EventPane";
import { ForkForm } from "@/components/ForkForm";
import { Modal, SlideOver } from "@/components/Overlays";
import { PathTabs } from "@/components/PathTabs";
import { StrategyPane } from "@/components/StrategyPane";
import { WorldsPane } from "@/components/WorldsPane";
import {
  activateTimeline,
  createWorld,
  forkWorld,
  getWorld,
  putThesis,
  registerAllPaths,
  registerPath,
} from "@/lib/api";
import { eventNode, registeredIdsOf } from "@/lib/graph";
import { pickActiveEval } from "@/lib/payload";
import { PRESETS } from "@/lib/presets";
import type { Mode, Thesis, WorldPayload } from "@/lib/types";

type Pane = "event" | "worlds" | "compare" | "strategy";

export function Desk() {
  const [mode, setMode] = useState<Mode>("explore");
  const [eventA, setEventA] = useState<string>(PRESETS[0].eventA);
  const [eventB, setEventB] = useState<string>(PRESETS[0].eventB);
  const [payload, setPayload] = useState<WorldPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane | null>(null);
  const [forkId, setForkId] = useState<string | null>(null);
  const [compareHoverPathId, setCompareHoverPathId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((p: WorldPayload) => {
    setPayload(p);
    const url = new URL(window.location.href);
    url.searchParams.set("w", p.world.id);
    window.history.replaceState(null, "", url);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<WorldPayload>) => {
      setBusy(true);
      setError(null);
      try {
        apply(await fn());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("w");
    void (async () => {
      setBusy(true);
      try {
        if (w) {
          apply(await getWorld(w));
          return;
        }
        apply(await createWorld({ mode: "explore", eventA: PRESETS[0].eventA }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setBusy(false);
        setReady(true);
      }
    })();
  }, [apply]);

  const world = payload?.world;
  const activeEval = pickActiveEval(payload);
  const forkNode = world && forkId ? eventNode(world, forkId) : undefined;

  const pathHighlights = useMemo(() => {
    if (pane !== "compare" || !world) return undefined;
    return buildPathHighlights(world, compareHoverPathId);
  }, [pane, world, compareHoverPathId]);

  const generate = (nextMode = mode, a = eventA, b = eventB) => {
    setPane(null);
    setSelectedId(null);
    void run(() =>
      createWorld({
        mode: nextMode,
        eventA: a,
        eventB: nextMode === "audit" ? b : undefined,
      }),
    );
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) setPane("event");
    else if (pane === "event") setPane(null);
  };

  return (
    <div className="desk-grid relative flex h-full flex-col">
      <CommandBar
        mode={mode}
        eventA={eventA}
        eventB={eventB}
        busy={busy}
        world={world}
        pnlPct={activeEval?.pnlPct}
        activePane={pane === "event" ? null : pane}
        compareCount={world ? registeredIdsOf(world).length : 0}
        onMode={(m) => {
          setMode(m);
          if (m === "audit" && !eventB) setEventB("Oil prices decrease");
        }}
        onEventA={setEventA}
        onEventB={setEventB}
        onGenerate={() => generate()}
        onPreset={(a, b) => {
          setEventA(a);
          if (b) {
            setEventB(b);
            setMode("explore");
          }
          generate("explore", a, b);
        }}
        onOpen={setPane}
      />

      {error && <div className="px-4 py-2 text-sm tone-neg">{error}</div>}

      {world && activeEval && payload && (
        <PathTabs
          world={world}
          evals={payload.evals}
          onActivate={(tid) => void run(() => activateTimeline(world.id, tid))}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {world && activeEval ? (
          <ChainCanvas
            world={world}
            evalResult={activeEval}
            selectedId={selectedId}
            pathHighlights={pathHighlights}
            onSelect={select}
            onWhatIf={(id) => {
              setSelectedId(id);
              setForkId(id);
            }}
            onOpenStrategy={() => setPane("strategy")}
          />
        ) : !ready || busy ? (
          <div className="flex h-full items-center justify-center text-muted">Generating…</div>
        ) : world && !activeEval ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <p>Chain loaded but scoring failed.</p>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-foreground"
              onClick={() => void run(() => getWorld(world.id))}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted">No chain yet</div>
        )}

        {world && activeEval && pane === "event" && selectedId && (
          <SlideOver
            open
            width={360}
            title={selectedId === "thesis" ? "Strategy" : (eventNode(world, selectedId)?.title ?? "Event")}
            subtitle="Details for the selected card"
            onClose={() => {
              setPane(null);
              setSelectedId(null);
            }}
          >
            <EventPane
              world={world}
              evalResult={activeEval}
              selectedId={selectedId}
              onWhatIf={() => selectedId !== "thesis" && setForkId(selectedId)}
            />
          </SlideOver>
        )}

        {world && activeEval && payload && pane === "worlds" && (
          <SlideOver
            open
            width={380}
            title="Worlds"
            subtitle="Each world is a full path through the chain"
            onClose={() => setPane(null)}
          >
            <WorldsPane
              world={world}
              evals={payload.evals}
              busy={busy}
              onActivate={(tid) => void run(() => activateTimeline(world.id, tid))}
              onRegister={(tid, on) => void run(() => registerPath(world.id, tid, on))}
              onRegisterAll={() => void run(() => registerAllPaths(world.id))}
            />
          </SlideOver>
        )}

        {world && activeEval && payload && pane === "compare" && (
          <SlideOver
            open
            width={720}
            title="Compare"
            subtitle="Hover a path to highlight its route on the map"
            onClose={() => {
              setCompareHoverPathId(null);
              setPane(null);
            }}
          >
            <ComparePane
              world={world}
              evals={payload.evals}
              busy={busy}
              hoverPathId={compareHoverPathId}
              onHoverPath={setCompareHoverPathId}
              onActivate={(tid) => void run(() => activateTimeline(world.id, tid))}
              onRegisterAll={() => void run(() => registerAllPaths(world.id))}
              onOpenWorlds={() => setPane("worlds")}
            />
          </SlideOver>
        )}

        {world && activeEval && pane === "strategy" && (
          <SlideOver
            open
            width={400}
            title="Strategy"
            subtitle="The book this chain is testing"
            onClose={() => setPane(null)}
          >
            <StrategyPane
              key={`${world.id}:${world.activeTimelineId}:${world.thesis.legs.map((l) => `${l.side}${l.symbol}${l.weight}`).join(",")}:${world.thesis.narrative ?? ""}`}
              worldId={world.id}
              timelineId={world.activeTimelineId}
              world={world}
              active={activeEval}
              busy={busy}
              onSave={(thesis: Thesis) => void run(() => putThesis(world.id, thesis))}
            />
          </SlideOver>
        )}

        <Modal
          open={Boolean(forkNode)}
          title="Create another path"
          subtitle={
            forkNode
              ? `From “${forkNode.title}”. Earlier events stay. This hop and everything after change. The new world is added to compare.`
              : undefined
          }
          onClose={() => setForkId(null)}
        >
          {forkNode && (
            <ForkForm
              alternatives={forkNode.alternatives}
              busy={busy}
              onFork={(text) => {
                if (!world) return;
                void (async () => {
                  await run(() => forkWorld(world.id, forkNode.id, text));
                  setForkId(null);
                  setPane("compare");
                })();
              }}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
