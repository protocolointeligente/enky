import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitError, ExternalServiceError } from "@/domain/errors";
import {
  enforceRateLimit,
  InMemoryRateLimiter,
  UpstashRateLimiter,
  createRateLimiter,
  inviteRateLimiter,
  loginRateLimiter,
} from "@/server/security/rate-limit";

describe("server/security/rate-limit", () => {
  describe("InMemoryRateLimiter", () => {
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

  describe("createRateLimiter", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns InMemoryRateLimiter in development/test when config is missing", () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "test";

      const limiter = createRateLimiter(5, 60_000);
      expect(limiter).toBeInstanceOf(InMemoryRateLimiter);
    });

    it("returns UpstashRateLimiter when config variables are present", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

      const limiter = createRateLimiter(5, 60_000);
      expect(limiter).toBeInstanceOf(UpstashRateLimiter);
    });

    // Regressão: a URL do Upstash já foi validada no schema global de lib/env,
    // e um valor malformado derrubou TODA rota que toca `env` em produção
    // (/api/health e /api/auth/session inclusive). A validação mora aqui agora,
    // então um valor inválido degrada só o rate limit — nunca o app inteiro.
    it("trata URL malformada como não-configurada, sem derrubar nada além do rate limit", () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "test";
      for (const bad of ["mock-redis.upstash.io", "redis://default:x@y.upstash.io:6379", "  ", "não-é-url"]) {
        process.env.UPSTASH_REDIS_REST_URL = bad;
        expect(createRateLimiter(5, 60_000), `URL inválida: ${bad}`).toBeInstanceOf(
          InMemoryRateLimiter,
        );
      }
    });

    it("aceita a REST URL com barra ou espaços sobrando", () => {
      process.env.UPSTASH_REDIS_REST_URL = "  https://mock-redis.upstash.io/  ";
      process.env.UPSTASH_REDIS_REST_TOKEN = "  mock-token  ";
      expect(createRateLimiter(5, 60_000)).toBeInstanceOf(UpstashRateLimiter);
    });

    // Produção sem Upstash degrada para memória, NÃO barra. A versão anterior
    // lançava (fail-closed) e o resultado prático foi login inteiro fora do ar
    // por uma env var errada — trocar a autenticação toda pela proteção de
    // brute-force é o pior dos dois mundos. Degradado + log alto.
    it("em produção sem config: degrada para memória e avisa, sem derrubar o login", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "production";
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});

      const limiter = createRateLimiter(2, 60_000);
      await expect(limiter.consume("key")).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0]?.[0])).toContain("DEGRADADO");

      // Continua limitando de fato (por instância), e avisa uma vez só.
      await limiter.consume("key");
      expect((await limiter.consume("key")).allowed).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });
  });

  // Limitadores reais configurados (requisito 6: rate limit de login e de
  // convite). Em teste (NODE_ENV=test, sem UPSTASH) os singletons são InMemory,
  // criados no import — determinístico. Chaves únicas evitam colisão de estado.
  describe("limitadores configurados de login e convite", () => {
    it("login: bloqueia após 10 tentativas na mesma chave (janela de 5min)", async () => {
      const key = "login:audit-fase1@enky.local";
      for (let i = 0; i < 10; i++) {
        expect((await loginRateLimiter.consume(key)).allowed).toBe(true);
      }
      const blocked = await loginRateLimiter.consume(key);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });

    it("convite: bloqueia após 20 convites do mesmo treinador (janela de 1h)", async () => {
      const key = "invite:audit-fase1-trainer";
      for (let i = 0; i < 20; i++) {
        expect((await inviteRateLimiter.consume(key)).allowed).toBe(true);
      }
      expect((await inviteRateLimiter.consume(key)).allowed).toBe(false);
    });
  });

  describe("UpstashRateLimiter", () => {
    const mockUrl = "https://mock-redis.upstash.io";
    const mockToken = "mock-token";
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("allows request and returns allowed:true when limit is not exceeded", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { result: 1 }, // INCR
          { result: "OK" }, // PEXPIRE
          { result: 60000 }, // PTTL
        ],
      } as Response);

      const limiter = new UpstashRateLimiter(mockUrl, mockToken, 5, 60_000);
      const result = await limiter.consume("test-key");

      expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${mockUrl}/pipeline`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it("blocks request and returns retryAfterMs when limit is exceeded", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { result: 6 }, // INCR (limit is 5)
          { result: 0 }, // PEXPIRE
          { result: 45000 }, // PTTL
        ],
      } as Response);

      const limiter = new UpstashRateLimiter(mockUrl, mockToken, 5, 60_000);
      const result = await limiter.consume("test-key");

      expect(result).toEqual({ allowed: false, retryAfterMs: 45000 });
    });

    it("throws ExternalServiceError when fetch fails", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network failure"));

      const limiter = new UpstashRateLimiter(mockUrl, mockToken, 5, 60_000);
      await expect(limiter.consume("test-key")).rejects.toBeInstanceOf(ExternalServiceError);
    });

    it("throws ExternalServiceError when response is not ok", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const limiter = new UpstashRateLimiter(mockUrl, mockToken, 5, 60_000);
      await expect(limiter.consume("test-key")).rejects.toBeInstanceOf(ExternalServiceError);
    });

    it("throws ExternalServiceError when Redis returns pipeline command error", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { error: "Some redis internal error" },
          { result: 0 },
          { result: 0 },
        ],
      } as Response);

      const limiter = new UpstashRateLimiter(mockUrl, mockToken, 5, 60_000);
      await expect(limiter.consume("test-key")).rejects.toBeInstanceOf(ExternalServiceError);
    });
  });
});

