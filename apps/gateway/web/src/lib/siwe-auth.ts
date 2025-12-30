/**
 * SIWE (Sign-In with Ethereum) Authentication
 * Handles authentication flow for external wallets (MetaMask, etc.)
 */

import type { WalletClient } from 'viem';
import { AUTH_API_URL } from './api';
import { saveAuthToken, type AuthToken } from './auth-storage';

interface ChallengeData {
  message: string;
  nonce: string;
  expiresAt: number;
}

interface ChallengeResponse {
  success: boolean;
  data: ChallengeData;
}

interface VerifyData {
  accessToken: string;
  expiresIn: number;
}

interface VerifyResponse {
  success: boolean;
  data: VerifyData;
}

/**
 * Sign in with Ethereum (SIWE) authentication flow
 *
 * 1. Request challenge from backend
 * 2. Sign message with wallet
 * 3. Verify signature and get JWT
 * 4. Store JWT for subsequent API requests
 */
export async function signInWithEthereum(walletClient: WalletClient): Promise<AuthToken> {
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet client has no account');
  }

  const address = account.address;

  // 1. Get challenge from backend
  const challengeResponse = await fetch(`${AUTH_API_URL}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  if (!challengeResponse.ok) {
    const error = await challengeResponse.text();
    throw new Error(`Failed to get challenge: ${error}`);
  }

  const challengeResult = (await challengeResponse.json()) as ChallengeResponse;
  const { message } = challengeResult.data;

  // 2. Sign message with wallet
  const signature = await walletClient.signMessage({
    account,
    message,
  });

  // 3. Verify signature and get JWT
  const verifyResponse = await fetch(`${AUTH_API_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature, address }),
  });

  if (!verifyResponse.ok) {
    const error = await verifyResponse.text();
    throw new Error(`Failed to verify signature: ${error}`);
  }

  const verifyResult = (await verifyResponse.json()) as VerifyResponse;
  const { accessToken, expiresIn } = verifyResult.data;

  // 4. Store JWT
  saveAuthToken({ accessToken, expiresIn });

  return {
    accessToken,
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}
