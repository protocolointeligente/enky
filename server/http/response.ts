import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAppError } from "@/domain/errors";
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

// Handled AppErrors return their own message and status. Unknown errors are
// logged in full server-side but only ever surface a generic message to the
// client in production, keyed by correlationId for support/debugging.
export function apiError(error: unknown, correlationId = randomUUID()): NextResponse<ErrorBody> {
  if (isAppError(error)) {
    logger.warn({ correlationId, code: error.code }, error.message);
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, correlationId } },
      { status: error.httpStatus },
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
