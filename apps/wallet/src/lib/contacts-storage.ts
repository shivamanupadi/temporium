import type { Address } from 'viem'

const DB_NAME = 'tollr-contacts'
const DB_VERSION = 1
const STORE_NAME = 'contacts'

export interface Contact {
  id: string
  name: string
  address: Address
  createdAt: number
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('address', 'address', { unique: false })
        store.createIndex('name', 'name', { unique: false })
      }
    }
  })

  return dbPromise
}

export async function saveContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
  const normalizedAddress = contact.address.toLowerCase() as Address

  // Check for duplicate address
  const existing = await getContactByAddress(normalizedAddress)
  if (existing) {
    throw new Error('A contact with this address already exists')
  }

  const db = await getDB()
  const now = Date.now()
  const newContact: Contact = {
    ...contact,
    id: crypto.randomUUID(),
    address: normalizedAddress,
    createdAt: now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(newContact)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(newContact)
  })
}

export async function updateContact(id: string, updates: Partial<Pick<Contact, 'name' | 'address'>>): Promise<Contact | null> {
  const existing = await getContactById(id)
  if (!existing) return null

  const newAddress = updates.address ? updates.address.toLowerCase() as Address : existing.address

  // Check for duplicate address (excluding current contact)
  if (updates.address && newAddress !== existing.address) {
    const duplicate = await getContactByAddress(newAddress)
    if (duplicate && duplicate.id !== id) {
      throw new Error('A contact with this address already exists')
    }
  }

  const db = await getDB()
  const updatedContact: Contact = {
    ...existing,
    ...updates,
    address: newAddress,
    updatedAt: Date.now(),
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(updatedContact)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(updatedContact)
  })
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getContactById(id: string): Promise<Contact | null> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function getContactByAddress(address: Address): Promise<Contact | null> {
  const db = await getDB()
  const normalizedAddress = address.toLowerCase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('address')
    const request = index.get(normalizedAddress)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const contacts = request.result || []
      // Sort by name alphabetically
      contacts.sort((a, b) => a.name.localeCompare(b.name))
      resolve(contacts)
    }
  })
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const contacts = await getAllContacts()
  const lowerQuery = query.toLowerCase()

  return contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.address.toLowerCase().includes(lowerQuery)
  )
}
