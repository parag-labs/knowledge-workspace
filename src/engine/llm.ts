/**
 * The query planner - the only place a model runs. Given a natural-language question and the
 * entity kinds/relationship types available in the graph, it *proposes* a query plan: which
 * kinds to search for seeds, which relationships to traverse, and how many hops. It never
 * touches the graph or fabricates an answer; the deterministic engine executes the plan,
 * retrieves evidence, and grounds the answer. A real model drops in behind this interface.
 */

import { z } from "zod";
import { entityKind, relationType } from "./entities";

/** The structured plan a planner must return. Validated with Zod before the engine trusts it. */
export const queryPlanSchema = z.object({
  /** Entity kinds to search for the seed set (empty = search all kinds). */
  seedKinds: z.array(entityKind).default([]),
  /** Relationship types the traversal is allowed to follow. */
  traverse: z.array(relationType).default([]),
  /** Traversal depth. Bounded by the engine regardless of what the model asks for. */
  maxHops: z.number().int().min(1).max(6).default(3),
});
export type QueryPlan = z.infer<typeof queryPlanSchema>;

export interface PlanRequest {
  readonly question: string;
  readonly availableKinds: readonly string[];
  readonly availableRelations: readonly string[];
}

export interface PlanResponse {
  readonly plan: QueryPlan;
  readonly tokens: number;
}

export interface QueryPlanner {
  plan(req: PlanRequest): Promise<PlanResponse>;
}

/**
 * A deterministic mock planner. It reads simple cues from the question to choose seed kinds and
 * relationships - e.g. "why did we choose X" is a decision-rationale query, so it seeds on
 * Decision/Technology and traverses the support/discussion/requirement edges. It is a pure
 * function of its input, which keeps the whole pipeline reproducible.
 */
export class MockQueryPlanner implements QueryPlanner {
  async plan(req: PlanRequest): Promise<PlanResponse> {
    const q = req.question.toLowerCase();
    const plan: QueryPlan = {
      seedKinds: seedKindsFor(q),
      traverse: ["SUPPORTED_BY", "DISCUSSED_IN", "REQUIRES", "MADE", "DECIDED_IN", "ABOUT", "USES"],
      maxHops: 3,
    };
    const tokens = 18 + tokenishLength(req.question);
    return { plan, tokens };
  }
}

/** A planner returning a fixed plan - for targeted tests. */
export class ScriptedQueryPlanner implements QueryPlanner {
  constructor(private readonly fixed: QueryPlan, private readonly tokens = 20) {}
  async plan(): Promise<PlanResponse> {
    return { plan: this.fixed, tokens: this.tokens };
  }
}

function seedKindsFor(q: string): QueryPlan["seedKinds"] {
  if (/\bwho\b/.test(q)) return ["Person", "Decision"];
  if (/\bwhen\b|\bmeeting\b/.test(q)) return ["Meeting", "Decision"];
  if (/\bwhy\b|\bchoose\b|\bchose\b|\bdecision\b|\breason\b/.test(q)) return ["Decision", "Technology"];
  if (/\btask\b|\bwork\b|\bproject\b/.test(q)) return ["Project", "Task"];
  return ["Decision", "Document", "Technology"];
}

function tokenishLength(text: string): number {
  return Math.min(60, text.split(/\s+/).length);
}
