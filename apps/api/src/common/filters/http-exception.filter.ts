import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface ExceptionResponseObject {
  message?: string | string[];
  error?: string;
}

/**
 * Global HTTP Exception Filter for Fastify
 *
 * Provides consistent error response format across all endpoints.
 * This filter catches all exceptions and formats them uniformly,
 * eliminating the need for try-catch blocks in controllers.
 *
 * Response format:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   timestamp: string,
 *   path: string
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as ExceptionResponseObject;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }

      // Log client errors (4xx) at warn level, but don't spam logs for validation errors
      if (status >= 400 && status < 500) {
        if (
          status !== (HttpStatus.BAD_REQUEST as number) ||
          !Array.isArray(message)
        ) {
          this.logger.warn(
            `[${request.method}] ${request.url} - ${status}: ${JSON.stringify(message)}`,
          );
        }
      }
    } else {
      // Unexpected error - log full details
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';

      const errorMessage =
        exception instanceof Error ? exception.message : 'Unknown error';
      const errorStack =
        exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `[${request.method}] ${request.url} - Unhandled exception: ${errorMessage}`,
        errorStack,
      );
    }

    const responseBody = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).send(responseBody);
  }
}
