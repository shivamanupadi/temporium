import type { Address } from 'viem';
import { db, type Contact } from './db';

export type { Contact };

export async function saveContact(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const normalizedAddress = contact.address.toLowerCase() as Address;

  // Check for duplicate address
  const existing = await getContactByAddress(normalizedAddress);
  if (existing) {
    throw new Error('A contact with this address already exists');
  }

  const now = Date.now();
  const newContact: Contact = {
    ...contact,
    id: crypto.randomUUID(),
    address: normalizedAddress,
    createdAt: now,
    updatedAt: now,
  };

  await db.contacts.add(newContact);
  return newContact;
}

export async function updateContact(
  id: string,
  updates: Partial<Pick<Contact, 'name' | 'address'>>
): Promise<Contact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;

  const newAddress = updates.address
    ? (updates.address.toLowerCase() as Address)
    : existing.address;

  // Check for duplicate address (excluding current contact)
  if (updates.address && newAddress !== existing.address) {
    const duplicate = await getContactByAddress(newAddress);
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

export async function deleteContact(id: string): Promise<void> {
  await db.contacts.delete(id);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const contact = await db.contacts.get(id);
  return contact ?? null;
}

export async function getContactByAddress(address: Address): Promise<Contact | null> {
  const normalizedAddress = address.toLowerCase();
  const contact = await db.contacts.where('address').equals(normalizedAddress).first();

  return contact ?? null;
}

export async function getAllContacts(): Promise<Contact[]> {
  const contacts = await db.contacts.toArray();
  // Sort by name alphabetically
  return contacts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const contacts = await getAllContacts();
  const lowerQuery = query.toLowerCase();

  return contacts.filter(
    contact =>
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.address.toLowerCase().includes(lowerQuery)
  );
}
