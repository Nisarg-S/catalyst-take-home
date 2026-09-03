export type Side = "long" | "short";
export type Confidence = "low" | "med" | "high";
export type Mode = "explore" | "audit";
export const EXPECTED_PATH_ID = "__expected__";

export type ThesisLeg = {
  symbol: string;
  side: Side;
  weight: number;
};

export type Thesis = {
  legs: ThesisLeg[];
  horizonDays?: number;
  /** Natural-language description of the trade idea */
  narrative?: string;
};

export type ParsedLeg = {
  symbol: string;
  side: Side;
  weight: number;
  matchedText: string;
};

export type StrategySuggestion = {
  id: string;
  narrative: string;
  rationale: string;
  thesis: Thesis;
  pnlPct: number;
  invalidation?: string;
};

export type StrategyImpact = {
  thesis: Thesis;
  eval: EvalResult;
  summary: string;
  helpful: { nodeId: string; title: string; contributionPct: number }[];
  harmful: { nodeId: string; title: string; contributionPct: number }[];
  parseWarnings: string[];
};

export type Hypothesis = {
  mode: Mode;
  eventA: string;
  eventB?: string;
};

/** Market impact of an event on downstream book scoring */
export type NodeTransform = {
  symbol: string;
  assetReturnPct: number;
};

/** Strategy/book state threaded through the DAG */
export type BookState = {
  legs: ThesisLeg[];
  cumulativeReturns: Record<string, number>;
};

export type EventNode = {
  kind: "event";
  id: string;
  title: string;
  mechanism: string;
  /** P(event | parents) — mirrored on causal edges; kept for display */
  pConditional: number;
  confidence: Confidence;
  /** Days from hypothesis origin; defines temporal ordering */
  horizonDays: number;
  /** Topological time slot (derived, monotonic along causal edges) */
  timeIndex: number;
  forkGroupId: string;
  alternatives: string[];
  weaknesses: string[];
  /** How this event transforms cumulative returns on the book */
  transforms: NodeTransform[];
};

export type ThesisNode = {
  kind: "thesis";
  id: "thesis";
};

export type Node = EventNode | ThesisNode;

export type CausesEdge = {
  id: string;
  from: string;
  to: string;
  kind: "causes";
  label: string;
  /** P(to | from) — siblings from the same parent sum to 1 */
  probability: number;
};

/** @deprecated Impacts live on EventNode.transforms; kept for migration only */
export type ImpactEdge = {
  id: string;
  from: string;
  to: "thesis";
  kind: "impacts";
  assetReturnPct: number;
  symbol: string;
};

export type Edge = CausesEdge | ImpactEdge;

export type Timeline = {
  id: string;
  label: string;
  assignment: Record<string, string>;
};

export type World = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hypothesis: Hypothesis;
  thesis: Thesis;
  nodes: Node[];
  edges: Edge[];
  timelines: Timeline[];
  activeTimelineId: string;
  /** Paths pinned for N-way compare. Independent of which path is live. */
  registeredIds: string[];
};

export type SymbolPnl = {
  symbol: string;
  assetReturnPct: number;
  contributionPct: number;
};

export type NodeContribution = {
  nodeId: string;
  title: string;
  contributionPct: number;
};

export type NodeEval = {
  nodeId: string;
  title: string;
  timeIndex: number;
  /** P(reaching this node) — path-specific or marginal */
  reachProbability: number;
  stateIn: BookState;
  stateOut: BookState;
  contributionPct: number;
};

export type ForkWatch = {
  nodeId: string;
  timelineId?: string;
  title: string;
  pnlIfRealized: number;
  probability?: number;
};

export type EvalResult = {
  mode: "path" | "expected";
  timelineId: string;
  /** Path probability when mode=path */
  pathProbability?: number;
  pnlPct: number;
  bySymbol: SymbolPnl[];
  nodeEvals: NodeEval[];
  /** Derived from nodeEvals for backward-compatible UI */
  nodeContributions: NodeContribution[];
  stops: ForkWatch[];
  takeProfits: NodeContribution[];
  coherence: {
    connected: boolean;
    weakestNodeId: string | null;
    note: string;
  } | null;
};

export type WorldPayload = {
  world: World;
  evals: Record<string, EvalResult>;
};

export type WorldSummary = {
  id: string;
  eventA: string;
  mode: Mode;
  updatedAt: string;
  thesis: string;
};

export type DagPath = {
  id: string;
  label: string;
  nodeIds: string[];
  probability: number;
};
