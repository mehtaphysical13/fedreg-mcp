/**
 * In-memory LRU cache with per-entry TTL. v1 sufficiency: a single Vercel
 * function instance holds the cache; cold starts wipe it. Good enough at
 * v1 volumes. Phase: swap to Vercel KV when we cross ~10 RPS.
 *
 * Factory-template candidate: reusable across every tool.
 */

import { lru } from "tiny-lru";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T = unknown> {
  private store: ReturnType<typeof lru<Entry<T>>>;
  constructor(maxEntries = 500) {
    this.store = lru<Entry<T>>(maxEntries);
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async wrap<R extends T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<R>
  ): Promise<R> {
    const cached = this.get(key);
    if (cached !== undefined) return cached as R;
    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }
}
