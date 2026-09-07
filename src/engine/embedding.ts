/**
 * A deterministic, dependency-free text embedding. Real RAG uses a model to embed text; for a
 * reproducible demo that needs no API key we use a fixed hashing embedding: tokenize, hash each
 * token into a fixed-width vector, and L2-normalize. The same text always yields the same
 * vector, so semantic-search results - and therefore the eval numbers - are stable and
 * committable. The `Embedder` interface means a real model can drop in behind it later.
 */

const DIMS = 512;

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
  "we", "our", "why", "did", "do", "does", "how", "what", "which", "that", "this", "it", "with",
]);

export interface Embedder {
  embed(text: string): number[];
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** FNV-1a hash → bucket in [0, DIMS). Deterministic across runs and platforms. */
function bucket(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % DIMS;
}

/** The default deterministic hashing embedder. */
export class HashingEmbedder implements Embedder {
  embed(text: string): number[] {
    const v = new Array<number>(DIMS).fill(0);
    for (const token of tokenize(text)) {
      const b = bucket(token);
      v[b] = (v[b] ?? 0) + 1;
    }
    return normalize(v);
  }
}

export function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return mag === 0 ? v : v.map((x) => x / mag);
}

/** Cosine similarity of two equal-length vectors (both assumed normalized or not). */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    ma += ai * ai;
    mb += bi * bi;
  }
  if (ma === 0 || mb === 0) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}
