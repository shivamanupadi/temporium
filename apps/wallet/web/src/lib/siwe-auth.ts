import type { WalletClient } from 'viem';
import { AUTH_API_URL, TEMPO_NETWORK } from './api';
import { saveAuthToken, type AuthToken } from './auth-storage';

interface ChallengeResponse {
  success: boolean;
  data: { message: string; nonce: string; expiresAt: number };
}

interface VerifyResponse {
  success: boolean;
  data: { accessToken: string; expiresIn: number };
}

export async function signInWithEthereum(walletClient: WalletClient): Promise<AuthToken> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client has no account');

  const address = account.address;

  const challengeResponse = await fetch(`${AUTH_API_URL}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tempo-Network': TEMPO_NETWORK },
    body: JSON.stringify({ address }),
  });

  if (!challengeResponse.ok) {
    const error = await challengeResponse.text();
    throw new Error(`Failed to get challenge: ${error}`);
  }

  const challengeResult = (await challengeResponse.json()) as ChallengeResponse;
  const { message } = challengeResult.data;

  const signature = await walletClient.signMessage({ account, message });

  const verifyResponse = await fetch(`${AUTH_API_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tempo-Network': TEMPO_NETWORK },
    body: JSON.stringify({ message, signature, address }),
  });

  if (!verifyResponse.ok) {
    const error = await verifyResponse.text();
    throw new Error(`Failed to verify signature: ${error}`);
  }

  const verifyResult = (await verifyResponse.json()) as VerifyResponse;
  const { accessToken, expiresIn } = verifyResult.data;

  saveAuthToken({ accessToken, expiresIn });

  return {
    accessToken,
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}
