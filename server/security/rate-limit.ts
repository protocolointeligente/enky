import { RateLimitError } from "@/domain/errors";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Safe for local development and
// single-instance deployments ONLY — state lives in process memory, resets
// on redeploy, and does not coordinate across multiple server instances.
// Replace with a shared store (Redis/Upstash) before scaling beyond one
// process; callers depend only on the RateLimiter interface, so that swap
// requires no changes outside this file.
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }

    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
}

export async function enforceRateLimit(limiter: RateLimiter, key: string): Promise<void> {
  const result = await limiter.consume(key);
  if (!result.allowed) {
    throw new RateLimitError("Muitas tentativas. Tente novamente mais tarde.", result.retryAfterMs);
  }
}

// Pre-configured limiters for the identity/invitation flows. Keyed by the
// caller (route handler) using IP for anonymous endpoints and normalized
// email for account-specific brute-force protection.
export const registerRateLimiter = new InMemoryRateLimiter(5, 60 * 60 * 1000); // 5/hora por IP
export const loginRateLimiter = new InMemoryRateLimiter(10, 5 * 60 * 1000); // 10/5min por e-mail
export const inviteRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000); // 20/hora por treinador
export const resendInvitationRateLimiter = new InMemoryRateLimiter(5, 60 * 60 * 1000); // 5/hora por convite
export const revokeInvitationRateLimiter = new InMemoryRateLimiter(30, 60 * 60 * 1000); // 30/hora por treinador
export const activateInvitationRateLimiter = new InMemoryRateLimiter(10, 15 * 60 * 1000); // 10/15min por IP
export const passwordResetRateLimiter = new InMemoryRateLimiter(5, 60 * 60 * 1000); // 5/hora por IP
export const workoutWriteRateLimiter = new InMemoryRateLimiter(60, 60 * 60 * 1000); // 60/hora por treinador
export const feedbackWriteRateLimiter = new InMemoryRateLimiter(30, 60 * 60 * 1000); // 30/hora por atleta
export const libraryWriteRateLimiter = new InMemoryRateLimiter(120, 60 * 60 * 1000); // 120/hora por treinador (exercícios + templates)
