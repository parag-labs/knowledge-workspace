/**
 * The orchestrator: turns a question into a grounded answer, event by event. It asks the
 * planner to *propose* a query plan, validates it with Zod, bounds it, then runs the
 * deterministic retrieve → compose pipeline over the graph. Every step is an event, so a query
 * streams live and replays exactly.
 *
 * The rule the whole design enforces: the LLM plans and proposes; deterministic code traverses,
 * grounds, and answers - and never fabricates a claim without a citation.
 */

import { compose, retrieve, type GroundedAnswer } from "./answer";
import { EventLog, type LoggedEvent, type RunStatus } from "./events";
import { EntityId, makeCounter, QueryId } from "./ids";
import { queryPlanSchema, type QueryPlanner } from "./llm";
import { entityKind, relationType } from "./entities";
import type { KnowledgeGraph } from "./graph";

export interface AgentLimits {
  readonly maxHops: number;
  readonly tokenBudget: number;
}

export const DEFAULT_LIMITS: AgentLimits = { maxHops: 4, tokenBudget: 2000 };

export interface QueryOptions {
  readonly planner: QueryPlanner;
  readonly clock?: () => number;
  readonly queryId?: QueryId;
  readonly limits?: Partial<AgentLimits>;
  readonly onEvent?: (e: LoggedEvent) => void;
}

export interface QueryResult {
  readonly queryId: QueryId;
  readonly status: RunStatus;
  readonly answer: GroundedAnswer;
  readonly events: readonly LoggedEvent[];
  readonly reachedIds: readonly string[];
  readonly tokens: number;
  readonly error?: string;
}

/** Answer a question against a knowledge graph, emitting an event log. */
export async function ask(graph: KnowledgeGraph, question: string, opts: QueryOptions): Promise<QueryResult> {
  const clock = opts.clock ?? (() => Date.now());
  const queryId = opts.queryId ?? QueryId(makeCounter("q")());
  const limits: AgentLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const log = new EventLog(queryId, clock, opts.onEvent);

  log.append({ type: "QueryStarted", question });

  try {
    const { plan, tokens } = await opts.planner.plan({
      question,
      availableKinds: entityKind.options,
      availableRelations: relationType.options,
    });
    if (tokens > limits.tokenBudget) throw new Error(`token budget exceeded: ${tokens} > ${limits.tokenBudget}`);

    // Zod at the trust boundary: the model's plan is validated before the engine acts on it.
    const parsed = queryPlanSchema.safeParse(plan);
    if (!parsed.success) throw new Error(`planner returned an invalid plan: ${parsed.error.issues.map((i) => i.message).join("; ")}`);

    // Bound the traversal depth regardless of what the model asked for.
    const boundedPlan = { ...parsed.data, maxHops: Math.min(parsed.data.maxHops, limits.maxHops) };
    log.append({ type: "PlanProposed", seedKinds: boundedPlan.seedKinds, traverse: boundedPlan.traverse, maxHops: boundedPlan.maxHops, tokens });

    const result = retrieve(graph, question, boundedPlan);
    log.append({
      type: "SeedsFound",
      seeds: result.seeds.map((s) => ({ id: s.entity.id, name: s.entity.name, score: s.score })),
    });
    log.append({ type: "Traversed", reached: result.reached.size, hops: boundedPlan.maxHops });

    const answer = compose(question, result);
    for (const ev of answer.evidence) {
      log.append({ type: "EvidenceCollected", id: ev.id, entity: ev.entity.id, source: ev.source, section: ev.section, confidence: ev.confidence });
    }

    if (!answer.sufficient) {
      log.append({ type: "MissingInfo", detail: answer.missing ?? "insufficient evidence" });
      log.append({ type: "AnswerComposed", answer: answer.text, citations: 0 });
      log.append({ type: "QueryCompleted", status: "insufficient_evidence" });
      return { queryId, status: "insufficient_evidence", answer, events: log.all(), reachedIds: [...result.reached.keys()], tokens };
    }

    log.append({ type: "AnswerComposed", answer: answer.text, citations: answer.claims.length });
    log.append({ type: "QueryCompleted", status: "answered" });
    return { queryId, status: "answered", answer, events: log.all(), reachedIds: [...result.reached.keys()], tokens };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.append({ type: "QueryFailed", error });
    return {
      queryId,
      status: "failed",
      answer: { text: "", claims: [], evidence: [], sufficient: false, missing: error },
      events: log.all(),
      reachedIds: [],
      tokens: 0,
      error,
    };
  }
}

/** Re-export for callers that build seed ids. */
export { EntityId };
