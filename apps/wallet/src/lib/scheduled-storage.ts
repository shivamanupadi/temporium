import type { Address } from 'viem'

/**
 * Scheduled Transaction stored in IndexedDB
 */
export interface ScheduledTransaction {
  id: string
  txHash: string
  from: Address
  to: Address
  amount: string
  token: Address
  tokenSymbol: string
  tokenDecimals: number
  feeToken: Address
  memo?: string
  scheduledFor: number // Unix timestamp (seconds)
  createdAt: number // Unix timestamp (seconds)
  status: 'pending' | 'executed' | 'failed'
  executedAt?: number // Unix timestamp when executed
}

const DB_NAME = 'tollr-scheduled-txns'
const DB_VERSION = 1
const STORE_NAME = 'scheduled'

let dbInstance: IDBDatabase | null = null

/**
 * Initialize IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object store with id as key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        // Index by from address for filtering
        store.createIndex('from', 'from', { unique: false })
        // Index by status for filtering
        store.createIndex('status', 'status', { unique: false })
        // Compound index for from + status
        store.createIndex('from_status', ['from', 'status'], { unique: false })
      }
    }
  })
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save a new scheduled transaction
 */
export async function saveScheduledTransaction(
  tx: Omit<ScheduledTransaction, 'id' | 'createdAt' | 'status'>
): Promise<ScheduledTransaction> {
  const db = await openDB()

  const scheduledTx: ScheduledTransaction = {
    ...tx,
    // Normalize addresses to lowercase for consistent querying
    from: tx.from.toLowerCase() as Address,
    to: tx.to.toLowerCase() as Address,
    id: generateId(),
    createdAt: Math.floor(Date.now() / 1000),
    status: 'pending',
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(scheduledTx)

    request.onerror = () => {
      reject(new Error('Failed to save scheduled transaction'))
    }

    request.onsuccess = () => {
      resolve(scheduledTx)
    }
  })
}

/**
 * Get all scheduled transactions for a specific address
 */
export async function getScheduledTransactions(
  fromAddress: Address
): Promise<ScheduledTransaction[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('from')
    const request = index.getAll(fromAddress.toLowerCase())

    request.onerror = () => {
      reject(new Error('Failed to get scheduled transactions'))
    }

    request.onsuccess = () => {
      // Sort by scheduledFor descending (newest first)
      const results = (request.result as ScheduledTransaction[]).sort(
        (a, b) => b.scheduledFor - a.scheduledFor
      )
      resolve(results)
    }
  })
}

/**
 * Get a single scheduled transaction by ID
 */
export async function getScheduledTransaction(
  id: string
): Promise<ScheduledTransaction | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => {
      reject(new Error('Failed to get scheduled transaction'))
    }

    request.onsuccess = () => {
      resolve(request.result || null)
    }
  })
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  id: string,
  status: 'pending' | 'executed' | 'failed',
  executedAt?: number
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onerror = () => {
      reject(new Error('Failed to get transaction for update'))
    }

    getRequest.onsuccess = () => {
      const tx = getRequest.result as ScheduledTransaction | undefined
      if (!tx) {
        reject(new Error('Transaction not found'))
        return
      }

      tx.status = status
      if (executedAt !== undefined) {
        tx.executedAt = executedAt
      }

      const putRequest = store.put(tx)

      putRequest.onerror = () => {
        reject(new Error('Failed to update transaction status'))
      }

      putRequest.onsuccess = () => {
        resolve()
      }
    }
  })
}

/**
 * Delete a scheduled transaction
 */
export async function deleteScheduledTransaction(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => {
      reject(new Error('Failed to delete scheduled transaction'))
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

/**
 * Get pending transactions that should have executed (past scheduledFor time)
 */
export async function getPendingTransactionsPastSchedule(
  fromAddress: Address
): Promise<ScheduledTransaction[]> {
  const transactions = await getScheduledTransactions(fromAddress)
  const now = Math.floor(Date.now() / 1000)

  return transactions.filter(
    (tx) => tx.status === 'pending' && tx.scheduledFor <= now
  )
}

/**
 * Clear all scheduled transactions (for testing/debugging)
 */
export async function clearAllScheduledTransactions(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => {
      reject(new Error('Failed to clear scheduled transactions'))
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}
