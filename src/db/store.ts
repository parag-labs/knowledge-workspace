/**
 * The persistence boundary. The engine builds and queries a KnowledgeGraph in memory; a
 * `Store` loads/saves the graph's entities and relationships. Two implementations exist:
 *
 *  - `MemoryStore` - the default, used by the demo, unit tests, and any deployment without a
 *    database. Zero external dependencies.
 *  - `PgStore` - a Drizzle/Postgres implementation, exercised by the integration test and used
 *    when DATABASE_URL is present.
 *
 * Keeping this an interface means CI stays green without a database while still proving the
 * Postgres path works when one is provided.
 */

import type { GraphInput } from "../engine/entities";

export interface Store {
  saveGraph(graph: GraphInput): Promise<void>;
  loadGraph(): Promise<GraphInput>;
}

/** An in-memory store. Fully deterministic, no I/O - the default everywhere a DB is absent. */
export class MemoryStore implements Store {
  private graph: GraphInput = { entities: [], relationships: [] };

  async saveGraph(graph: GraphInput): Promise<void> {
    this.graph = graph;
  }

  async loadGraph(): Promise<GraphInput> {
    return this.graph;
  }
}
