"use client";

import { days, pct, pLabel } from "@/lib/format";
import { eventNode, nodeTransforms } from "@/lib/graph";
import type { EvalResult, World } from "@/lib/types";

type Props = {
  world: World;
  evalResult: EvalResult;
  selectedId: string;
  onWhatIf: () => void;
};

function bookSummary(state: EvalResult["nodeEvals"][0]["stateIn"]) {
  if (!state.legs.length) return "Empty book";
  return state.legs
    .map((l) => `${l.side} ${l.symbol}`)
    .slice(0, 3)
    .join(", ");
}

export function EventPane({ world, evalResult, selectedId, onWhatIf }: Props) {
  if (selectedId === "thesis") {
    return (
      <div className="space-y-3 text-[13px] text-muted">
        <p>The green card is the strategy entry point. The book threads through each event node and accumulates returns.</p>
        <p>
          {evalResult.mode === "expected" ? "Expected P&amp;L" : "Path P&amp;L"}:{" "}
          <span className="font-mono text-foreground">{pct(evalResult.pnlPct)}</span>
          {evalResult.pathProbability !== undefined && (
            <span className="ml-2 font-mono">· {pLabel(evalResult.pathProbability)} path weight</span>
          )}
        </p>
      </div>
    );
  }

  const node = eventNode(world, selectedId);
  if (!node) return <p className="text-muted">That event is gone.</p>;
  const transforms = nodeTransforms(world, node.id);
  const nodeEval = evalResult.nodeEvals.find((n) => n.nodeId === node.id);

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-foreground/85">{node.mechanism}</p>
      <dl className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-lg bg-white/4 px-2 py-1.5">
          <dt className="text-muted">P(reach node)</dt>
          <dd className="font-mono">{pLabel(nodeEval?.reachProbability ?? node.pConditional)}</dd>
        </div>
        <div className="rounded-lg bg-white/4 px-2 py-1.5">
          <dt className="text-muted">Horizon</dt>
          <dd>{days(node.horizonDays)}</dd>
        </div>
      </dl>

      {nodeEval && (
        <div className="space-y-2 rounded-xl border border-white/10 p-3 text-[12px]">
          <div className="font-medium text-gold/90">State in → out</div>
          <div>
            <div className="text-muted">Book in</div>
            <div className="font-mono">{bookSummary(nodeEval.stateIn)}</div>
          </div>
          <div>
            <div className="text-muted">Book out (after transform)</div>
            <div className="font-mono">{bookSummary(nodeEval.stateOut)}</div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Hop contribution</span>
            <span className={nodeEval.contributionPct >= 0 ? "tone-pos font-mono" : "tone-neg font-mono"}>
              {pct(nodeEval.contributionPct, 1)}
            </span>
          </div>
        </div>
      )}

      {transforms.length > 0 && (
        <div>
          <div className="text-[11px] text-muted">Transforms on the book</div>
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {transforms.map((i) => (
              <li key={i.symbol} className="flex justify-between">
                <span>{i.symbol}</span>
                <span className={i.assetReturnPct >= 0 ? "tone-pos" : "tone-neg"}>{pct(i.assetReturnPct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.weaknesses.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted">
          {node.weaknesses.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onWhatIf}
        className="w-full rounded-lg bg-gold px-3 py-2 text-[13px] font-medium text-[#1a140c]"
      >
        What if this were different?
      </button>
    </div>
  );
}
