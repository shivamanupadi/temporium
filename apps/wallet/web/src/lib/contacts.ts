import type { Address } from 'viem';

const STORAGE_KEY = 'temporium_wallet_contacts';

export interface Contact {
  id: string;
  name: string;
  address: Address;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get all contacts from localStorage
 */
export function getContacts(): Contact[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Contact[];
  } catch {
    return [];
  }
}

/**
 * Save contacts to localStorage
 */
function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

/**
 * Add a new contact
 */
export function addContact(name: string, address: Address): Contact {
  const contacts = getContacts();

  // Check for duplicate address
  const existingAddress = contacts.find(
    c => c.address.toLowerCase() === address.toLowerCase()
  );
  if (existingAddress) {
    throw new Error('Contact with this address already exists');
  }

  // Check for duplicate name
  const existingName = contacts.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (existingName) {
    throw new Error('Contact with this name already exists');
  }

  const contact: Contact = {
    id: crypto.randomUUID(),
    name: name.trim(),
    address: address.toLowerCase() as Address,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  contacts.push(contact);
  saveContacts(contacts);

  return contact;
}

/**
 * Update an existing contact
 */
export function updateContact(
  id: string,
  updates: { name?: string; address?: Address }
): Contact | null {
  const contacts = getContacts();
  const index = contacts.findIndex(c => c.id === id);

  if (index === -1) return null;

  const contact = contacts[index];

  // Check for duplicate address (excluding current contact)
  if (updates.address) {
    const existingAddress = contacts.find(
      c => c.id !== id && c.address.toLowerCase() === updates.address!.toLowerCase()
    );
    if (existingAddress) {
      throw new Error('Contact with this address already exists');
    }
  }

  // Check for duplicate name (excluding current contact)
  if (updates.name) {
    const existingName = contacts.find(
      c => c.id !== id && c.name.toLowerCase() === updates.name!.toLowerCase()
    );
    if (existingName) {
      throw new Error('Contact with this name already exists');
    }
  }

  const updated: Contact = {
    ...contact,
    ...(updates.name && { name: updates.name.trim() }),
    ...(updates.address && { address: updates.address.toLowerCase() as Address }),
    updatedAt: Date.now(),
  };

  contacts[index] = updated;
  saveContacts(contacts);

  return updated;
}

/**
 * Delete a contact
 */
export function deleteContact(id: string): boolean {
  const contacts = getContacts();
  const filtered = contacts.filter(c => c.id !== id);

  if (filtered.length === contacts.length) return false;

  saveContacts(filtered);
  return true;
}

/**
 * Find a contact by address
 */
export function findContactByAddress(address: Address): Contact | null {
  const contacts = getContacts();
  return contacts.find(c => c.address.toLowerCase() === address.toLowerCase()) || null;
}

/**
 * Search contacts by name or address
 */
export function searchContacts(query: string): Contact[] {
  const contacts = getContacts();
  const lowerQuery = query.toLowerCase();

  return contacts.filter(
    c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.address.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Clear all contacts
 */
export function clearContacts(): void {
  localStorage.removeItem(STORAGE_KEY);
}
