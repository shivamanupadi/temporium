/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Worker URL for passkey public key storage */
  readonly VITE_KEYS_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
