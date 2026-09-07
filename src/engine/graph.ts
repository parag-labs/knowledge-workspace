/**
 * The knowledge graph: an in-memory, deterministic store of entities and typed relationships,
 * with adjacency indexes for fast traversal and precomputed embeddings for semantic search.
 * The spec is explicit that a dedicated graph database is not needed - a well-indexed
 * in-memory structure (backed by Postgres for self-hosting, see src/db) is enough.
 *
 * This is the deterministic core the query planner's proposals run against. It never calls a
 * model; it only traverses, ranks, and retrieves.
 */

import { cosine, HashingEmbedder, tokenize, type Embedder } from "./embedding";
import { EntityId, type EvidenceId } from "./ids";
import type { Entity, EntityKind, GraphInput, Relationship, RelationType } from "./entities";

/** A neighbour reached by following one typed edge. */
export interface Neighbour {
  readonly entity: Entity;
  readonly via: RelationType;
  readonly direction: "out" | "in";
}

/** A scored semantic-search hit. */
export interface SearchHit {
  readonly entity: Entity;
  readonly score: number;
}

/** A piece of grounded evidence: an entity, where it came from, and how confident we are. */
export interface Evidence {
  readonly id: EvidenceId;
  readonly entity: Entity;
  readonly source: string;
  readonly section: string | undefined;
  readonly confidence: number;
}

export class KnowledgeGraph {
  private readonly entities = new Map<string, Entity>();
  private readonly relationships: Relationship[] = [];
  private readonly outIndex = new Map<string, Relationship[]>();
  private readonly inIndex = new Map<string, Relationship[]>();
  private readonly vectors = new Map<string, number[]>();
  private readonly tokens = new Map<string, Set<string>>();

  constructor(private readonly embedder: Embedder = new HashingEmbedder()) {}

  /** Build a graph from validated input. Embeddings are computed once, deterministically. */
  static from(input: GraphInput, embedder: Embedder = new HashingEmbedder()): KnowledgeGraph {
    const g = new KnowledgeGraph(embedder);
    for (const e of input.entities) g.addEntity(e as Entity);
    for (const r of input.relationships) g.addRelationship(r as Relationship);
    return g;
  }

  addEntity(entity: Entity): void {
    this.entities.set(String(entity.id), entity);
    const content = `${entity.name}. ${entity.text}`;
    this.vectors.set(String(entity.id), this.embedder.embed(content));
    this.tokens.set(String(entity.id), new Set(tokenize(content)));
  }

  addRelationship(rel: Relationship): void {
    this.relationships.push(rel);
    push(this.outIndex, String(rel.from), rel);
    push(this.inIndex, String(rel.to), rel);
  }

  get(id: EntityId): Entity | undefined {
    return this.entities.get(String(id));
  }

  all(): Entity[] {
    return [...this.entities.values()];
  }

  allRelationships(): readonly Relationship[] {
    return this.relationships;
  }

  /**
   * Semantic search: rank entities by cosine similarity to the query embedding. A lexical
   * overlap gate is applied first - an entity must share at least one real (non-stopword)
   * token with the query to count as a hit. This removes the false positives a hashing
   * embedding can produce via bucket collisions, so an unrelated question returns nothing.
   */
  search(query: string, opts: { kinds?: readonly EntityKind[]; limit?: number } = {}): SearchHit[] {
    const q = this.embedder.embed(query);
    const qTokens = new Set(tokenize(query));
    const limit = opts.limit ?? 5;
    return this.all()
      .filter((e) => !opts.kinds || opts.kinds.includes(e.kind))
      .filter((e) => shareToken(qTokens, this.tokens.get(String(e.id))))
      .map((entity) => ({ entity, score: round(cosine(q, this.vectors.get(String(entity.id)) ?? [])) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Neighbours of an entity, optionally restricted to certain relationship types. */
  neighbours(id: EntityId, types?: readonly RelationType[]): Neighbour[] {
    const out = (this.outIndex.get(String(id)) ?? [])
      .filter((r) => !types || types.includes(r.type))
      .flatMap((r) => {
        const entity = this.get(r.to);
        return entity ? [{ entity, via: r.type, direction: "out" as const }] : [];
      });
    const inc = (this.inIndex.get(String(id)) ?? [])
      .filter((r) => !types || types.includes(r.type))
      .flatMap((r) => {
        const entity = this.get(r.from);
        return entity ? [{ entity, via: r.type, direction: "in" as const }] : [];
      });
    return [...out, ...inc];
  }

  /**
   * Breadth-first traversal from seed entities, following only the permitted relationship
   * types, up to `maxHops`. Returns the reached entities with the hop distance at which each
   * was first found - the basis for deterministic confidence scoring.
   */
  traverse(seeds: readonly EntityId[], types: readonly RelationType[], maxHops: number): Map<string, number> {
    const distance = new Map<string, number>();
    let frontier: EntityId[] = [];
    for (const s of seeds) {
      if (this.entities.has(String(s))) {
        distance.set(String(s), 0);
        frontier.push(s);
      }
    }
    for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
      const next: EntityId[] = [];
      for (const id of frontier) {
        for (const n of this.neighbours(id, types)) {
          const key = String(n.entity.id);
          if (!distance.has(key)) {
            distance.set(key, hop);
            next.push(EntityId(key));
          }
        }
      }
      frontier = next;
    }
    return distance;
  }

  /** The subgraph induced by a set of entity ids (for visualization). */
  subgraph(ids: Iterable<string>): { entities: Entity[]; relationships: Relationship[] } {
    const set = new Set(ids);
    const entities = [...set].flatMap((id) => {
      const e = this.entities.get(id);
      return e ? [e] : [];
    });
    const relationships = this.relationships.filter((r) => set.has(String(r.from)) && set.has(String(r.to)));
    return { entities, relationships };
  }
}

function push(index: Map<string, Relationship[]>, key: string, rel: Relationship): void {
  const arr = index.get(key);
  if (arr) arr.push(rel);
  else index.set(key, [rel]);
}

/** True if the query shares at least one real token with an entity's token set. */
function shareToken(queryTokens: Set<string>, entityTokens: Set<string> | undefined): boolean {
  if (!entityTokens) return false;
  for (const t of queryTokens) if (entityTokens.has(t)) return true;
  return false;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
