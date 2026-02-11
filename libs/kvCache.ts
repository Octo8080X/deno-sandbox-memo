/// <reference lib="deno.unstable" />
const CACHE_KEY = `kvCache` as const;

const store = Deno.env.get("APP_ENV") == "dev" ?  await Deno.openKv(":memory:") : await Deno.openKv();

export function getCacheKey(key: string): string[] {
  return [CACHE_KEY, key];
}
export async function setCache<T>(
  id: string,
  content: T | string | string[],
  expireIn: number = 120,
): Promise<void> {
  const key = getCacheKey(id);
  await store.set(key, content, { expireIn });
}

export async function getCache<T>(id: string): Promise<T | null> {
  const key = getCacheKey(id);
  const val = await store.get<T>(key);

  return val.value ?? null;
}

export async function deleteCache(id: string): Promise<void> {
  const key = getCacheKey(id);
  await store.delete(key);
}

export async function fetchCache<T>(
  key: string,
  expireIn: number = 120,
  func: () => Promise<T | null>,
): Promise<T | null> {
  const res = await getCache<T>(key);

  if (!res) {
    const newRes = await func();
    if (newRes == null) {
      return null;
    }
    await setCache(key, newRes, expireIn);
    return newRes;
  }
  return res;
}

const LOCK_KEY = "kvLock" as const;

export function getLockKey(key: string): string[] {
  return [LOCK_KEY, key];
}

type LockOptions = {
  ttlMs?: number;
  waitMs?: number;
  maxWaitMs?: number;
};

type LockValue = {
  owner: string;
  expiresAt: number;
};

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 15_000;
  const waitMs = options.waitMs ?? 200;
  const maxWaitMs = options.maxWaitMs ?? 15_000;
  const lockKey = getLockKey(key);
  const owner = crypto.randomUUID();
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const entry = await store.get<LockValue>(lockKey);
    const now = Date.now();
    const current = entry.value;

    if (current && current.expiresAt > now) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const next: LockValue = { owner, expiresAt: now + ttlMs };
    const res = await store.atomic()
      .check({ key: lockKey, versionstamp: entry.versionstamp ?? null })
      .set(lockKey, next, { expireIn: ttlMs })
      .commit();

    if (!res.ok) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    try {
      return await fn();
    } finally {
      const currentEntry = await store.get<LockValue>(lockKey);
      if (currentEntry.value?.owner === owner) {
        await store.atomic()
          .check({
            key: lockKey,
            versionstamp: currentEntry.versionstamp ?? null,
          })
          .delete(lockKey)
          .commit();
      }
    }
  }

  throw new Error(`Failed to acquire lock: ${key}`);
}
