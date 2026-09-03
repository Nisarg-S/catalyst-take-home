# Catalyst — User flows & data model

## Supported user flows

1. **Generate a causal chain** from an initial prompt / event.

2. **Explore a chain.** Given a chain, explore possible subpaths via probabilities, and add or remove nodes to probe the graph.

3. **Score a strategy against the chain.** Given a chain and its subpaths, see how a strategy or a pre-existing portfolio would perform based on the causal events.
   - **3a.** You can get an expected value based on the probability of various subpaths happening, or a direct view of returns for each distinct path.

4. **Suggest a book.** Given a chain, get a suggestion for which trading strategy / portfolio would be profitable.

---

## Data model

All chains can be represented as **DAGs with edge weights**. The **conditional probability** of an event (node) happening is its edge weight from the upstream node. The **absolute probability** is the multiplicative path weight from root → node.

Given that, and the user flows above, we model chains and their impact on a strategy as follows:

1. Every chain is a **single-root DAG** with edge weights.
2. **Nodes** in the DAG represent events.
3. Events are **time-ordered**: \( T(\text{upstream}) < T(\text{downstream}) \).
4. Every node can have a **transform** function which, given a trading position, describes the impact of that event on the strategy.
5. To test any existing or new strategy against the causal chain, **traverse the DAG**.

Structuring it this way makes each node a **compute unit**. To run many tests at once, you can use distributed compute and run them in parallel.
