import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/domain/errors";
import { enforceRateLimit, InMemoryRateLimiter } from "@/server/security/rate-limit";

describe("server/security/rate-limit", () => {
  it("allows requests up to the limit within the window", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) {
      const result = await limiter.consume("key");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests past the limit and reports a positive retryAfterMs", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    await limiter.consume("key");
    const result = await limiter.consume("key");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    await limiter.consume("a");
    const result = await limiter.consume("b");
    expect(result.allowed).toBe(true);
  });

  it("enforceRateLimit throws RateLimitError once the limit is exceeded", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    await enforceRateLimit(limiter, "key");
    await expect(enforceRateLimit(limiter, "key")).rejects.toBeInstanceOf(RateLimitError);
  });
});
