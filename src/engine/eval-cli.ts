/**
 * `pnpm eval` entry point. Runs the evaluation scenarios and prints a table of metrics derived
 * from real runs - never hand-typed. The README copies these numbers verbatim.
 */

import { evaluate } from "./evaluate";

async function main(): Promise<void> {
  const rows = await evaluate();

  console.log("\nKnowledge Workspace Evaluation (metrics from actual runs)\n");
  const header = ["scenario", "status", "seeds", "evidence", "claims", "unsupported", "sources", "tokens"];
  const widths = [16, 22, 7, 10, 8, 13, 9, 7];
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 10)).join("");

  console.log(line(header));
  for (const r of rows) {
    console.log(
      line([
        r.name,
        r.status,
        String(r.seeds),
        String(r.evidence),
        String(r.claims),
        String(r.unsupportedClaims),
        String(r.citedSources),
        String(r.tokens),
      ]),
    );
  }

  const totalUnsupported = rows.reduce((a, r) => a + r.unsupportedClaims, 0);
  console.log(`\nUnsupported (uncited) claims across all scenarios: ${totalUnsupported}`);
  if (totalUnsupported > 0) {
    console.error("FAIL: an answer contained a claim with no citation");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
