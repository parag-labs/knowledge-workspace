import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../graph";
import { retrieve, compose } from "../answer";
import { MockQueryPlanner } from "../llm";
import { exampleQuestions, seedGraph } from "../examples";

const graph = KnowledgeGraph.from(seedGraph);

async function planFor(question: string) {
  const { plan } = await new MockQueryPlanner().plan({ question, availableKinds: [], availableRelations: [] });
  return plan;
}

describe("evidence grounding", () => {
  it("every collected evidence item exposes source, section (optional) and confidence", async () => {
    const plan = await planFor(exampleQuestions.whyCosmos);
    const result = retrieve(graph, exampleQuestions.whyCosmos, plan);
    expect(result.evidence.length).toBeGreaterThan(0);
    for (const ev of result.evidence) {
      expect(ev.source.length).toBeGreaterThan(0);
      expect(ev.confidence).toBeGreaterThan(0);
      expect(ev.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("ranks evidence by confidence (descending)", async () => {
    const plan = await planFor(exampleQuestions.whyCosmos);
    const { evidence } = retrieve(graph, exampleQuestions.whyCosmos, plan);
    const scores = evidence.map((e) => e.confidence);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("composes an answer where every claim is backed by evidence", async () => {
    const plan = await planFor(exampleQuestions.whyCosmos);
    const answer = compose(exampleQuestions.whyCosmos, retrieve(graph, exampleQuestions.whyCosmos, plan));
    expect(answer.sufficient).toBe(true);
    expect(answer.claims.length).toBeGreaterThan(0);
    for (const claim of answer.claims) {
      expect(claim.evidence).toBeTruthy();
      expect(claim.text.length).toBeGreaterThan(0);
    }
  });

  it("marks the answer insufficient (with missing info) when nothing is relevant", async () => {
    const plan = await planFor(exampleQuestions.unknown);
    const answer = compose(exampleQuestions.unknown, retrieve(graph, exampleQuestions.unknown, plan));
    expect(answer.sufficient).toBe(false);
    expect(answer.missing).toBeTruthy();
  });
});
