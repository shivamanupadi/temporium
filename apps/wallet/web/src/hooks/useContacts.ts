import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import type { Address, Hex } from 'viem';
import {
  getContacts as fetchContacts,
  addContact as createContact,
  updateContact as patchContact,
  deleteContact as removeContactApi,
  findContactByAddress as findByAddress,
  searchContacts as searchInList,
  type Contact,
} from '@/lib/contacts';
import { getAccessToken } from '@/lib/auth-storage';
import { signInWithEthereum } from '@/lib/siwe-auth';

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
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const authInProgress = useRef(false);

  const ensureAccessToken = useCallback(async (): Promise<string> => {
    const existing = getAccessToken();
    if (existing) return existing;

    if (!address) throw new Error('Wallet not connected');

    // Prevent concurrent SIWE flows
    if (authInProgress.current) {
      // Wait for the in-progress auth to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      const token = getAccessToken();
      if (token) return token;
      throw new Error('Authentication in progress');
    }

    authInProgress.current = true;
    try {
      const signFn = async (message: string): Promise<Hex> => {
        return signMessageAsync({ message });
      };
      const result = await signInWithEthereum(address, signFn);
      return result.accessToken;
    } finally {
      authInProgress.current = false;
    }
  }, [address, signMessageAsync]);

  const loadContacts = useCallback(async () => {
    if (!address) {
      setContacts([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const token = await ensureAccessToken();
      const result = await fetchContacts(token);
      setContacts(result.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, ensureAccessToken]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addContact = useCallback(
    async (name: string, addr: Address): Promise<Contact> => {
      const token = await ensureAccessToken();
      const contact = await createContact(token, name, addr);
      setContacts(prev => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      return contact;
    },
    [ensureAccessToken]
  );

  const editContact = useCallback(
    async (id: string, updates: { name?: string; address?: Address }): Promise<Contact | null> => {
      const token = await ensureAccessToken();
      const updated = await patchContact(token, id, updates);
      setContacts(prev =>
        prev.map(c => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
      return updated;
    },
    [ensureAccessToken]
  );

  const removeContact = useCallback(
    async (id: string): Promise<void> => {
      const token = await ensureAccessToken();
      await removeContactApi(token, id);
      setContacts(prev => prev.filter(c => c.id !== id));
    },
    [ensureAccessToken]
  );

  const findContactByAddress = useCallback(
    (addr: Address): Contact | null => {
      return findByAddress(contacts, addr);
    },
    [contacts]
  );

  const search = useCallback(
    (query: string): Contact[] => {
      return searchInList(contacts, query);
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
