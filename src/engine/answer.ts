/**
 * The retriever and grounded answerer: the deterministic heart. Given the planner's proposed
 * plan, it finds seed entities by semantic search, traverses the graph along the permitted
 * relationships, collects evidence with a confidence score, and composes an answer *only* from
 * that evidence. Every claim carries a citation (source + section + confidence); nothing is
 * invented. If the evidence is too weak, it says so rather than guessing.
 */

import { EvidenceId, makeCounter, type EntityId } from "./ids";
import type { Entity } from "./entities";
import type { Evidence, KnowledgeGraph, SearchHit } from "./graph";
import type { QueryPlan } from "./llm";

/** A single grounded claim: a sentence plus the evidence it rests on. */
export interface Claim {
  readonly text: string;
  readonly evidence: Evidence;
}

export interface GroundedAnswer {
  readonly text: string;
  readonly claims: readonly Claim[];
  readonly evidence: readonly Evidence[];
  readonly sufficient: boolean;
  readonly missing: string | undefined;
}

/** Minimum seed similarity below which we treat the graph as lacking an answer. */
const MIN_SEED_SCORE = 0.12;

/** Kinds whose text is quotable as evidence for an answer. */
const QUOTABLE = new Set(["Decision", "Document", "Requirement", "Meeting", "Technology", "Person"]);

export interface RetrieveResult {
  readonly seeds: SearchHit[];
  readonly reached: Map<string, number>;
  readonly evidence: Evidence[];
}

/** Run semantic search + traversal to gather evidence for a question. Pure and deterministic. */
export function retrieve(graph: KnowledgeGraph, question: string, plan: QueryPlan): RetrieveResult {
  const seeds = graph.search(question, { kinds: plan.seedKinds.length ? plan.seedKinds : undefined, limit: 4 });
  const strongSeeds = seeds.filter((s) => s.score >= MIN_SEED_SCORE);

  const reached = graph.traverse(
    strongSeeds.map((s) => s.entity.id),
    plan.traverse,
    plan.maxHops,
  );

  const evId = makeCounter("ev");
  const seedScore = new Map(strongSeeds.map((s) => [String(s.entity.id), s.score]));

  const evidence: Evidence[] = [...reached.entries()]
    .flatMap(([id, hop]) => {
      const entity = graph.get(id as unknown as EntityId);
      if (!entity || !QUOTABLE.has(entity.kind)) return [];
      const confidence = confidenceFor(seedScore.get(id), hop);
      const ev: Evidence = {
        id: EvidenceId(evId()),
        entity,
        source: entity.source ?? entity.name,
        section: entity.section,
        confidence,
      };
      return [ev];
    })
    .sort((a, b) => b.confidence - a.confidence);

  return { seeds, reached, evidence };
}

/**
 * Compose a grounded answer from retrieved evidence. The answer is assembled from the evidence
 * entities' own text, and every claim is tied to one evidence item. If there is no strong seed
 * or no quotable evidence, the answer is marked insufficient and the missing information is
 * reported instead of a fabricated response.
 */
export function compose(question: string, result: RetrieveResult): GroundedAnswer {
  const strong = result.seeds.filter((s) => s.score >= MIN_SEED_SCORE);
  if (strong.length === 0) {
    return {
      text: "I don't have enough grounded evidence in the graph to answer that.",
      claims: [],
      evidence: [],
      sufficient: false,
      missing: "no entity in the knowledge graph is semantically close to the question",
    };
  }

  const top = result.evidence.slice(0, 5);
  if (top.length === 0) {
    return {
      text: "I found related entities but no citable evidence connected to them.",
      claims: [],
      evidence: [],
      sufficient: false,
      missing: "the seed entities have no supporting documents, requirements, or meetings",
    };
  }

  const claims: Claim[] = top.map((ev) => ({ text: claimSentence(ev.entity), evidence: ev }));
  const lead = leadSentence(question, strong[0]!.entity);
  const text = [lead, ...claims.map((c) => `- ${c.text} [${citation(c)}]`)].join("\n");

  return { text, claims, evidence: top, sufficient: true, missing: undefined };
}

/** Deterministic confidence: seed similarity if this is a seed, else decayed by hop distance. */
function confidenceFor(seedScore: number | undefined, hop: number): number {
  if (seedScore !== undefined) return round(0.6 + 0.4 * seedScore);
  return round(Math.max(0.2, 0.85 - hop * 0.2));
}

function leadSentence(question: string, seed: Entity): string {
  return `Based on the knowledge graph, here is what supports "${question.trim()}" (anchored on ${seed.kind.toLowerCase()} "${seed.name}"):`;
}

function claimSentence(entity: Entity): string {
  const body = entity.text.trim() || entity.name;
  if (entity.kind === "Person") return `${entity.name} — ${body}`;
  return `${entity.kind}: ${body}`;
}

function citation(claim: Claim): string {
  const { source, section, confidence } = claim.evidence;
  const where = section ? `${source} § ${section}` : source;
  return `${where} · confidence ${confidence.toFixed(2)}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
