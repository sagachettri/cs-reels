// Tiny in-memory cache so the same explanation is not generated twice.
const store = new Map();
const MAX_ENTRIES = 500;
const TTL_MS = 24 * 60 * 60 * 1000;

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value) {
  if (store.size >= MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
  store.set(key, { value, expires: Date.now() + TTL_MS });
}

export function cacheClear() {
  store.clear();
}
