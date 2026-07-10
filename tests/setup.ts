// Test-only environment defaults so lib/env.ts can be imported without a
// real .env file present. Never used outside the Vitest process.
process.env.DATABASE_URL ??= "postgresql://enky:enky@localhost:5432/enky_test?schema=public";
process.env.AUTH_SECRET ??= "test-environment-only-secret-value-not-for-production-use";
process.env.APP_URL ??= "http://localhost:3000";
process.env.LOG_LEVEL ??= "silent";
