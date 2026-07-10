export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE_VIOLATION"
  | "EXTERNAL_SERVICE_ERROR";

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly httpStatus = 400;
}

export class AuthenticationError extends AppError {
  readonly code = "AUTHENTICATION_ERROR" as const;
  readonly httpStatus = 401;
}

export class AuthorizationError extends AppError {
  readonly code = "AUTHORIZATION_ERROR" as const;
  readonly httpStatus = 403;
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly httpStatus = 404;
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
  readonly httpStatus = 409;
}

export class BusinessRuleError extends AppError {
  readonly code = "BUSINESS_RULE_VIOLATION" as const;
  readonly httpStatus = 422;
}

export class ExternalServiceError extends AppError {
  readonly code = "EXTERNAL_SERVICE_ERROR" as const;
  readonly httpStatus = 502;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
