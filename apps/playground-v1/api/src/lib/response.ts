import type { Context } from 'hono';

interface SuccessResponse<T> {
  success: true;
  data: T;
}

export function success<T>(c: Context, data: T, status: 200 | 201 = 200) {
  const response: SuccessResponse<T> = { success: true, data };
  return c.json(response, status);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}
