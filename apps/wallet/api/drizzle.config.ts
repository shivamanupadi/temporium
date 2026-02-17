import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4158b66db26db07bc157feda61f1d3542345752d8baeb2cbe0e2f8808e34815d.sqlite',
  },
});
