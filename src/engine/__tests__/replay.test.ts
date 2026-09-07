import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../graph";
import { ask } from "../orchestrator";
import { replay } from "../replay";
import { MockQueryPlanner } from "../llm";
import { exampleQuestions, seedGraph } from "../examples";

const graph = KnowledgeGraph.from(seedGraph);

describe("replay", () => {
  it("reconstructs the final query view from the event log", async () => {
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner: new MockQueryPlanner(), clock: () => 0 });
    const view = replay(result.events);
    expect(view.question).toBe(exampleQuestions.whyCosmos);
    expect(view.status).toBe("answered");
    expect(view.citations).toBe(result.answer.claims.length);
    expect(view.evidence).toBeGreaterThan(0);
  });

  it("is monotonic in evidence as the log grows", async () => {
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner: new MockQueryPlanner(), clock: () => 0 });
    let last = 0;
    for (const e of result.events) {
      const view = replay(result.events, e.seq);
      expect(view.evidence).toBeGreaterThanOrEqual(last);
      last = view.evidence;
    }
  });
});
