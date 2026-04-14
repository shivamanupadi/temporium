/**
 * Wallet web API client for payment links.
 *
 * Authenticated endpoints go through `apiRequest` (adds Bearer + network).
 * Public endpoints (viewing a share link, paying) go through
 * `publicApiRequest` - same error parsing but no Authorization header.
 *
 * The `pay` endpoint is special: it must be hit via an mppx-wrapped fetch so
 * 402 challenges are handled automatically by the client SDK. That path is
 * exposed here as `payPublicPaymentLink()` which takes a scoped fetch.
 */
import { apiGet, apiPost, apiDelete, publicApiRequest } from './api-client';
import { getWalletApiUrl, TEMPO_NETWORK } from './api';

// =============================================================================
// Types
// =============================================================================

export type PaymentLinkStatus = 'active' | 'completed' | 'cancelled' | 'expired';

export interface PaymentLink {
  id: string;
  owner: string;
  recipient: string;
  network: 'testnet' | 'mainnet';
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string; // raw base-unit string
  amountDecimal: string; // human decimal
  title: string | null;
  description: string | null;
  reusable: boolean;
  status: PaymentLinkStatus;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaymentLinkListItem extends PaymentLink {
  paymentCount: number;
}

export interface PaymentLinkPayment {
  id: string;
  linkId: string;
  payer: string;
  txHash: string;
  amount: string;
  feeAmount: string;
  feeBps: number;
  netAmount: string;
  paidAt: string;
}

export interface PublicPaymentLink {
  id: string;
  network: 'testnet' | 'mainnet';
  recipient: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  amountDecimal: string;
  title: string | null;
  description: string | null;
  reusable: boolean;
  status: PaymentLinkStatus;
  expiresAt: string | null;
  createdAt: string;
  fulfilled: boolean;
  paymentCount: number;
  lastPayment: {
    payer: string;
    txHash: string;
    paidAt: string;
  } | null;
  feeBps: number;
}

export interface PaymentLinkDetail extends PaymentLink {
  payments: PaymentLinkPayment[];
}

export interface CreatePaymentLinkBody {
  token: string;
  amount: string; // decimal string
  recipient: string; // wallet address that receives payments
  title: string; // required on the backend
  description?: string;
  reusable?: boolean;
  expiresAt?: string; // ISO
}

export interface PaymentLinkListResponse {
  items: PaymentLinkListItem[];
  nextCursor: string | null;
}

export interface PaymentLinksConfig {
  feeBps: number;
  network: 'testnet' | 'mainnet';
}

// =============================================================================
// Authenticated calls
// =============================================================================

export function listPaymentLinks(params?: {
  status?: PaymentLinkStatus;
  cursor?: string;
  limit?: number;
}): Promise<PaymentLinkListResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return apiGet<PaymentLinkListResponse>(`/v1/payment-links${qs ? `?${qs}` : ''}`);
}

export function createPaymentLink(body: CreatePaymentLinkBody): Promise<PaymentLink> {
  return apiPost<PaymentLink>('/v1/payment-links', body);
}

export function getPaymentLink(id: string): Promise<PaymentLinkDetail> {
  return apiGet<PaymentLinkDetail>(`/v1/payment-links/${id}`);
}

export function cancelPaymentLink(id: string): Promise<void> {
  return apiDelete<void>(`/v1/payment-links/${id}`);
}

// =============================================================================
// Public calls
// =============================================================================

export function getPaymentLinksConfig(): Promise<PaymentLinksConfig> {
  return publicApiRequest<PaymentLinksConfig>('/v1/payment-links/config');
}

export function getPublicPaymentLink(id: string): Promise<PublicPaymentLink> {
  return publicApiRequest<PublicPaymentLink>(`/v1/payment-links/public/${id}`);
}

/**
 * Hit the mppx-gated pay endpoint. `mppxFetch` is the scoped fetch returned
 * from `createMppxFetch()` in `src/lib/mpp.ts` - it intercepts the 402
 * response, signs via the wagmi walletClient, and retries automatically.
 *
 * On success the server responds 200 with the usual `{success, data}`
 * envelope; we parse it here so the caller just awaits a typed payment.
 */
export async function payPublicPaymentLink(
  id: string,
  mppxFetch: typeof fetch
): Promise<{
  link: { id: string; status: PaymentLinkStatus; reusable: boolean };
  payment: PaymentLinkPayment;
}> {
  const url = `${getWalletApiUrl()}/v1/payment-links/public/${id}/pay`;
  const res = await mppxFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tempo-Network': TEMPO_NETWORK,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const parsed = (await res.json()) as {
    success: boolean;
    data?: {
      link: { id: string; status: PaymentLinkStatus; reusable: boolean };
      payment: PaymentLinkPayment;
    };
    error?: string;
  };
  if (!parsed.success || !parsed.data) {
    throw new Error(parsed.error || 'Payment failed');
  }
  return parsed.data;
}
