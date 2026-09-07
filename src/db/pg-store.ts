/**
 * The Postgres-backed store, using Drizzle over the `postgres` driver. Only constructed when
 * DATABASE_URL is set. It persists the graph's entities and relationships and rehydrates them
 * into the engine's typed `GraphInput`.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { entities, relationships } from "./schema";
import type { Store } from "./store";
import type { EntityKind, GraphInput, RelationType } from "../engine/entities";

export class PgStore implements Store {
  private constructor(
    private readonly db: PostgresJsDatabase,
    private readonly sql: postgres.Sql,
  ) {}

  static connect(url: string): PgStore {
    const sql = postgres(url, { max: 4 });
    return new PgStore(drizzle(sql), sql);
  }

  async migrate(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        section TEXT,
        source TEXT
      )`;
    await this.sql`
      CREATE TABLE IF NOT EXISTS relationships (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL
      )`;
  }

  async saveGraph(graph: GraphInput): Promise<void> {
    await this.sql`DELETE FROM relationships`;
    await this.sql`DELETE FROM entities`;
    if (graph.entities.length > 0) {
      await this.db.insert(entities).values(
        graph.entities.map((e) => ({ id: e.id, kind: e.kind, name: e.name, body: e.text, section: e.section ?? null, source: e.source ?? null })),
      );
    }
    if (graph.relationships.length > 0) {
      await this.db.insert(relationships).values(
        graph.relationships.map((r) => ({ fromId: r.from, toId: r.to, type: r.type })),
      );
    }
  }

  async loadGraph(): Promise<GraphInput> {
    const eRows = await this.db.select().from(entities);
    const rRows = await this.db.select().from(relationships);
    return {
      entities: eRows.map((e) => ({
        id: e.id,
        kind: e.kind as EntityKind,
        name: e.name,
        text: e.body,
        ...(e.section ? { section: e.section } : {}),
        ...(e.source ? { source: e.source } : {}),
      })),
      relationships: rRows.map((r) => ({ from: r.fromId, to: r.toId, type: r.type as RelationType })),
    };
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
