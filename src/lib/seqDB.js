// Simple IndexedDB helper for storing sequence game objects.
const DB_NAME = 'gorecall-sequences'
const DB_VERSION = 1
const STORE_NAME = 'sequences'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('fileName', 'fileName', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function saveSequence(key, seqObj) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const payload = {
      key,
      game: seqObj,
      fileName: seqObj?.info?.fileName || null,
      createdAt: seqObj?.info?.createdAt || Date.now()
    }
    const req = store.put(payload)
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

export async function getSequence(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      const res = req.result
      resolve(res ? res.game : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteSequencesByFileName(fileName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('fileName')
    const req = index.openCursor(IDBKeyRange.only(fileName))
    req.onsuccess = (ev) => {
      const cursor = ev.target.result
      if (!cursor) return resolve(true)
      cursor.delete()
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function listAllSequenceKeys() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export default {
  openDB,
  saveSequence,
  getSequence,
  deleteSequencesByFileName,
  listAllSequenceKeys
}
