# Contributing

Thanks for taking a look. This is a personal portfolio project, but it follows the workflow
I'd use on a team.

## Setup

```bash
pnpm install
pnpm dev
```

Requirements: Node 20+ and pnpm 9+. No API keys and no database needed — the default embedder
is deterministic and the default planner is a mock.

## Before you push

CI runs exactly these; all must be green:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

A separate CI job spins up Postgres and runs the integration test; locally it auto-skips unless
you set `DATABASE_URL`.

## Ground rules

- **The engine stays framework-free.** Nothing in `src/engine/` may import from `src/app`,
  `src/components`, or `src/db`. The dependency arrow points app → engine only.
- **Keep the core rule intact.** The planner proposes a query plan; deterministic code
  traverses and answers. Never add a path where model output becomes an answer directly. Every
  claim must be backed by an evidence item.
- **Validate every boundary.** Planner output and ingested graph data are parsed with Zod.
- **Determinism.** Use the injected clock, id counter, and the deterministic embedder — no
  `Math.random()` or bare `Date.now()` in engine logic a test can't control. The mock planner
  must stay pure.
- **Never fabricate eval numbers.** The README table is produced by `pnpm eval`. If behavior
  changes, re-run it and paste the real output.
- **Types over comments.** Prefer making an invalid state unrepresentable (branded ids,
  discriminated unions, relationship-type unions) to documenting that it shouldn't happen.

## Commit style

Small, focused commits with imperative subjects. One concern per commit.
