import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  getContactsByOwner,
  saveContact,
  updateContact,
  deleteContact,
  getContactByAddress,
  searchContacts,
  type Contact,
} from '@/lib/contacts-storage';
import type { Address } from 'viem';

interface UseContactsReturn {
  contacts: Contact[];
  isLoading: boolean;
  addContact: (name: string, address: Address) => Promise<Contact>;
  editContact: (
    id: string,
    updates: { name?: string; address?: Address }
  ) => Promise<Contact | null>;
  removeContact: (id: string) => Promise<void>;
  findContactByAddress: (address: Address) => Promise<Contact | null>;
  search: (query: string) => Promise<Contact[]>;
  refresh: () => Promise<void>;
}

export function useContacts(): UseContactsReturn {
  const { address: ownerAddress } = useAccount();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    if (!ownerAddress) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    try {
      const allContacts = await getContactsByOwner(ownerAddress);
      setContacts(allContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ownerAddress]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addContact = useCallback(
    async (name: string, address: Address) => {
      if (!ownerAddress) throw new Error('Wallet not connected');
      const contact = await saveContact({ owner: ownerAddress, name, address });
      setContacts(prev => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      return contact;
    },
    [ownerAddress]
  );

  const editContact = useCallback(
    async (id: string, updates: { name?: string; address?: Address }) => {
      if (!ownerAddress) throw new Error('Wallet not connected');
      const updated = await updateContact(id, ownerAddress, updates);
      if (updated) {
        setContacts(prev =>
          prev.map(c => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      return updated;
    },
    [ownerAddress]
  );

  const removeContact = useCallback(
    async (id: string) => {
      if (!ownerAddress) throw new Error('Wallet not connected');
      await deleteContact(id, ownerAddress);
      setContacts(prev => prev.filter(c => c.id !== id));
    },
    [ownerAddress]
  );

  const findContactByAddress = useCallback(
    async (address: Address) => {
      if (!ownerAddress) return null;
      return getContactByAddress(ownerAddress, address);
    },
    [ownerAddress]
  );

  const search = useCallback(
    async (query: string) => {
      if (!ownerAddress) return [];
      if (!query.trim()) return contacts;
      return searchContacts(ownerAddress, query);
    },
    [ownerAddress, contacts]
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
