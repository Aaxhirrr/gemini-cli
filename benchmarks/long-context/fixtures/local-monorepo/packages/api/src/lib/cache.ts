export interface CacheOptions {
  ttlMs: number;
  clock?: () => number;
}

interface CacheRecord<Value> {
  value: Value;
  expiresAt: number;
}

export class MemoryCache<Key, Value> {
  private readonly ttlMs: number;
  private readonly clock: () => number;
  private readonly store = new Map<Key, CacheRecord<Value>>();

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.clock = options.clock ?? (() => Date.now());
  }

  get(key: Key): Value | undefined {
    const record = this.store.get(key);

    if (!record) {
      return undefined;
    }

    if (record.expiresAt <= this.clock()) {
      this.store.delete(key);
      return undefined;
    }

    return record.value;
  }

  set(key: Key, value: Value): void {
    this.store.set(key, {
      value,
      expiresAt: this.clock() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}
