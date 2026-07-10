import type { ZodType } from "zod";
import { ValidationError } from "@/domain/errors";

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
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
