/**
 * A seed knowledge graph built around the spec's worked example ("Why did we choose Cosmos
 * DB?"). It is shared by the tests, the evaluation harness, and the UI demo so there is one
 * source of truth. The data is deliberately small but richly connected: people make decisions,
 * decisions are supported by documents and requirements, documents are discussed in meetings,
 * projects use technologies.
 */

import type { GraphInput } from "./entities";

export const seedGraph: GraphInput = {
  entities: [
    { id: "p_ana", kind: "Person", name: "Ana Ruiz", text: "Principal engineer, data platform." },
    { id: "p_ben", kind: "Person", name: "Ben Cole", text: "Staff engineer, backend services." },

    { id: "proj_atlas", kind: "Project", name: "Project Atlas", text: "Global catalog service serving millions of users." },

    {
      id: "dec_cosmos",
      kind: "Decision",
      name: "Adopt Azure Cosmos DB",
      text: "We chose Azure Cosmos DB as the primary datastore for Project Atlas because it offers turnkey global distribution and single-digit-millisecond reads at the required scale.",
      source: "ADR-014: Primary datastore",
      section: "Decision",
    },
    {
      id: "dec_hash",
      kind: "Decision",
      name: "Use consistent hashing for sharding",
      text: "Shard keys are assigned with consistent hashing to keep rebalancing cheap when partitions are added.",
      source: "ADR-015: Sharding",
      section: "Decision",
    },

    {
      id: "doc_design",
      kind: "Document",
      name: "Atlas Datastore Design",
      text: "The design compares Cosmos DB, PostgreSQL and DynamoDB against the latency and multi-region requirements; Cosmos DB is the only option meeting the global write SLA without bespoke replication.",
      source: "Atlas Datastore Design",
      section: "Options considered",
    },
    {
      id: "doc_bench",
      kind: "Document",
      name: "Datastore Benchmark",
      text: "Benchmarks show p99 read latency of 8ms across three regions under 50k RPS, within the performance requirement.",
      source: "Datastore Benchmark",
      section: "Results",
    },

    {
      id: "req_latency",
      kind: "Requirement",
      name: "Global low-latency reads",
      text: "Reads must complete under 10ms at p99 in every served region.",
      source: "Atlas PRD",
      section: "NFR-3",
    },
    {
      id: "req_scale",
      kind: "Requirement",
      name: "Multi-region writes",
      text: "The datastore must accept writes in at least three regions with automatic conflict resolution.",
      source: "Atlas PRD",
      section: "NFR-4",
    },

    {
      id: "meet_arch",
      kind: "Meeting",
      name: "Architecture Review 2026-02",
      text: "The architecture review approved Cosmos DB after reviewing the design and benchmark evidence.",
      source: "Architecture Review 2026-02",
      section: "Minutes",
    },

    { id: "tech_cosmos", kind: "Technology", name: "Azure Cosmos DB", text: "Globally distributed, multi-model database with tunable consistency." },
    { id: "tech_pg", kind: "Technology", name: "PostgreSQL", text: "Relational database; strong single-region, needs bespoke multi-region replication." },

    { id: "task_migrate", kind: "Task", name: "Migrate catalog to Cosmos DB", text: "Move the catalog service reads and writes onto Cosmos DB." },
  ],
  relationships: [
    { from: "p_ana", to: "dec_cosmos", type: "MADE" },
    { from: "p_ben", to: "dec_hash", type: "MADE" },
    { from: "dec_cosmos", to: "doc_design", type: "SUPPORTED_BY" },
    { from: "dec_cosmos", to: "doc_bench", type: "SUPPORTED_BY" },
    { from: "dec_cosmos", to: "req_latency", type: "REQUIRES" },
    { from: "dec_cosmos", to: "req_scale", type: "REQUIRES" },
    { from: "dec_cosmos", to: "tech_cosmos", type: "ABOUT" },
    { from: "doc_design", to: "meet_arch", type: "DISCUSSED_IN" },
    { from: "doc_bench", to: "meet_arch", type: "DISCUSSED_IN" },
    { from: "dec_cosmos", to: "meet_arch", type: "DECIDED_IN" },
    { from: "p_ana", to: "meet_arch", type: "ATTENDED" },
    { from: "proj_atlas", to: "tech_cosmos", type: "USES" },
    { from: "task_migrate", to: "proj_atlas", type: "BELONGS_TO" },
  ],
};

/** Example questions the demo and eval use. */
export const exampleQuestions = {
  whyCosmos: "Why did we choose Cosmos DB?",
  whoDecided: "Who made the decision to adopt Cosmos DB?",
  unknown: "What is our policy on pineapple pizza?",
} as const;
