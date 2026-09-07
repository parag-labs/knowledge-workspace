/**
 * The evaluation harness. It runs repeatable question scenarios against the seed graph and
 * derives metrics purely from the results, so nothing is hand-authored. The headline
 * groundedness metric is `unsupportedClaims`: claims that lack a citation. It must always be
 * zero - the whole point is evidence-grounded answers.
 */

import { KnowledgeGraph } from "./graph";
import { MockQueryPlanner } from "./llm";
import { ask, type QueryResult } from "./orchestrator";
import { exampleQuestions, seedGraph } from "./examples";

export interface ScenarioMetrics {
  readonly name: string;
  readonly status: QueryResult["status"];
  readonly answered: boolean;
  readonly seeds: number;
  readonly evidence: number;
  readonly claims: number;
  readonly unsupportedClaims: number;
  readonly citedSources: number;
  readonly tokens: number;
}

export async function evaluate(): Promise<ScenarioMetrics[]> {
  const graph = KnowledgeGraph.from(seedGraph);
  const planner = new MockQueryPlanner();
  const clock = () => 0;

  const scenarios: Array<{ name: string; question: string }> = [
    { name: "why cosmos", question: exampleQuestions.whyCosmos },
    { name: "who decided", question: exampleQuestions.whoDecided },
    { name: "unknown topic", question: exampleQuestions.unknown },
  ];

  const rows: ScenarioMetrics[] = [];
  for (const s of scenarios) {
    const result = await ask(graph, s.question, { planner, clock });
    const unsupported = result.answer.claims.filter((c) => !c.evidence || !c.evidence.source).length;
    const citedSources = new Set(result.answer.claims.map((c) => c.evidence.source)).size;
    rows.push({
      name: s.name,
      status: result.status,
      answered: result.status === "answered",
      seeds: result.answer.sufficient ? result.answer.evidence.length : 0,
      evidence: result.answer.evidence.length,
      claims: result.answer.claims.length,
      unsupportedClaims: unsupported,
      citedSources,
      tokens: result.tokens,
    });
  }
  return rows;
}
