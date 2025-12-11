import { useState, useEffect, useCallback } from 'react'
import {
  getAllContacts,
  saveContact,
  updateContact,
  deleteContact,
  getContactByAddress,
  searchContacts,
  type Contact,
} from '@/lib/contacts-storage'
import type { Address } from 'viem'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadContacts = useCallback(async () => {
    try {
      const allContacts = await getAllContacts()
      setContacts(allContacts)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const addContact = useCallback(async (name: string, address: Address) => {
    const contact = await saveContact({ name, address })
    setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)))
    return contact
  }, [])

  const editContact = useCallback(async (id: string, updates: { name?: string; address?: Address }) => {
    const updated = await updateContact(id, updates)
    if (updated) {
      setContacts((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    return updated
  }, [])

  const removeContact = useCallback(async (id: string) => {
    await deleteContact(id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const findContactByAddress = useCallback(async (address: Address) => {
    return getContactByAddress(address)
  }, [])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return contacts
    return searchContacts(query)
  }, [contacts])

  return {
    contacts,
    isLoading,
    addContact,
    editContact,
    removeContact,
    findContactByAddress,
    search,
    refresh: loadContacts,
  }
}

export type { Contact }
