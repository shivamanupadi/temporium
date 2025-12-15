interface Env {
  API_ORIGIN: string;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(origin, allowedOrigins);
    }

    // Forward request to Railway API
    const apiUrl = new URL(url.pathname + url.search, env.API_ORIGIN);

    const response = await fetch(apiUrl.toString(), {
      method: request.method,
      headers: forwardHeaders(request.headers),
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Clone response and add CORS headers
    const newResponse = new Response(response.body, response);
    setCorsHeaders(newResponse.headers, origin, allowedOrigins);

    return newResponse;
  },
};

function handleCors(origin: string, allowedOrigins: string[]): Response {
  const headers = new Headers();
  setCorsHeaders(headers, origin, allowedOrigins);
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

function setCorsHeaders(headers: Headers, origin: string, allowedOrigins: string[]): void {
  if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function forwardHeaders(headers: Headers): Headers {
  const forwarded = new Headers();
  const allowList = ['content-type', 'authorization', 'accept', 'user-agent', 'x-request-id'];

  for (const key of allowList) {
    const value = headers.get(key);
    if (value) {
      forwarded.set(key, value);
    }
  }

  return forwarded;
}
