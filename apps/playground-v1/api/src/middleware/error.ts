import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return { error: this.code, message: this.message, statusCode: this.statusCode };
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly details: Array<{ field: string; message: string }>;

  constructor(message: string, details: Array<{ field: string; message: string }> = []) {
    super(message);
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

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

function formatZodError(error: ZodError) {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
  return { message: 'Validation failed', details };
}

export function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') as string | undefined;

  if (!(err instanceof ValidationError) && !(err instanceof ZodError)) {
    console.error(`[${requestId || 'no-id'}] Error:`, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  }

  if (err instanceof HTTPException) {
    return c.json(createErrorResponse('HTTP_ERROR', err.message, requestId), err.status);
  }

  if (err instanceof ZodError) {
    const { message, details } = formatZodError(err);
    return c.json(createErrorResponse('VALIDATION_ERROR', message, requestId, details), 400);
  }

  if (err instanceof AppError) {
    const response = createErrorResponse(
      err.code,
      err.message,
      requestId,
      err instanceof ValidationError ? err.details : undefined
    );
    return c.json(
      response,
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503
    );
  }

  if (err.message?.includes('UNIQUE constraint failed')) {
    return c.json(createErrorResponse('CONFLICT', 'Resource already exists', requestId), 409);
  }

  if (err.message?.includes('FOREIGN KEY constraint failed')) {
    return c.json(
      createErrorResponse('BAD_REQUEST', 'Invalid reference to related resource', requestId),
      400
    );
  }

  return c.json(
    createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.',
      requestId
    ),
    500
  );
}
