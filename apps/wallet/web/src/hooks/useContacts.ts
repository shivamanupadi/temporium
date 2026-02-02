import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import {
  getContacts,
  addContact as addContactToStorage,
  updateContact as updateContactInStorage,
  deleteContact as deleteContactFromStorage,
  findContactByAddress as findContactByAddressInStorage,
  searchContacts as searchContactsInStorage,
  type Contact,
} from '@/lib/contacts';

interface UseContactsReturn {
  contacts: Contact[];
  isLoading: boolean;
  addContact: (name: string, address: Address) => Promise<Contact>;
  editContact: (
    id: string,
    updates: { name?: string; address?: Address }
  ) => Promise<Contact | null>;
  removeContact: (id: string) => Promise<void>;
  findContactByAddress: (address: Address) => Contact | null;
  search: (query: string) => Contact[];
  refresh: () => void;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContacts = useCallback(() => {
    try {
      const allContacts = getContacts();
      // Sort by name alphabetically
      setContacts(allContacts.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();

    // Listen for storage changes (in case another tab modifies contacts)
    const handleStorage = (e: StorageEvent): void => {
      if (e.key === 'temporium_wallet_contacts') {
        loadContacts();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadContacts]);

  const addContact = useCallback(async (name: string, address: Address): Promise<Contact> => {
    const contact = addContactToStorage(name, address);
    setContacts(prev => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
    return contact;
  }, []);

  const editContact = useCallback(
    async (id: string, updates: { name?: string; address?: Address }): Promise<Contact | null> => {
      const updated = updateContactInStorage(id, updates);
      if (updated) {
        setContacts(prev =>
          prev.map(c => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      return updated;
    },
    []
  );

  const removeContact = useCallback(async (id: string): Promise<void> => {
    deleteContactFromStorage(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  const findContactByAddress = useCallback((address: Address): Contact | null => {
    return findContactByAddressInStorage(address);
  }, []);

  const search = useCallback(
    (query: string): Contact[] => {
      if (!query.trim()) return contacts;
      return searchContactsInStorage(query);
    },
    [contacts]
  );

  return {
    contacts,
    isLoading,
    addContact,
    editContact,
    removeContact,
    findContactByAddress,
    search,
    refresh: loadContacts,
  };
}

export type { Contact };
