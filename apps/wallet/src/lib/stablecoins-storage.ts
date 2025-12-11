import type { Address } from 'viem'

const DB_NAME = 'tollr-stablecoins'
const DB_VERSION = 1
const STORE_NAME = 'stablecoins'

export interface Stablecoin {
  id: string
  address: Address
  name: string
  symbol: string
  currency: string
  creator: Address
  txHash: string
  createdAt: number
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
        store.createIndex('creator', 'creator', { unique: false })
        store.createIndex('address', 'address', { unique: true })
      }
    }
  })

  return dbPromise
}

export async function saveStablecoin(
  stablecoin: Omit<Stablecoin, 'id' | 'createdAt'>
): Promise<Stablecoin> {
  const db = await getDB()
  const newStablecoin: Stablecoin = {
    ...stablecoin,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(newStablecoin)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(newStablecoin)
  })
}

export async function getStablecoinsByCreator(creator: Address): Promise<Stablecoin[]> {
  const db = await getDB()
  const normalizedCreator = creator.toLowerCase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('creator')
    const request = index.getAll(normalizedCreator)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const stablecoins = request.result || []
      // Sort by createdAt descending
      stablecoins.sort((a, b) => b.createdAt - a.createdAt)
      resolve(stablecoins)
    }
  })
}

export async function getStablecoinByAddress(address: Address): Promise<Stablecoin | null> {
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

export async function deleteStablecoin(id: string): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
