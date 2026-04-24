/**
 * TIP-1022 Virtual Forwarding Addresses API
 *
 * Lets a user register a master wallet with the on-chain AddressRegistry
 * precompile, then hand out unlimited off-chain "virtual" deposit addresses
 * that auto-forward to that master.
 *
 * Routes:
 *   GET    /v1/virtual-addresses/master            (auth) — read caller's master (cache → 404)
 *   POST   /v1/virtual-addresses/master            (auth) — persist a master the client just registered on-chain
 *   POST   /v1/virtual-addresses/master/lookup     (auth) — link an existing on-chain master by masterId
 *   POST   /v1/virtual-addresses/master/recover    (auth) — find caller's master by scanning the last ~10 days of MasterRegistered events
 *   POST   /v1/virtual-addresses/master/mine-salt  (auth) — grind a TIP-1022 PoW salt server-side via container
 *   GET    /v1/virtual-addresses                   (auth) — list caller's virtual addresses
 *   POST   /v1/virtual-addresses                   (auth) — mint a new virtual address (server picks userTag)
 *   POST   /v1/virtual-addresses/import            (auth) — record an address generated elsewhere
 *   GET    /v1/virtual-addresses/:id               (auth)
 *   DELETE /v1/virtual-addresses/:id               (auth)
 */
import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { parseEventLogs, toHex, type Address } from 'viem';
import {
  Abis as TempoAbis,
  Addresses as TempoAddresses,
  VirtualAddress,
  VirtualMaster,
} from 'viem/tempo';

import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/error';
import { createDb, virtualAddresses, virtualMasters } from '../db';
import { createTempoPublicClient } from '../lib/viem';
import {
  createVirtualAddressSchema,
  idParamSchema,
  importVirtualAddressSchema,
  lookupVirtualMasterSchema,
  registerVirtualMasterSchema,
} from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.use('/*', jwtAuth);

// =============================================================================
// Master registration
// =============================================================================

/**
 * GET /v1/virtual-addresses/master
 *
 * Returns the caller's cached master row, or 404. Discovery of an
 * elsewhere-registered master happens through the explicit lookup flow
 * (POST /master/lookup) — we don't scan event logs because Tempo's RPC caps
 * eth_getLogs at 100k blocks, and the on-chain registry call gives perfect
 * ground truth as soon as the user supplies the masterId.
 */
router.get('/master', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const cached = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);
  if (cached.length > 0) return success(c, cached[0]);

  throw new NotFoundError('No master registered for this wallet');
});

/**
 * POST /v1/virtual-addresses/master
 *
 * Called after the user signs the on-chain `registerVirtualMaster` tx.
 * Server re-verifies the salt+masterId+on-chain state, then either
 * transitions an existing pending row to `registered` (resume case) or
 * inserts a fresh registered row.
 */
router.post('/master', zValidator('json', registerVirtualMasterSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { masterId, salt, txHash, network } = c.req.valid('json');

  if (VirtualAddress.isVirtual(owner)) {
    throw new BadRequestError('Virtual addresses cannot be registered as masters');
  }

  if (!VirtualMaster.validateSalt({ address: owner as Address, salt: salt as `0x${string}` })) {
    throw new BadRequestError('Salt does not satisfy proof-of-work');
  }

  const derived = VirtualMaster.getMasterId({
    address: owner as Address,
    salt: salt as `0x${string}`,
  });
  if (derived.toLowerCase() !== masterId) {
    throw new BadRequestError('masterId does not match salt + address');
  }

  const { chain, rpcUrl } = c.get('networkConfig');
  const publicClient = createTempoPublicClient(rpcUrl, chain);
  const onchain = await publicClient.virtualAddress.getMasterAddress({
    masterId: masterId as `0x${string}`,
  });
  if (!onchain || onchain.toLowerCase() !== owner) {
    throw new BadRequestError('On-chain registry does not resolve this masterId to your wallet');
  }

  const existing = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === 'registered') {
      throw new ConflictError('Master already registered for this wallet');
    }
    // Pending row → transition to registered.
    if (row.masterId.toLowerCase() !== masterId) {
      throw new BadRequestError(
        'Pending master ID for this wallet does not match the supplied masterId'
      );
    }
    const updated = await db
      .update(virtualMasters)
      .set({ status: 'registered', txHash, salt })
      .where(eq(virtualMasters.id, row.id))
      .returning();
    return success(c, updated[0]);
  }

  const inserted = await db
    .insert(virtualMasters)
    .values({
      owner,
      masterId,
      salt,
      txHash,
      status: 'registered',
      discoveredFrom: 'portal',
      network,
    })
    .returning();

  return success(c, inserted[0], 201);
});

