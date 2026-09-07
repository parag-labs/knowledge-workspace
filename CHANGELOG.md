# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-07

First public release.

### Added
- Typed knowledge-graph model: an entity discriminated union (Person/Project/Document/
  Decision/Meeting/Task/Requirement/Technology) and a relationship-type union, with Zod
  ingestion schemas.
- `KnowledgeGraph` with adjacency indexes, semantic search (deterministic hashing embedder +
  cosine, gated by lexical overlap to remove collision false-positives), typed neighbours, BFS
  traversal with hop distances, and induced subgraphs.
- Query planner abstraction (`llm.ts`) with a deterministic `MockQueryPlanner` and
  `ScriptedQueryPlanner`; the plan is validated with Zod before the engine trusts it.
- Retrieval + grounded answering (`answer.ts`): evidence carries source · section · confidence,
  every claim is backed by an evidence item, and the engine abstains with missing-info when the
  graph can't support an answer.
- Event-sourced orchestrator (`ask`) with bounded traversal depth and a token budget.
- MCP tool surface (`mcp.ts`): `knowledge.search`, `knowledge.related`, `knowledge.get_entity`,
  `knowledge.get_evidence`, all Zod-validated.
- Replay, an evaluation harness and `pnpm eval` CLI producing real, reproducible metrics (0
  unsupported claims across all scenarios).
- Persistence behind a `Store` interface: `MemoryStore` (default) and a Drizzle/Postgres
  `PgStore`, with a migration/seed entry point.
- Test suite: unit (graph, embedding, MCP), grounding, failure-path, evaluation, and a Postgres
  integration test that runs in CI and auto-skips locally.
- Next.js workspace with a React Flow graph visualization (seed/reached highlighting) and
  answer/evidence/trace panels; runs entirely client-side.
- Docker + docker-compose, GitHub Actions CI (lint / typecheck / test / build / eval, a
  Postgres integration job, and a dependency audit), a GitHub Pages deploy workflow, and full
  docs.

[0.1.0]: https://github.com/parag-labs/knowledge-workspace/releases/tag/v0.1.0
