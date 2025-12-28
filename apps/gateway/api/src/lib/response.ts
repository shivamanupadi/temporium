import type { Context } from 'hono';

/**
 * Standard API response format
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
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
 */
export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { total: number; page: number; limit: number }
) {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
  };
  return c.json(response, 200);
}

/**
 * Create a standardized no-content response (for deletes)
 */
export function noContent(c: Context) {
  return c.body(null, 204);
}

/**
 * Create a simple success message response
 */
export function ok(c: Context, message: string = 'Success') {
  return c.json({ success: true, message }, 200);
}
