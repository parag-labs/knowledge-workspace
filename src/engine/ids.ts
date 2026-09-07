/**
 * Branded id types. Entity ids and evidence ids are distinct at compile time even though both
 * are strings at runtime, so you can't pass one where the other is expected.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type EntityId = Brand<string, "EntityId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type QueryId = Brand<string, "QueryId">;

export const EntityId = (s: string): EntityId => s as EntityId;
export const EvidenceId = (s: string): EvidenceId => s as EvidenceId;
export const QueryId = (s: string): QueryId => s as QueryId;

export function makeCounter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}
