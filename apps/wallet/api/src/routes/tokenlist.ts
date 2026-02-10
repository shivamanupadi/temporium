import { Hono } from 'hono';
import { ExternalServiceError } from '../middleware/error';
import type { Env, Variables } from '../types/env';

const TOKENLIST_BASE_URL = 'https://tokenlist.tempo.xyz';
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

const tokenlistRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /tokenlist/*
 * Proxy requests to tokenlist.tempo.xyz
 */
tokenlistRouter.get('/*', async c => {
  const path = c.req.path.replace('/tokenlist', '') || '/';
  const url = new URL(path, TOKENLIST_BASE_URL);

  // Forward query parameters
  const searchParams = new URL(c.req.url).searchParams;
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Temporium-API/2.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Tokenlist service error: ${response.status} ${response.statusText}`);

      if (response.status === 404) {
        return c.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Token list not found',
            },
          },
          404
        );
      }

      throw new ExternalServiceError('Tokenlist service unavailable', 'tokenlist.tempo.xyz');
    }

    // Return raw response - this is a pure proxy, don't wrap
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Tokenlist request timed out');
      throw new ExternalServiceError('Tokenlist service timed out', 'tokenlist.tempo.xyz');
    }

    // Re-throw our custom errors
    if (error instanceof ExternalServiceError) {
      throw error;
    }

    console.error('Tokenlist proxy error:', error);
    throw new ExternalServiceError('Failed to fetch tokenlist', 'tokenlist.tempo.xyz');
  }
});

export default tokenlistRouter;
