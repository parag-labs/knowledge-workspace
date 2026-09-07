/**
 * Drizzle schema for persisting a knowledge graph. Two tables: entities and relationships.
 * The spec suggests Postgres (+ pgvector) for self-hosting; embeddings here are deterministic
 * and recomputed on load, so the base schema stores just the graph. A pgvector column can be
 * added later without changing the domain model.
 */

import { pgTable, text } from "drizzle-orm/pg-core";

export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  section: text("section"),
  source: text("source"),
});

export const relationships = pgTable("relationships", {
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  type: text("type").notNull(),
});

export type EntityRow = typeof entities.$inferSelect;
export type RelationshipRow = typeof relationships.$inferSelect;
