import type { ZodType, ZodTypeDef } from "zod";
import { ValidationError } from "@/domain/errors";

// Input pinned to `any`: schemas with `.default()`/`.refine()` have an
// Input type that differs from Output (e.g. optional-before-default vs.
// required-after-default), and inferring T from both the covariant Output
// and contravariant Input position at once collapses T to the wrong
// (pre-default) shape. Only Output — what callers actually receive — is
// meant to be inferred here.
export async function parseJsonBody<T>(request: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ValidationError("Corpo da requisição inválido — JSON esperado.");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Dados inválidos.");
  }

  return result.data;
}
