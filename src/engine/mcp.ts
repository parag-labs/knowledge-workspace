/**
 * The MCP-style tool surface the spec asks for: knowledge.search, knowledge.related,
 * knowledge.get_entity, knowledge.get_evidence. These are thin, typed, deterministic wrappers
 * over the graph - the same functions an MCP server would expose to an external agent. Each
 * validates its arguments with Zod at the boundary.
 */

import { z } from "zod";
import { EntityId } from "./ids";
import { relationType } from "./entities";
import { MockQueryPlanner } from "./llm";
import { ask } from "./orchestrator";
import { retrieve } from "./answer";
import type { KnowledgeGraph } from "./graph";

export const searchArgs = z.object({ query: z.string().min(1), limit: z.number().int().positive().max(20).optional() });
export const relatedArgs = z.object({ id: z.string().min(1), types: z.array(relationType).optional() });
export const getEntityArgs = z.object({ id: z.string().min(1) });
export const getEvidenceArgs = z.object({ question: z.string().min(1) });

/** Build the tool set bound to a specific graph. */
export function knowledgeTools(graph: KnowledgeGraph) {
  return {
    /** knowledge.search - semantic search over entities. */
    "knowledge.search": (raw: unknown) => {
      const { query, limit } = searchArgs.parse(raw);
      return graph.search(query, { limit: limit ?? 5 });
    },

    /** knowledge.related - typed neighbours of an entity. */
    "knowledge.related": (raw: unknown) => {
      const { id, types } = relatedArgs.parse(raw);
      return graph.neighbours(EntityId(id), types);
    },

    /** knowledge.get_entity - fetch one entity by id. */
    "knowledge.get_entity": (raw: unknown) => {
      const { id } = getEntityArgs.parse(raw);
      return graph.get(EntityId(id));
    },

    /** knowledge.get_evidence - run the planner+retriever and return grounded evidence. */
    "knowledge.get_evidence": async (raw: unknown) => {
      const { question } = getEvidenceArgs.parse(raw);
      const { plan } = await new MockQueryPlanner().plan({
        question,
        availableKinds: [],
        availableRelations: [],
      });
      return retrieve(graph, question, plan).evidence;
    },

    /** knowledge.ask - convenience: full grounded answer. */
    "knowledge.ask": (raw: unknown) => {
      const { question } = getEvidenceArgs.parse(raw);
      return ask(graph, question, { planner: new MockQueryPlanner() });
    },
  } as const;
}

export type KnowledgeTools = ReturnType<typeof knowledgeTools>;
