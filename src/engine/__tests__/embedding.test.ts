import { describe, expect, it } from "vitest";
import { cosine, HashingEmbedder, normalize, tokenize } from "../embedding";

const embedder = new HashingEmbedder();

describe("embedding", () => {
  it("tokenizes and drops stopwords", () => {
    expect(tokenize("Why did we choose Cosmos DB?")).toEqual(["choose", "cosmos", "db"]);
  });

  it("is deterministic: same text yields the same vector", () => {
    expect(embedder.embed("Cosmos DB global distribution")).toEqual(embedder.embed("Cosmos DB global distribution"));
  });

  it("scores related text higher than unrelated text", () => {
    const q = embedder.embed("why choose cosmos db datastore");
    const related = embedder.embed("We chose Azure Cosmos DB as the primary datastore");
    const unrelated = embedder.embed("pineapple pizza toppings and dough");
    expect(cosine(q, related)).toBeGreaterThan(cosine(q, unrelated));
  });

  it("normalizes to unit length", () => {
    const v = normalize([3, 4]);
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(mag).toBeCloseTo(1, 6);
  });
});
