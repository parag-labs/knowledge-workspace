# Architecture

Knowledge Workspace has two halves separated by a hard boundary:

1. **A deterministic engine** (`src/engine/`) with no framework dependencies — the typed
   entity/graph model, the embedder, the graph with traversal, the query planner abstraction,
   retrieval + grounded answering, the orchestrator, replay, the MCP tool surface, and
   evaluation. This is the tested core.
2. **A thin Next.js shell** (`src/app`, `src/components`, `src/db`) that visualizes the graph
   and persists it.

## The core rule

> The LLM plans the query. Deterministic code traverses the graph, retrieves evidence, and
> grounds every claim in a cited source.

Only the query planner (`llm.ts`) runs a model, and all it produces is a *plan*: which entity
kinds to seed on, which relationship types to traverse, and how deep. It never reads the graph
or writes the answer. The orchestrator validates and bounds the plan, then runs a deterministic
retrieve → compose pipeline whose output is assembled **only** from retrieved evidence.

## Query lifecycle

```
question
    ↓
Planner.plan()                 # LLM (or MockQueryPlanner) — proposes a query plan
    ↓
queryPlanSchema.parse()        # Zod — validate untrusted model output
    ↓  (bound maxHops to the agent limit)
retrieve():
    graph.search()             # semantic search + lexical-overlap gate → seed entities
    graph.traverse()           # typed BFS along permitted relations → reached subgraph
    collect evidence           # source + section + confidence per quotable entity
    ↓
compose():                     # assemble answer ONLY from evidence
    sufficient  → answer + cited claims
    insufficient → abstain + missing info
    ↓
emit QueryCompleted (answered | insufficient_evidence | failed)
```

Every step emits a typed event onto an append-only log.

## Modules

| Module | Responsibility |
|--------|----------------|
| `ids.ts` | Branded id types + a deterministic counter. |
| `entities.ts` | The `Entity` discriminated union, `RelationType` union, and Zod schemas for ingestion. |
| `embedding.ts` | The `Embedder` interface, a deterministic FNV-hashing embedder, and cosine similarity. |
| `graph.ts` | The `KnowledgeGraph`: adjacency indexes, semantic `search` (with a lexical-overlap gate), typed `neighbours`, BFS `traverse`, and `subgraph`. |
| `llm.ts` | The `QueryPlanner` interface, the deterministic `MockQueryPlanner`, and the plan Zod schema. |
| `events.ts` | The `QueryEvent` union and the append-only `EventLog` (with an `onAppend` hook). |
| `answer.ts` | `retrieve` (search + traverse + score evidence) and `compose` (grounded answer or abstain). |
| `orchestrator.ts` | `ask()` — plan → validate → retrieve → ground, event-sourced. |
| `mcp.ts` | The MCP tool surface over the graph. |
| `replay.ts` | Fold an event log into a query view. |
| `evaluate.ts` | Repeatable scored scenarios; metrics derived from results. |

## Why a graph, not just vectors

Vector search finds *similar text*; it can't explain *why*. The graph encodes the
relationships that carry the reasoning — a decision is `SUPPORTED_BY` documents, `REQUIRES`
requirements, was `DECIDED_IN` a meeting, and was `MADE` by a person. Traversal walks those
edges from a semantically-matched seed, so the evidence set is the actual chain behind the
answer, not just lexically-similar chunks. The spec is explicit that a dedicated graph database
is unnecessary at this scale — a well-indexed in-memory structure (persisted to Postgres for
self-hosting) is enough.

## Deterministic embeddings + the overlap gate

Real RAG embeds text with a model. For a reproducible, key-free demo the default `Embedder` is
a fixed FNV-hashing bag-of-words vector. Hashing embeddings can produce *collision*
false-positives for short queries, so `search` applies a **lexical-overlap gate**: an entity
must share at least one real (non-stopword) token with the query to be a candidate. This makes
an off-topic question return nothing — which is what lets the engine abstain honestly. A real
embedding model drops in behind the same interface without touching the rest of the engine.

## Grounding & confidence

`retrieve` scores each evidence item deterministically: a directly-matched seed carries its
search similarity; an entity reached through traversal carries a confidence decayed by hop
distance. `compose` builds the answer from the top evidence, and **every claim references one
evidence item** (source · section · confidence). If there is no strong seed or no quotable
evidence, it returns an insufficiency with the missing information instead of a fabricated
answer — so uncited claims cannot occur.

## Event sourcing & determinism

`ask()` appends immutable events; the result and every UI view derive from them, and the
`EventLog`'s `onAppend` hook can stream them. The clock, id counter, embedder and planner are
all deterministic, which is why the eval table is reproducible and safe to commit.

## Persistence boundary

`Store` is an interface with `MemoryStore` (default) and a Drizzle/Postgres `PgStore`. The
engine never imports either; the app or the migration entry point selects one. The unit suite
stays database-free while the Postgres path is proven by the CI integration job, which seeds
the graph and re-answers the worked example from the rehydrated data.
