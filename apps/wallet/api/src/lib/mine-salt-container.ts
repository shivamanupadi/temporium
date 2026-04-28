/**
 * Cloudflare Container that hosts the TIP-1022 salt-mining server defined
 * under apps/wallet/api/containers/mine-salt. The Worker invokes it via the
 * `MINE_SALT_CONTAINER` Durable Object binding wired up in wrangler.toml.
 *
 * The container's `server.mjs` listens on :8080 and exposes:
 *   POST /mine    { address }  →  { salt, masterId, elapsedMs }
 *   GET  /healthz              →  200 OK
 */
import { Container } from '@cloudflare/containers';
import type { Env } from '../types/env';

export class MineSaltContainer extends Container<Env> {
  defaultPort = 8080;
  // Stay warm for a couple minutes so back-to-back registrations skip cold
  // start. PoW mining is the dominant cost — keeping the container alive a
  // bit longer is a rounding error.
  sleepAfter = '120s';
}
