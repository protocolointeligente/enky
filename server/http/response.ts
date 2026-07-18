import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAppError, RateLimitError } from "@/domain/errors";
import { logger } from "@/server/observability/logger";

interface SuccessBody<T> {
  ok: true;
  data: T;
}

interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    correlationId: string;
  };
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<SuccessBody<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

// Prisma schema-drift codes: the running database is behind the committed
// schema/migrations. P2021 = table missing, P2022 = column missing. This is
// NOT transient (retrying never helps) and NOT a client mistake — it's a
// deploy that shipped code without running `prisma migrate deploy`. Surfacing
// the generic "tente novamente" here is exactly what hid the periodization
// failure in production, so we give it its own actionable message.
function isSchemaDriftError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

// Handled AppErrors return their own message and status. Unknown errors are
// logged in full server-side but only ever surface a generic message to the
// client in production, keyed by correlationId for support/debugging.
export function apiError(error: unknown, correlationId = randomUUID()): NextResponse<ErrorBody> {
  if (isSchemaDriftError(error)) {
    logger.error({ correlationId, err: error }, "database schema drift — pending migration");
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_OUT_OF_DATE",
          message:
            "Este recurso está indisponível porque o banco de dados está desatualizado " +
            "(migração pendente). Repetir não resolve — avise o suporte com o código abaixo.",
          correlationId,
        },
      },
      { status: 503 },
    );
  }

  if (isAppError(error)) {
    logger.warn({ correlationId, code: error.code }, error.message);
    const headers =
      error instanceof RateLimitError
        ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) }
        : undefined;
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, correlationId } },
      { status: error.httpStatus, headers },
    );
  }

  logger.error({ correlationId, err: error }, "unhandled error");
  const message =
    process.env.NODE_ENV === "production"
      ? "Erro interno. Tente novamente mais tarde."
      : error instanceof Error
        ? error.message
        : "Erro desconhecido.";

  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message, correlationId } },
    { status: 500 },
  );
}
