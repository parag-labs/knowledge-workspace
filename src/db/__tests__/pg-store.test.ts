import { describe, expect, it } from "vitest";
import { PgStore } from "../pg-store";
import { KnowledgeGraph } from "../../engine/graph";
import { ask } from "../../engine/orchestrator";
import { MockQueryPlanner } from "../../engine/llm";
import { exampleQuestions, seedGraph } from "../../engine/examples";

/**
 * Integration test for the Postgres path. Runs only when DATABASE_URL is set (CI provides a
 * Postgres service container); locally it is skipped, keeping the unit suite database-free.
 */
const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe("PgStore integration", () => {
  it("persists the graph and rehydrates a working, queryable graph", async () => {
    const store = PgStore.connect(url!);
    await store.migrate();
    await store.saveGraph(seedGraph);

    const loaded = await store.loadGraph();
    expect(loaded.entities.length).toBe(seedGraph.entities.length);
    expect(loaded.relationships.length).toBe(seedGraph.relationships.length);

    // The rehydrated graph still answers the worked example with grounded evidence.
    const graph = KnowledgeGraph.from(loaded);
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner: new MockQueryPlanner() });
    expect(result.status).toBe("answered");
    expect(result.answer.claims.length).toBeGreaterThan(0);

    await store.close();
  });
});
