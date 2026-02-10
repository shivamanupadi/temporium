import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// ============ Custom Error Classes ============

/**
 * Base class for application errors
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/**
 * 400 Bad Request - Invalid input data
 */
export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

/**
 * 400 Validation Error - Schema validation failed
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly details: Array<{ field: string; message: string }>;

  constructor(message: string, details: Array<{ field: string; message: string }> = []) {
    super(message);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details.length > 0 ? this.details : undefined,
    };
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

/**
 * 403 Forbidden - Authenticated but not allowed
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

/**
 * 422 Unprocessable Entity - Semantic error in request
 */
export class UnprocessableError extends AppError {
  readonly statusCode = 422;
  readonly code = 'UNPROCESSABLE_ENTITY';
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
}

/**
 * 502 Bad Gateway - External service error
 */
export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly service: string;

  constructor(message: string, service: string) {
    super(message);
    this.service = service;
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';
}

// ============ Error Response Format ============

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId?: string;
  };
}

function createErrorResponse(
  code: string,
  message: string,
  requestId?: string,
  details?: Array<{ field: string; message: string }>
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 && { details }),
      ...(requestId && { requestId }),
    },
  };
}

// ============ Error Handler ============

/**
 * Convert Zod errors to validation error format
 */
function formatZodError(error: ZodError): {
  message: string;
  details: Array<{ field: string; message: string }>;
} {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return {
    message: 'Validation failed',
    details,
  };
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') as string | undefined;

  // Log error for debugging (excluding validation errors for noise reduction)
  if (!(err instanceof ValidationError) && !(err instanceof ZodError)) {
    console.error(`[${requestId || 'no-id'}] Error:`, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  }

  // Handle Hono's HTTPException
  if (err instanceof HTTPException) {
    return c.json(createErrorResponse('HTTP_ERROR', err.message, requestId), err.status);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const { message, details } = formatZodError(err);
    return c.json(createErrorResponse('VALIDATION_ERROR', message, requestId, details), 400);
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    const response = createErrorResponse(
      err.code,
      err.message,
      requestId,
      err instanceof ValidationError ? err.details : undefined
    );

    // Add Retry-After header for rate limit errors
    if (err instanceof RateLimitError) {
      c.header('Retry-After', err.retryAfter.toString());
    }

    return c.json(
      response,
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503
    );
  }

  // Handle D1/SQLite unique constraint violations
  if (err.message?.includes('UNIQUE constraint failed')) {
    return c.json(createErrorResponse('CONFLICT', 'Resource already exists', requestId), 409);
  }

  // Handle D1/SQLite foreign key violations
  if (err.message?.includes('FOREIGN KEY constraint failed')) {
    return c.json(
      createErrorResponse('BAD_REQUEST', 'Invalid reference to related resource', requestId),
      400
    );
  }

  // Generic internal server error (hide details in production)
  return c.json(
    createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.',
      requestId
    ),
    500
  );
}
