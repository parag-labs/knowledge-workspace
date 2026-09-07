/**
 * The typed knowledge-graph model. Entities are a discriminated union on `kind`, and edges
 * are typed by a relationship enum. Keeping both as string-literal unions means an invalid
 * entity kind or relationship type is a compile error, and exhaustive switches stay honest.
 */

import { z } from "zod";
import type { EntityId } from "./ids";

/** Every entity kind in the graph (the spec's entity list). */
export const entityKind = z.enum([
  "Person",
  "Project",
  "Document",
  "Decision",
  "Meeting",
  "Task",
  "Requirement",
  "Technology",
]);
export type EntityKind = z.infer<typeof entityKind>;

/** Every relationship type. Directed: `from` --type--> `to`. */
export const relationType = z.enum([
  "MADE", // Person -> Decision
  "SUPPORTED_BY", // Decision -> Document
  "DISCUSSED_IN", // Document -> Meeting
  "USES", // Project -> Technology
  "BELONGS_TO", // Task -> Project
  "REQUIRES", // Project/Decision -> Requirement
  "ATTENDED", // Person -> Meeting
  "DECIDED_IN", // Decision -> Meeting
  "ABOUT", // Decision/Document -> Technology
]);
export type RelationType = z.infer<typeof relationType>;

/** A node in the graph. `text` is the searchable content; `section` locates it in its source. */
export interface Entity {
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly name: string;
  readonly text: string;
  /** For a Document/Meeting, the section/heading a claim can be cited to. */
  readonly section?: string;
  /** Source label shown in citations (e.g. a doc title or meeting name). */
  readonly source?: string;
}

/** A directed, typed edge between two entities. */
export interface Relationship {
  readonly from: EntityId;
  readonly to: EntityId;
  readonly type: RelationType;
}

/** Narrow an entity to a specific kind. */
export type EntityOfKind<K extends EntityKind> = Entity & { kind: K };

export function assertNever(x: never, message = "unexpected variant"): never {
  throw new Error(`${message}: ${JSON.stringify(x)}`);
}

// --- Zod schemas for untrusted ingestion ---

export const entitySchema = z.object({
  id: z.string().min(1),
  kind: entityKind,
  name: z.string().min(1),
  text: z.string(),
  section: z.string().optional(),
  source: z.string().optional(),
});

export const relationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: relationType,
});

export const graphInputSchema = z.object({
  entities: z.array(entitySchema),
  relationships: z.array(relationshipSchema),
});
export type GraphInput = z.infer<typeof graphInputSchema>;
