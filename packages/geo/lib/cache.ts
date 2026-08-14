export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  readonly size: number;
}

/** Insertion-ordered Map doubles as the LRU list: re-inserting moves to newest. */
export function createTtlCache<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T; expiresAt: number }>();

  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },

    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + options.ttlMs });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },

    get size() {
      return entries.size;
    },
  };
}

export interface RateLimiter {
  take(key: string): boolean;
}

/**
 * Sliding window, per key. Geosuggest fires on every keystroke, so without
 * this a single user holding down a key can burn the daily Yandex quota.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): RateLimiter {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  function prune(cutoff: number) {
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((at) => at > cutoff);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  }

  return {
    take(key) {
      const current = now();
      const cutoff = current - options.windowMs;
      if (hits.size > maxKeys) prune(cutoff);

      const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(current);
      hits.set(key, recent);
      return true;
    },
  };
}
