// The family key on the device (spec, "Guided song setup", step 2). IndexedDB keeps the non-extractable CryptoKeys
// of the key, because a CryptoKey is structured-cloneable. No raw copy of the key is stored.

import type { FamilyKey } from '../../model';

const DATABASE = 'beat-pals';
const KEYS = 'keys';
const FAMILY = 'family';

/** The result of an IndexedDB request. */
const settled = async <T>(request: IDBRequest<T>): Promise<T> => {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.addEventListener('success', () => resolve(request.result));
  request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB failed.')));
  return promise;
};

const openDatabase = async (): Promise<IDBDatabase> => {
  const request = indexedDB.open(DATABASE, 1);
  request.addEventListener('upgradeneeded', () => request.result.createObjectStore(KEYS));
  return settled(request);
};

/** Runs one request in a transaction of the key store and waits until the transaction is complete. */
const withKeys = async <T>(mode: IDBTransactionMode, call: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(KEYS, mode);
    const complete = Promise.withResolvers<void>();
    transaction.addEventListener('complete', () => complete.resolve());
    transaction.addEventListener('error', () => complete.reject(transaction.error ?? new Error('IndexedDB failed.')));
    transaction.addEventListener('abort', () => complete.reject(transaction.error ?? new Error('IndexedDB aborted.')));
    const result = await settled(call(transaction.objectStore(KEYS)));
    await complete.promise;
    return result;
  } finally {
    database.close();
  }
};

const isFamilyKey = (value: unknown): value is FamilyKey => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  return (
    typeof fields.get('id') === 'string' &&
    fields.get('cipher') instanceof CryptoKey &&
    fields.get('naming') instanceof CryptoKey
  );
};

/** Keeps the family key on the device, in place of the old one. */
export const saveFamilyKey = async (key: FamilyKey): Promise<void> => {
  await withKeys('readwrite', (store) => store.put(key, FAMILY));
};

/** The stored family key, or undefined when no key is stored. */
export const loadFamilyKey = async (): Promise<FamilyKey | undefined> => {
  const value: unknown = await withKeys('readonly', (store) => store.get(FAMILY));
  return isFamilyKey(value) ? value : undefined;
};
