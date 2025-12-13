import type { Address } from 'viem';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';

export interface Contact {
  id: string;
  owner: Address;
  name: string;
  address: Address;
  createdAt: number;
  updatedAt: number;
}

interface ContactApiResponse {
  id: string;
  owner: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

function apiToContact(data: ContactApiResponse): Contact {
  return {
    id: data.id,
    owner: data.owner as Address,
    name: data.name,
    address: data.address as Address,
    createdAt: new Date(data.createdAt).getTime(),
    updatedAt: new Date(data.updatedAt).getTime(),
  };
}

export async function saveContact(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const normalizedAddress = contact.address.toLowerCase() as Address;

  const response = await apiPost<ContactApiResponse>('/api/contacts', {
    name: contact.name,
    address: normalizedAddress,
  });
  return apiToContact(response);
}

export async function updateContact(
  id: string,
  _owner: Address,
  updates: Partial<Pick<Contact, 'name' | 'address'>>
): Promise<Contact | null> {
  const response = await apiPatch<ContactApiResponse>(`/api/contacts/${id}`, {
    name: updates.name,
  });
  return apiToContact(response);
}

export async function deleteContact(id: string, _owner: Address): Promise<void> {
  await apiDelete(`/api/contacts/${id}`);
}

export async function getContactById(id: string): Promise<Contact | null> {
  try {
    const response = await apiGet<ContactApiResponse>(`/api/contacts/${id}`);
    return apiToContact(response);
  } catch {
    return null;
  }
}

export async function getContactByAddress(
  owner: Address,
  address: Address
): Promise<Contact | null> {
  const normalizedAddress = address.toLowerCase();
  const contacts = await getContactsByOwner(owner);
  return contacts.find(c => c.address.toLowerCase() === normalizedAddress) ?? null;
}

export async function getContactsByOwner(_owner: Address): Promise<Contact[]> {
  const response = await apiGet<ContactApiResponse[]>('/api/contacts');
  return response.map(apiToContact).sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchContacts(owner: Address, query: string): Promise<Contact[]> {
  const contacts = await getContactsByOwner(owner);
  const lowerQuery = query.toLowerCase();

  return contacts.filter(
    contact =>
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.address.toLowerCase().includes(lowerQuery)
  );
}
