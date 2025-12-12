/**
 * Tollr Keys Worker
 * Cloudflare Worker + D1 for storing WebAuthn public keys
 * Uses tempo.ts/server Handler.keyManager
 */

import { Handler, Kv } from 'tempo.ts/server';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

/**
 * D1 adapter for tempo.ts Kv interface
 */
function kvFromD1(db: D1Database): Kv.Kv {
  return {
    async get<T = unknown>(key: string): Promise<T> {
      const result = await db
        .prepare('SELECT value FROM passkeys WHERE key = ?')
        .bind(key)
        .first<{ value: string }>();

      if (!result) return undefined as T;

      try {
        return JSON.parse(result.value) as T;
      } catch {
        return result.value as T;
      }
    },

    async set(key: string, value: unknown): Promise<void> {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await db
        .prepare(
          'INSERT INTO passkeys (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
        )
        .bind(key, serialized, serialized)
        .run();
    },

    async delete(key: string): Promise<void> {
      await db.prepare('DELETE FROM passkeys WHERE key = ?').bind(key).run();
    },
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'tollr-keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tokenlist proxy (bypasses CORS)
    if (url.pathname.startsWith('/tokenlist/')) {
      const targetPath = url.pathname.replace('/tokenlist', '');
      const targetUrl = `https://tokenlist.tempo.xyz${targetPath}${url.search}`;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      });
    }

    // Use tempo.ts Handler.keyManager
    const handler = Handler.keyManager({
      kv: kvFromD1(env.DB),
      path: '/keys',
      headers: corsHeaders,
    });

    return handler.fetch(request);
  },
};
