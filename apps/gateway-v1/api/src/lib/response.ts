import type { Context } from 'hono';

/**
 * Standard API response format
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Create a standardized success response
 */
export function success<T>(c: Context, data: T, status: 200 | 201 = 200) {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };
  return c.json(response, status);
}

/**
 * Create a standardized paginated response
 * The `data` envelope is { items, nextCursor } so the existing apiRequest<T> unwrapper works.
 */
export function paginated<T>(c: Context, items: T[], nextCursor: string | null) {
  return c.json({
    success: true,
    data: { items, nextCursor },
  }, 200);
}

/**
 * Create a standardized no-content response (for deletes)
 */
export function noContent(c: Context) {
  return c.body(null, 204);
}
