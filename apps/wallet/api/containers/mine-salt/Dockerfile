# TIP-1022 salt-mining container.
#
# Runs ox/tempo's WASM-accelerated keccak miner with a Node worker pool.
# The wallet API spawns this container on demand to compute a valid
# `registerVirtualMaster(salt)` PoW for a given address (≈10s on standard-4
# vs. 30-60s in a browser). The container stays warm for `sleepAfter`
# so back-to-back registrations skip the cold start.

FROM node:22-alpine AS base
WORKDIR /app

# Install deps first so they cache across server.js edits.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

# Cloudflare Containers proxy fetch() to whatever port the process listens on.
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.mjs"]
