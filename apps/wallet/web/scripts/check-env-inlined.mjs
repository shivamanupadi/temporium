/**
 * Post-build guard: assert the production API URL was statically inlined
 * into the built bundle. A build made without doppler env (plain
 * `vite build`) silently falls back to http://localhost:8008 at runtime —
 * this catches that BEFORE deploy.
 *
 * Run under doppler so the expected value is present:
 *   doppler run -p temporium-web -c prd -- node scripts/check-env-inlined.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';

const url = process.env.VITE_API_URL;
if (!url) {
  console.error('check-env-inlined: VITE_API_URL not in env — run under doppler.');
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.error(
    `check-env-inlined: VITE_API_URL=${url} is not a production URL. Refusing to deploy.`
  );
  process.exit(1);
}

const bundles = readdirSync('dist/assets').filter(n => n.startsWith('index-') && n.endsWith('.js'));
if (bundles.length === 0) {
  console.error('check-env-inlined: no dist/assets/index-*.js — build first.');
  process.exit(1);
}

const ok = bundles.some(n => readFileSync(`dist/assets/${n}`, 'utf8').includes(url));
if (!ok) {
  console.error(
    `check-env-inlined: ${url} NOT inlined in ${bundles.join(', ')} — this dist was built without doppler env. Refusing to deploy.`
  );
  process.exit(1);
}
console.log(`check-env-inlined: ok — ${url} inlined in ${bundles.join(', ')}`);
