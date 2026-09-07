/**
 * The public surface for the knowledge-workspace engine: ids, the typed entity/graph model,
 * embeddings, the graph, the query planner, events, retrieval + grounded answering, the
 * orchestrator, replay, the MCP tool surface, evaluation, and the seed data. The UI and API
 * depend only on this barrel.
 */

export * from "./ids";
export * from "./entities";
export * from "./embedding";
export * from "./graph";
export * from "./llm";
export * from "./events";
export * from "./answer";
export * from "./orchestrator";
export * from "./replay";
export * from "./mcp";
export * from "./evaluate";
export * from "./examples";
