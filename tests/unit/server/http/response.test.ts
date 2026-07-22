import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { apiError, apiSuccess } from "@/server/http/response";

// The periodization production failure was a Prisma schema-drift error (a
// committed migration never deployed) masquerading as a generic 500. These
// tests pin the branch that now surfaces it as an actionable, non-transient
// message so it can never silently regress into "Erro interno" again.

// Minimal shape of a Prisma known-request error — we only depend on `.code`.
function prismaError(code: string) {
  return Object.assign(new Error(`Prisma ${code}`), { code });
}

describe("apiError", () => {
  it("maps a missing-column drift (P2022) to a 503 SCHEMA_OUT_OF_DATE, not a generic 500", async () => {
    const res = apiError(prismaError("P2022"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("SCHEMA_OUT_OF_DATE");
    expect(body.error.message).toMatch(/migração pendente/i);
    expect(body.error.message).not.toMatch(/tente novamente/i);
    expect(body.error.correlationId).toBeTruthy();
  });

  it("maps a missing-table drift (P2021) the same way", async () => {
    const res = apiError(prismaError("P2021"));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("SCHEMA_OUT_OF_DATE");
  });

  it("still honours handled AppErrors (ValidationError → 400 with its own message)", async () => {
    const res = apiError(new ValidationError("Informe a modalidade."));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Informe a modalidade.");
  });

  it("falls back to a generic 500 for unknown non-drift errors", async () => {
    const res = apiError(new Error("boom"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("apiSuccess wraps data with ok:true", async () => {
    const res = apiSuccess({ hello: "world" }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, data: { hello: "world" } });
  });
});
