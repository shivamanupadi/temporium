/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_API_URL: string;
  readonly VITE_TEMPO_NETWORK: 'testnet' | 'mainnet';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
