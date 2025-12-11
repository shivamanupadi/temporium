import type { Address } from 'viem';
import { db, type Contact } from './db';

export type { Contact };

export async function saveContact(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const normalizedAddress = contact.address.toLowerCase() as Address;
  const normalizedOwner = contact.owner.toLowerCase() as Address;

  // Check for duplicate address for this owner
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
  const existing = await getContactById(id);
  if (!existing) return null;

  // Verify ownership
  if (existing.owner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to update this contact');
  }

  const newAddress = updates.address
    ? (updates.address.toLowerCase() as Address)
    : existing.address;

  // Check for duplicate address (excluding current contact)
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
  const existing = await getContactById(id);
  if (existing && existing.owner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error('Not authorized to delete this contact');
  }
  await db.contacts.delete(id);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const contact = await db.contacts.get(id);
  return contact ?? null;
}

export async function getContactByAddress(
  owner: Address,
  address: Address
): Promise<Contact | null> {
  const normalizedOwner = owner.toLowerCase();
  const normalizedAddress = address.toLowerCase();
  const contact = await db.contacts
    .where('[owner+address]')
    .equals([normalizedOwner, normalizedAddress])
    .first();

  return contact ?? null;
}

export async function getContactsByOwner(owner: Address): Promise<Contact[]> {
  const normalizedOwner = owner.toLowerCase();
  const contacts = await db.contacts.where('owner').equals(normalizedOwner).toArray();
  // Sort by name alphabetically
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
