import type { Address } from 'viem';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { hasAuthTokens } from './auth-storage';
import { db, type Contact } from './db';

export type { Contact };

/**
 * API response types
 */
interface ContactApiResponse {
  id: string;
  owner: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert API response to Contact type
 */
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

/**
 * Check if API is available (user is authenticated)
 */
function useApi(): boolean {
  return hasAuthTokens();
}

export async function saveContact(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const normalizedAddress = contact.address.toLowerCase() as Address;
  const normalizedOwner = contact.owner.toLowerCase() as Address;

  // Use API if authenticated
  if (useApi()) {
    const response = await apiPost<ContactApiResponse>('/api/contacts', {
      name: contact.name,
      address: normalizedAddress,
    });
    return apiToContact(response);
  }

  // Fallback to IndexedDB
  const existing = await getContactByAddress(normalizedOwner, normalizedAddress);
  if (existing) {
    throw new Error('A contact with this address already exists');
  }

  const now = Date.now();
  const newContact: Contact = {
    ...contact,
    id: crypto.randomUUID(),
    owner: normalizedOwner,
    address: normalizedAddress,
    createdAt: now,
    updatedAt: now,
  };

  await db.contacts.add(newContact);
  return newContact;
}

export async function updateContact(
  id: string,
  owner: Address,
  updates: Partial<Pick<Contact, 'name' | 'address'>>
): Promise<Contact | null> {
  // Use API if authenticated
  if (useApi()) {
    const response = await apiPatch<ContactApiResponse>(`/api/contacts/${id}`, {
      name: updates.name,
    });
    return apiToContact(response);
  }

  // Fallback to IndexedDB
  const existing = await getContactById(id);
  if (!existing) return null;

  if (existing.owner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to update this contact');
  }

  const newAddress = updates.address
    ? (updates.address.toLowerCase() as Address)
    : existing.address;

  if (updates.address && newAddress !== existing.address) {
    const duplicate = await getContactByAddress(owner, newAddress);
    if (duplicate && duplicate.id !== id) {
      throw new Error('A contact with this address already exists');
    }
  }

  const updatedContact: Contact = {
    ...existing,
    ...updates,
    address: newAddress,
    updatedAt: Date.now(),
  };

  await db.contacts.put(updatedContact);
  return updatedContact;
}

export async function deleteContact(id: string, owner: Address): Promise<void> {
  // Use API if authenticated
  if (useApi()) {
    await apiDelete(`/api/contacts/${id}`);
    return;
  }

  // Fallback to IndexedDB
  const existing = await getContactById(id);
  if (existing && existing.owner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this contact');
  }
  await db.contacts.delete(id);
}

export async function getContactById(id: string): Promise<Contact | null> {
  // Use API if authenticated
  if (useApi()) {
    try {
      const response = await apiGet<ContactApiResponse>(`/api/contacts/${id}`);
      return apiToContact(response);
    } catch {
      return null;
    }
  }

  // Fallback to IndexedDB
  const contact = await db.contacts.get(id);
  return contact ?? null;
}

export async function getContactByAddress(
  owner: Address,
  address: Address
): Promise<Contact | null> {
  const normalizedOwner = owner.toLowerCase();
  const normalizedAddress = address.toLowerCase();

  // Use API if authenticated - fetch all and filter
  if (useApi()) {
    const contacts = await getContactsByOwner(owner);
    return contacts.find(c => c.address.toLowerCase() === normalizedAddress) ?? null;
  }

  // Fallback to IndexedDB
  const contact = await db.contacts
    .where('[owner+address]')
    .equals([normalizedOwner, normalizedAddress])
    .first();

  return contact ?? null;
}

export async function getContactsByOwner(owner: Address): Promise<Contact[]> {
  // Use API if authenticated
  if (useApi()) {
    const response = await apiGet<ContactApiResponse[]>('/api/contacts');
    return response.map(apiToContact).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fallback to IndexedDB
  const normalizedOwner = owner.toLowerCase();
  const contacts = await db.contacts.where('owner').equals(normalizedOwner).toArray();
  return contacts.sort((a, b) => a.name.localeCompare(b.name));
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
