import { describe, expect, it } from "vitest";
import { KnowledgeGraph } from "../graph";
import { seedGraph } from "../examples";
import { EntityId } from "../ids";

const graph = KnowledgeGraph.from(seedGraph);

describe("knowledge graph", () => {
  it("finds the Cosmos DB decision by semantic search", () => {
    const hits = graph.search("Why did we choose Cosmos DB?", { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.score).toBeGreaterThan(0);
    expect(hits.some((h) => String(h.entity.id) === "dec_cosmos" || String(h.entity.id) === "tech_cosmos")).toBe(true);
  });

  it("returns typed neighbours of the decision", () => {
    const n = graph.neighbours(EntityId("dec_cosmos"));
    const vias = n.map((x) => x.via);
    expect(vias).toContain("SUPPORTED_BY");
    expect(vias).toContain("REQUIRES");
    // the person who MADE it is an incoming edge
    expect(n.some((x) => x.direction === "in" && x.via === "MADE")).toBe(true);
  });

  it("restricts neighbours to requested relationship types", () => {
    const n = graph.neighbours(EntityId("dec_cosmos"), ["SUPPORTED_BY"]);
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((x) => x.via === "SUPPORTED_BY")).toBe(true);
  });

  it("traverses breadth-first and records hop distance", () => {
    const reached = graph.traverse([EntityId("dec_cosmos")], ["SUPPORTED_BY", "DISCUSSED_IN"], 2);
    expect(reached.get("dec_cosmos")).toBe(0);
    expect(reached.get("doc_design")).toBe(1);
    // doc_design -> meet_arch is a second hop
    expect(reached.get("meet_arch")).toBe(2);
  });

  it("builds an induced subgraph", () => {
    const sg = graph.subgraph(["dec_cosmos", "doc_design", "meet_arch"]);
    expect(sg.entities).toHaveLength(3);
    expect(sg.relationships.some((r) => String(r.from) === "doc_design" && String(r.to) === "meet_arch")).toBe(true);
  });
});
