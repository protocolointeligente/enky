import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  ExternalServiceError,
  isAppError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors";

describe("domain/errors", () => {
  it("maps each AppError subclass to its expected code and HTTP status", () => {
    expect(new ValidationError("bad input")).toMatchObject({
      code: "VALIDATION_ERROR",
      httpStatus: 400,
    });
    expect(new AuthenticationError("no session")).toMatchObject({
      code: "AUTHENTICATION_ERROR",
      httpStatus: 401,
    });
    expect(new AuthorizationError("forbidden")).toMatchObject({
      code: "AUTHORIZATION_ERROR",
      httpStatus: 403,
    });
    expect(new NotFoundError("missing")).toMatchObject({
      code: "NOT_FOUND",
      httpStatus: 404,
    });
    expect(new ConflictError("stale version")).toMatchObject({
      code: "CONFLICT",
      httpStatus: 409,
    });
    expect(new BusinessRuleError("rule violated")).toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
      httpStatus: 422,
    });
    expect(new ExternalServiceError("gateway down")).toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 502,
    });
  });

  it("preserves the original message and an optional cause", () => {
    const cause = new Error("root cause");
    const error = new NotFoundError("athlete not found", cause);

    expect(error.message).toBe("athlete not found");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("NotFoundError");
  });

  it("distinguishes AppError instances from arbitrary errors", () => {
    expect(isAppError(new ValidationError("x"))).toBe(true);
    expect(isAppError(new Error("plain error"))).toBe(false);
    expect(isAppError("not an error")).toBe(false);
  });
});
