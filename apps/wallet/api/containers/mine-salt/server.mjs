// TIP-1022 salt mining HTTP server.
//
// POST /mine  { address: "0x..." }  →  { salt: "0x...", masterId: "0x...", elapsedMs: number }
// GET  /healthz                     →  200 OK
//
// The browser ALWAYS re-validates the returned salt locally with
// VirtualMaster.validateSalt before submitting on-chain — so even a bad/
// malicious response can't trick the wallet into broadcasting an invalid tx.
// This server therefore has no special trust boundary beyond "it tries".

import { createServer } from 'node:http';
import { VirtualMaster } from 'ox/tempo';

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 4 * 1024;

const isHexAddress = v => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(data),
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      send(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/mine') {
      send(res, 404, { error: 'Not found' });
      return;
    }

    const body = await readJson(req);
    const { address } = body ?? {};
    if (!isHexAddress(address)) {
      send(res, 400, { error: 'Invalid address — expected 20-byte hex' });
      return;
    }

    const startedAt = Date.now();
    console.log(JSON.stringify({ event: 'mine.start', address }));

    const result = await VirtualMaster.mineSaltAsync({ address });
    if (!result) {
      send(res, 500, { error: 'Mining exhausted without finding a valid salt' });
      return;
    }

    const masterId = VirtualMaster.getMasterId({ address, salt: result.salt });
    const elapsedMs = Date.now() - startedAt;
    console.log(JSON.stringify({ event: 'mine.done', address, masterId, elapsedMs }));

    send(res, 200, { salt: result.salt, masterId, elapsedMs });
  } catch (err) {
    console.error(JSON.stringify({ event: 'mine.error', message: err?.message }));
    send(res, 500, { error: err?.message ?? 'Internal error' });
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ event: 'server.listening', port: PORT }));
});

// Graceful shutdown — Cloudflare sends SIGTERM when the container is being
// drained on sleep timeout / scale down.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(JSON.stringify({ event: 'server.shutdown', signal: sig }));
    server.close(() => process.exit(0));
  });
}
