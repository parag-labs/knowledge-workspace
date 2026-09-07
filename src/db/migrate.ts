/**
 * Standalone migration entry point (`pnpm db:migrate`). Creates the tables if they do not
 * exist and seeds the demo graph. Requires DATABASE_URL. Used by the CI integration job.
 */

import { PgStore } from "./pg-store";
import { seedGraph } from "../engine/examples";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const store = PgStore.connect(url);
  await store.migrate();
  await store.saveGraph(seedGraph);
  await store.close();
  console.log("migrations applied and demo graph seeded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
