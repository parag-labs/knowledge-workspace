# Security model

Knowledge Workspace treats the **language model as untrusted** for the one thing that matters
in a RAG system: it must not be able to fabricate an answer. The design makes an uncited claim
structurally impossible.

## The boundary

> The LLM plans the query. Deterministic code traverses the graph, retrieves evidence, and
> grounds every claim in a cited source.

The planner returns only a *query plan* (seed kinds, relationships, depth) — validated by Zod
in `src/engine/llm.ts` and bounded by the orchestrator. It never reads the graph and never
writes prose. The answer is composed **only** from retrieved evidence in `src/engine/answer.ts`.

## Controls

1. **No ungrounded claims.** `compose` builds the answer from evidence entities; each claim is
   tied to one evidence item with a source, optional section, and confidence. There is no code
   path that emits a sentence not backed by an evidence record.

2. **Honest abstention.** If semantic search finds no entity close to the question (after a
   lexical-overlap gate that removes embedding collisions), or the seeds have no citable
   supporting evidence, the engine returns `insufficient_evidence` with the missing
   information — never a guess.

3. **Bounded traversal.** The plan's `maxHops` is capped by the engine's agent limit regardless
   of what the model requests, and the token estimate is checked against a budget before any
   work runs.

4. **Validated boundaries.** The planner's output and all ingested graph data are parsed with
   Zod before the deterministic core touches them.

5. **Append-only audit trail.** Every step — plan, seeds, traversal, each evidence item, the
   composed answer — is an immutable event, so you can see exactly why an answer was (or was
   not) produced.

## The abstention test

The evaluation includes an off-topic question ("What is our policy on pineapple pizza?"). The
engine returns **zero claims and zero citations** and reports the missing information. This is
asserted in the tests and the eval, and it is the security-relevant property: the system would
rather say "I don't know" than invent a grounded-looking answer.

## What is out of scope

- This is a portfolio/reference implementation. There is no auth or multi-tenant isolation;
  the demo graph is public sample data.
- The default embedder is a deterministic hashing embedder chosen for reproducibility, not
  retrieval quality; a real model sits behind the `Embedder` interface.
- Ingestion of untrusted documents into the graph is a roadmap item; today the graph is loaded
  from validated seed data or the Postgres store.

## Reporting

This is a personal portfolio project. If you find a security issue, please open an issue
describing it.
