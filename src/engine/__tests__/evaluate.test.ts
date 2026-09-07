import { describe, expect, it } from "vitest";
import { evaluate } from "../evaluate";

describe("evaluation harness", () => {
  it("has zero unsupported (uncited) claims across every scenario", async () => {
    const rows = await evaluate();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.unsupportedClaims).toBe(0);
    }
  });

  it("is deterministic and repeatable", async () => {
    const a = await evaluate();
    const b = await evaluate();
    expect(a).toEqual(b);
  });

  it("answers the known questions and abstains on the unknown one", async () => {
    const rows = await evaluate();
    expect(rows.find((r) => r.name === "why cosmos")?.answered).toBe(true);
    expect(rows.find((r) => r.name === "unknown topic")?.answered).toBe(false);
  });
});
