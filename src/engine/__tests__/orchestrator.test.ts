import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../graph";
import { ask } from "../orchestrator";
import { MockQueryPlanner, ScriptedQueryPlanner } from "../llm";
import { exampleQuestions, seedGraph } from "../examples";

const graph = KnowledgeGraph.from(seedGraph);
const planner = new MockQueryPlanner();
const clock = () => 0;

describe("ask (orchestrator)", () => {
  it("answers the Cosmos DB question with grounded, cited claims", async () => {
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner, clock });
    expect(result.status).toBe("answered");
    expect(result.answer.claims.length).toBeGreaterThan(0);
    // every claim has a citation with a source
    for (const c of result.answer.claims) {
      expect(c.evidence.source.length).toBeGreaterThan(0);
    }
    // the answer text references the design or benchmark evidence
    expect(result.answer.text.toLowerCase()).toMatch(/design|benchmark|requirement|latency/);
  });

  it("reports insufficient evidence for an unrelated question instead of guessing", async () => {
    const result = await ask(graph, exampleQuestions.unknown, { planner, clock });
    expect(result.status).toBe("insufficient_evidence");
    expect(result.answer.claims).toHaveLength(0);
    expect(result.answer.missing).toBeTruthy();
    const missing = result.events.find((e) => e.event.type === "MissingInfo");
    expect(missing).toBeDefined();
  });

  it("emits a well-formed, ordered event log", async () => {
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner, clock });
    const types = result.events.map((e) => e.event.type);
    expect(types[0]).toBe("QueryStarted");
    expect(types[1]).toBe("PlanProposed");
    expect(types.at(-1)).toBe("QueryCompleted");
    result.events.forEach((e, i) => expect(e.seq).toBe(i));
  });

  it("fails safely when the planner returns an invalid plan", async () => {
    const bad = new ScriptedQueryPlanner({ seedKinds: [], traverse: [], maxHops: 99 } as never);
    const result = await ask(graph, "anything", { planner: bad, clock });
    // maxHops 99 is out of the schema's allowed range -> validation failure
    expect(result.status).toBe("failed");
    expect(result.error).toContain("invalid");
  });

  it("bounds traversal depth to the agent limit", async () => {
    const result = await ask(graph, exampleQuestions.whyCosmos, { planner, clock, limits: { maxHops: 1 } });
    const plan = result.events.find((e) => e.event.type === "PlanProposed");
    expect(plan?.event.type === "PlanProposed" && plan.event.maxHops).toBe(1);
  });
});
