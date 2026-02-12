import type { Address } from 'viem';
import { getGatewayApiUrl } from './api';

export interface Contact {
  id: string;
  name: string;
  address: Address;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getGatewayApiUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as ApiResponse<T>;
      if (parsed.error) message = parsed.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) throw new Error(result.error || 'Request failed');
  return result.data as T;
}

export function getContacts(accessToken: string): Promise<Contact[]> {
  return apiRequest<Contact[]>('/v1/contacts', accessToken);
}

export function addContact(
  accessToken: string,
  name: string,
  address: Address
): Promise<Contact> {
  return apiRequest<Contact>('/v1/contacts', accessToken, {
    method: 'POST',
    body: JSON.stringify({ name, address }),
  });
}

export function updateContact(
  accessToken: string,
  id: string,
  updates: { name?: string; address?: Address }
): Promise<Contact> {
  return apiRequest<Contact>(`/v1/contacts/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteContact(accessToken: string, id: string): Promise<void> {
  return apiRequest<void>(`/v1/contacts/${id}`, accessToken, {
    method: 'DELETE',
  });
}

export function findContactByAddress(contacts: Contact[], address: Address): Contact | null {
  return contacts.find(c => c.address.toLowerCase() === address.toLowerCase()) || null;
}

export function searchContacts(contacts: Contact[], query: string): Contact[] {
  if (!query.trim()) return contacts;
  const lq = query.toLowerCase();
  return contacts.filter(
    c => c.name.toLowerCase().includes(lq) || c.address.toLowerCase().includes(lq)
  );
}
