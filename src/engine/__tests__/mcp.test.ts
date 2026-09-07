import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../graph";
import { knowledgeTools } from "../mcp";
import { seedGraph, exampleQuestions } from "../examples";

const graph = KnowledgeGraph.from(seedGraph);
const tools = knowledgeTools(graph);

describe("MCP tool surface", () => {
  it("knowledge.search returns ranked hits", () => {
    const hits = tools["knowledge.search"]({ query: "cosmos db latency", limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("knowledge.related returns typed neighbours", () => {
    const rel = tools["knowledge.related"]({ id: "dec_cosmos", types: ["SUPPORTED_BY"] });
    expect(rel.every((r) => r.via === "SUPPORTED_BY")).toBe(true);
  });

  it("knowledge.get_entity fetches by id", () => {
    const e = tools["knowledge.get_entity"]({ id: "tech_cosmos" });
    expect(e?.name).toBe("Azure Cosmos DB");
  });

  it("knowledge.get_evidence returns grounded evidence", async () => {
    const ev = await tools["knowledge.get_evidence"]({ question: exampleQuestions.whyCosmos });
    expect(ev.length).toBeGreaterThan(0);
    expect(ev[0]!.source.length).toBeGreaterThan(0);
  });

  it("validates arguments at the boundary", () => {
    expect(() => tools["knowledge.search"]({ query: "" })).toThrow();
    expect(() => tools["knowledge.get_entity"]({})).toThrow();
  });
});
