// Stub for the "server-only" package. Its real implementation relies on
// Next.js's webpack resolve.alias to swap between a no-op and a throwing
// module depending on client/server bundle — a trick Vitest's plain Node
// resolution doesn't participate in, so the real package throws unconditionally
// here. Aliased in vitest.config.ts for tests only; production keeps the real guard.
export {};
