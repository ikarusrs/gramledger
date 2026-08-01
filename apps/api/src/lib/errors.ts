/**
 * Application errors carrying an HTTP status + stable machine-readable code.
 * The error middleware serializes these into a consistent JSON shape.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

export function internalError(message = 'Internal server error'): AppError {
  return new AppError(500, 'INTERNAL_ERROR', message);
}