/**
 * POST /v1/virtual-addresses/master/lookup
 *
 * Manual entry path for users whose master was registered outside our portal
 * (CLI, another dapp) and whose registration is too old to surface via the
 * recent-events scan in `GET /master`. The user supplies their `masterId`;
 * the precompile gives ground truth — we only persist it if
 * `getMaster(masterId) === wallet`.
 */
router.post('/master/lookup', zValidator('json', lookupVirtualMasterSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { masterId } = c.req.valid('json');

  if (VirtualAddress.isVirtual(owner)) {
    throw new BadRequestError('Virtual addresses cannot be registered as masters');
  }

  const existing = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);
  if (existing.length > 0) return success(c, existing[0]);

  const { chain, rpcUrl, network } = c.get('networkConfig');
  const publicClient = createTempoPublicClient(rpcUrl, chain);
  const onchain = await publicClient.virtualAddress.getMasterAddress({
    masterId: masterId as `0x${string}`,
  });
  if (!onchain || onchain.toLowerCase() !== owner) {
    throw new BadRequestError('That masterId does not resolve to your wallet on-chain');
  }

  const inserted = await db
    .insert(virtualMasters)
    .values({
      owner,
      masterId,
      salt: null,
      txHash: null,
      discoveredFrom: 'onchain',
      network,
    })
    .returning();

  return success(c, inserted[0], 201);
});

/**
 * POST /v1/virtual-addresses/master/recover
 *
 * Searches the last ~10 days of `MasterRegistered` event logs for a
 * registration whose `masterAddress` topic matches the caller. Walks
 * backward from `latest` in 100k-block chunks (Tempo RPC's max range)
 * until a hit, the window is exhausted, or genesis is reached.
 *
 * Each chunk is one async `eth_getLogs` (I/O bound), and most wallets find
 * their registration in the first chunk — total wall time typically a couple
 * of seconds.
 *
 * On hit: verify on-chain via `getMaster(masterId)`, persist with
 * `discoveredFrom='onchain'`. Returns the master row. On miss: 404 with a
 * message pointing the user at the manual lookup flow.
 */
