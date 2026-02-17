import { TEMPO_NETWORK } from './constants';
export { TEMPO_NETWORK };

const API_URL = import.meta.env.VITE_PLAYGROUND_API_URL || 'http://localhost:4010';

export const AUTH_API_URL = `${API_URL}/auth`;

export function getApiUrl(): string {
  return API_URL;
}
