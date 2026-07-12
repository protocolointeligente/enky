import { existsSync } from "node:fs";
import path from "node:path";

// Unlike tests/setup.ts (unit tests, fake env), integration tests need the
// real local .env — Prisma must talk to an actual PostgreSQL instance.
const envPath = path.resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Integration tests (and migrations) use the DIRECT connection, not the
// pooler. The `-pooler` host (PgBouncer) is for the serverless runtime with
// many short-lived connections; a low-concurrency test run should hit the
// compute directly — Neon's own guidance. Avoids pooler-specific connect
// failures and doesn't reroute the app's own DATABASE_URL.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