router.post('/master/recover', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  if (VirtualAddress.isVirtual(owner)) {
    throw new BadRequestError('Virtual addresses cannot be registered as masters');
  }

  // Already linked? Just return it.
  const existing = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);
  if (existing.length > 0 && existing[0].status === 'registered') {
    return success(c, existing[0]);
  }

  const { chain, rpcUrl, network } = c.get('networkConfig');
  const publicClient = createTempoPublicClient(rpcUrl, chain);

  // Tempo RPC rejects ranges that "exceed 100000" — strictly under, not <=.
  // 50_000 keeps us comfortably inside any provider that's stricter than the
  // Moderato RPC's documented limit.
  const CHUNK_SIZE = 50_000n;
  // ~10 days at 1s blocks. Rounded up to a clean multiple of CHUNK_SIZE.
  const TEN_DAYS_BLOCKS = 900_000n;

  let latest: bigint;
  try {
    latest = await publicClient.getBlockNumber();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recover] getBlockNumber failed:', msg);
    throw new BadRequestError(`Could not query block height: ${msg}`);
  }
  const minBlock = latest > TEN_DAYS_BLOCKS ? latest - TEN_DAYS_BLOCKS : 0n;

  const eventDef = {
    name: 'MasterRegistered',
    type: 'event',
    inputs: [
      { type: 'bytes4', name: 'masterId', indexed: true },
      { type: 'address', name: 'masterAddress', indexed: true },
    ],
  } as const;

  console.info(
    `[recover] scanning ${owner} from ${minBlock} to ${latest} ` +
      `(${(latest - minBlock).toString()} blocks in ~${Math.ceil(Number(latest - minBlock) / Number(CHUNK_SIZE))} chunks)`
  );

  let toBlock = latest;
  while (toBlock >= minBlock) {
    const fromBlockRaw =
      toBlock > CHUNK_SIZE - 1n ? toBlock - (CHUNK_SIZE - 1n) : 0n;
    const effectiveFrom = fromBlockRaw < minBlock ? minBlock : fromBlockRaw;

    let logs;
    try {
      logs = await publicClient.getLogs({
        address: TempoAddresses.addressRegistry,
        event: eventDef,
        args: { masterAddress: owner as Address },
        fromBlock: effectiveFrom,
        toBlock,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[recover] getLogs failed for [${effectiveFrom}, ${toBlock}]:`,
        msg
      );
      // Surface to the client so we can see what's actually wrong instead of
      // silently failing the whole scan.
      throw new BadRequestError(
        `Recovery scan failed at block range [${effectiveFrom}, ${toBlock}]: ${msg}`
      );
    }

    if (logs.length > 0) {
      const parsed = parseEventLogs({
        abi: TempoAbis.addressRegistry,
        logs,
        eventName: 'MasterRegistered',
        strict: true,
      });
      const hit = parsed[0];
      if (hit) {
        const masterId = (hit.args.masterId as string).toLowerCase();
        const onchain = await publicClient.virtualAddress.getMasterAddress({
          masterId: masterId as `0x${string}`,
        });
        if (onchain?.toLowerCase() === owner) {
          // Upsert: pending row → mark registered, no row → insert fresh.
          if (existing.length > 0) {
            const updated = await db
              .update(virtualMasters)
              .set({
                masterId,
                txHash: hit.transactionHash.toLowerCase(),
                status: 'registered',
                discoveredFrom: 'onchain',
              })
              .where(eq(virtualMasters.id, existing[0].id))
              .returning();
            return success(c, updated[0]);
          }
          const inserted = await db
            .insert(virtualMasters)
            .values({
              owner,
              masterId,
              salt: null,
              txHash: hit.transactionHash.toLowerCase(),
              status: 'registered',
              discoveredFrom: 'onchain',
              network,
            })
            .returning();
          return success(c, inserted[0], 201);
        }
      }
    }

    if (effectiveFrom === 0n || effectiveFrom <= minBlock) break;
    toBlock = effectiveFrom - 1n;
  }

  throw new NotFoundError(
    'No registration found in the last 10 days. If you registered earlier, link it manually using your master ID.'
  );
});

/**
 * POST /v1/virtual-addresses/master/mine-salt
 *
 * Server-side TIP-1022 PoW grinding. Forwards the caller's wallet address
 * to the MineSaltContainer (Cloudflare Containers, standard-4 / 4 vCPU),
 * which runs ox/tempo's WASM keccak miner across worker_threads. Returns
 * the salt + masterId so the client can submit `registerVirtualMaster(salt)`
 * via their wallet.
 *
 * The browser MUST re-validate the salt locally (`VirtualMaster.validateSalt`)
 * before broadcasting — that's a millisecond op and protects against a
 * misbehaving container ever causing a bad on-chain submission.
 */
router.post('/master/mine-salt', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { network } = c.get('networkConfig');

  if (VirtualAddress.isVirtual(owner)) {
    throw new BadRequestError('Virtual addresses cannot be registered as masters');
  }

  // Resume case: if a pending row exists for this owner with the salt already
  // mined, return it instead of grinding again. Lets users close the tab and
  // come back without losing 90+ seconds of work.
  const existing = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);
  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === 'registered') {
      throw new ConflictError('Master already registered for this wallet');
    }
    if (row.salt) {
      return success(c, { salt: row.salt, masterId: row.masterId, elapsedMs: 0, resumed: true });
    }
    // Pending without salt shouldn't normally happen — fall through to mine.
  }

  // One container instance per master — getByName(owner) gives a stable
  // identity so concurrent requests from the same wallet share an instance
  // (mining is idempotent: any valid salt works).
  const stub = c.env.MINE_SALT_CONTAINER.get(
    c.env.MINE_SALT_CONTAINER.idFromName(owner)
  ) as unknown as { fetch: (req: Request) => Promise<Response> };

  const minerRes = await stub.fetch(
    new Request('http://mine-salt/mine', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: owner }),
    })
  );

  if (!minerRes.ok) {
    const body = await minerRes.text().catch(() => '');
    throw new BadRequestError(`Salt mining failed (${minerRes.status}): ${body || 'unknown'}`);
  }

  const payload = (await minerRes.json()) as { salt: string; masterId: string; elapsedMs: number };

  if (
    !VirtualMaster.validateSalt({
      address: owner as Address,
      salt: payload.salt as `0x${string}`,
    })
  ) {
    throw new BadRequestError('Container returned an invalid salt');
  }

  // Persist as pending so the user can resume after closing the tab without
  // re-mining. Upsert handles the race where two concurrent mine-salt calls
  // arrive — second one updates with whichever salt won.
  if (existing.length > 0) {
    await db
      .update(virtualMasters)
      .set({ salt: payload.salt, masterId: payload.masterId.toLowerCase() })
      .where(eq(virtualMasters.id, existing[0].id));
  } else {
    await db.insert(virtualMasters).values({
      owner,
      masterId: payload.masterId.toLowerCase(),
      salt: payload.salt,
      txHash: null,
      status: 'pending',
      discoveredFrom: 'portal',
      network,
    });
  }

  return success(c, {
    salt: payload.salt,
    masterId: payload.masterId,
    elapsedMs: payload.elapsedMs,
    resumed: false,
  });
});

// =============================================================================
// Virtual address CRUD
// =============================================================================

async function loadMaster(c: Context<{ Bindings: Env; Variables: Variables }>) {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const rows = await db
    .select()
    .from(virtualMasters)
    .where(eq(virtualMasters.owner, owner))
    .limit(1);
  if (rows.length === 0) {
    throw new BadRequestError('Register a master wallet before creating virtual addresses');
  }
  return { db, owner, master: rows[0] };
}

/**
 * GET /v1/virtual-addresses
 */
router.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const rows = await db
    .select()
    .from(virtualAddresses)
    .where(eq(virtualAddresses.owner, owner))
    .orderBy(desc(virtualAddresses.createdAt));

  return success(c, rows);
});

/**
 * GET /v1/virtual-addresses/:id
 */
router.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const rows = await db
    .select()
    .from(virtualAddresses)
    .where(and(eq(virtualAddresses.id, id), eq(virtualAddresses.owner, owner)))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError('Virtual address not found');
  return success(c, rows[0]);
});

/**
 * POST /v1/virtual-addresses
 *
 * Mints a new virtual address with a server-generated random 6-byte userTag.
 * Retries up to 3× on the unique-address index collision (astronomically
 * unlikely but cheap to guard against).
 */
router.post('/', zValidator('json', createVirtualAddressSchema), async c => {
  const { db, owner, master } = await loadMaster(c);
  const { label } = c.req.valid('json');

  for (let attempt = 0; attempt < 3; attempt++) {
    const userTagBytes = new Uint8Array(6);
    crypto.getRandomValues(userTagBytes);
    const userTag = toHex(userTagBytes);

    const address = VirtualAddress.from({
      masterId: master.masterId as `0x${string}`,
      userTag: userTag as `0x${string}`,
    }).toLowerCase();

    try {
      const inserted = await db
        .insert(virtualAddresses)
        .values({
          owner,
          masterId: master.masterId,
          userTag,
          address,
          label,
        })
        .returning();
      return success(c, inserted[0], 201);
    } catch (err) {
      if (err instanceof Error && err.message?.includes('UNIQUE constraint failed')) continue;
      throw err;
    }
  }

  throw new ConflictError('Could not generate a unique virtual address, please retry');
});

/**
 * POST /v1/virtual-addresses/import
 *
 * For addresses generated in another tool. Server verifies the pasted
 * address parses as a virtual address, its masterId matches the caller's,
 * and it isn't already recorded.
 */
router.post('/import', zValidator('json', importVirtualAddressSchema), async c => {
  const { db, owner, master } = await loadMaster(c);
  const { address: pasted, label } = c.req.valid('json');

  if (!VirtualAddress.isVirtual(pasted)) {
    throw new BadRequestError('Not a TIP-1022 virtual address');
  }

  const parsed = VirtualAddress.parse(pasted);
  if (parsed.masterId.toLowerCase() !== master.masterId.toLowerCase()) {
    throw new BadRequestError("This address doesn't belong to your master wallet");
  }

  const address = pasted.toLowerCase();
  const userTag = parsed.userTag.toLowerCase();

  const existing = await db
    .select()
    .from(virtualAddresses)
    .where(and(eq(virtualAddresses.owner, owner), eq(virtualAddresses.address, address)))
    .limit(1);
  if (existing.length > 0) throw new ConflictError('Address already recorded');

  const inserted = await db
    .insert(virtualAddresses)
    .values({
      owner,
      masterId: master.masterId,
      userTag,
      address,
      label,
    })
    .returning();

  return success(c, inserted[0], 201);
});

/**
 * DELETE /v1/virtual-addresses/:id
 *
 * Hard-delete the bookkeeping row. The on-chain forwarding remains valid —
 * this only removes our label.
 */
router.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(virtualAddresses)
    .where(and(eq(virtualAddresses.id, id), eq(virtualAddresses.owner, owner)))
    .limit(1);
  if (existing.length === 0) throw new NotFoundError('Virtual address not found');

  await db.delete(virtualAddresses).where(eq(virtualAddresses.id, id));
  return noContent(c);
});

export default router;
