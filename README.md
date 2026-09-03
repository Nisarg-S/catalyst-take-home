# Catalyst — Causal Desk

A desk-style web app for exploring **causal event chains** and scoring how they affect a **trading book**. Enter a geopolitical or macro hypothesis, generate a weighted DAG of downstream events, define a strategy in plain English, and compare paths side-by-side.

Built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS**. World state is persisted as JSON on disk (no external database).

---

## Quick start

**Requirements:** Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On WSL or remote dev, bind to all interfaces if needed:

```bash
npx next dev --hostname 0.0.0.0
```

**Production build:**

```bash
npm run build
npm start
```

**Lint:**

```bash
npm run lint
```

Worlds are saved under `data/worlds/` (gitignored). The app creates this directory automatically on first use.

---

## What it does

| Area | Description |
|------|-------------|
| **Chain generation** | Turn a natural-language starting event into a causal DAG with forks, probabilities, and asset transforms |
| **Two modes** | *Explore* — what happens next; *Audit* — does event A lead to claimed outcome B? |
| **Strategy / book** | Define legs (long/short + weights) via NL parsing or manual entry; score P&L along any path |
| **Path tabs** | Switch between **Expected** (probability-weighted) and individual timeline paths |
| **Compare** | Pin multiple paths and compare P&L, coherence, and route highlights on the canvas |
| **What-if forks** | Add counterfactual branches at any event node |
| **Pan/zoom canvas** | Drag to pan, scroll to zoom — the chain is a map, not a scroll box |

Preset scenarios (Hormuz, midterms, export controls, photonic chips) are available in the command bar.

---

## UI layout

```
┌─────────────────────────────────────────────────────────────┐
│ Command bar: mode · starting event · Generate · Your book   │
│              · Worlds · Compare                               │
├─────────────────────────────────────────────────────────────┤
│ Path tabs: Expected │ Base │ Fork · …                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Chain canvas (pan/zoom)          │  Slide-overs:          │
│   events → forks → strategy card   │  Strategy, Compare,    │
│                                    │  Event details, Worlds │
└─────────────────────────────────────────────────────────────┘
```

- **Your book** (top bar, under the starting event) is the primary strategy entry point — leg chips, expected P&L, click to edit.
- The **Strategy card** on the far right of the canvas mirrors the active book and opens the full editor.

---

## Supported user flows

See **[docs/SUMMARY.md](./docs/SUMMARY.md)** for the full write-up.

1. **Generate a causal chain** from an initial prompt / event.
2. **Explore a chain** — inspect subpaths via probabilities, and add or remove nodes.
3. **Score a strategy** against the chain and its subpaths (new book or pre-existing portfolio).
   - **3a.** Expected value across subpaths, or returns on each distinct path.
4. **Suggest a book** — given a chain, which strategy / portfolio would be profitable.

---

## Data model (overview)

All chains are **single-root DAGs with edge weights**. Conditional probability of an event is the edge weight from its parent; absolute probability is the product of weights from root → node.

1. Every chain is a single-root DAG with edge weights.
2. Nodes represent events.
3. Events are time-ordered: \( T(\text{upstream}) < T(\text{downstream}) \).
4. Each node can have a **transform** that maps a trading position to the event’s impact on the strategy.
5. To test a strategy against the chain, traverse the DAG.

Each node is a compute unit, so many tests can run in parallel.

Details: [docs/SUMMARY.md](./docs/SUMMARY.md)

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/worlds` | List saved worlds |
| `POST` | `/api/worlds` | Create world from hypothesis |
| `GET` | `/api/worlds/[id]` | Load world + evals |
| `PUT` | `/api/worlds/[id]/thesis` | Save book / strategy |
| `POST` | `/api/worlds/[id]/fork` | Add counterfactual fork |
| `PUT` | `/api/worlds/[id]/timelines/[tid]` | Activate a path |
| `PUT` | `/api/worlds/[id]/timelines/[tid]/register` | Pin/unpin for compare |
| `POST` | `/api/worlds/[id]/register-all` | Register all timelines |
| `POST` | `/api/worlds/[id]/strategy` | Preview NL strategy impact |
| `GET` | `/api/worlds/[id]/suggest-thesis` | Chain → strategy suggestions |

---

## Project structure

```
src/
  app/              Next.js app + API routes
  components/       Desk, ChainCanvas, CommandBar, StrategyPane, ComparePane, …
  lib/
    types.ts        World, EventNode, Thesis, EvalResult, …
    graph.ts        DAG helpers, path enum, book state threading
    eval.ts         Path + expected scoring, stops, audit coherence
    generate.ts     World creation, forking, synthetic fallback chains
    strategy.ts     NL strategy parser + suggestions
    seeds.ts        Curated scenario templates (Hormuz, etc.)
    layout.ts       Canvas node/edge layout
    store.ts        File-backed JSON persistence
data/worlds/        Persisted world JSON (created at runtime)
docs/
  SUMMARY.md        User flows + data model
```

---

## Notes

- Chains from free-text hypotheses are **illustrative sketches**, not forecasts. Seeded scenarios (e.g. Hormuz) have richer, hand-tuned graphs.
- Edge probabilities label **P(child \| parent)** within a fork group — siblings at the same decision point sum to 100%, not all edges in a column.
- This project uses a newer Next.js API; see `node_modules/next/dist/docs/` if extending routing or server features.
