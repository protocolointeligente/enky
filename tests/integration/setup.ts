import { existsSync } from "node:fs";
import path from "node:path";

// Unlike tests/setup.ts (unit tests, fake env), integration tests need the
// real local .env — Prisma must talk to an actual PostgreSQL instance.
const envPath = path.resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
