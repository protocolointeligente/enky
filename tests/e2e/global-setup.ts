import { existsSync } from "node:fs";
import path from "node:path";

// E2E specs seed a trainer+athlete pair via direct module calls (see
// workout-flow.spec.ts) — there's no real inbox in this environment to
// receive the invitation e-mail DevInvitationMailer only logs. Those
// module calls need the same DATABASE_URL `npm run dev` itself reads from
// .env; this runs once, in the main process, before any worker (which
// inherits process.env) is spawned.
export default function globalSetup(): void {
  const envPath = path.resolve(__dirname, "../../.env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}
