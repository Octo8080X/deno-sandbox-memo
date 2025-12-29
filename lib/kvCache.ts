//// <reference lib="deno.unstable" />
const CACHE_KEY = `kvCache` as const;

const store = await Deno.openKv();

export async function getCacheKey(key: string): Promise<string[]> {
  const parentKey = await store.get(["KV_CACHE_PARENT_KEY"]);
  if (parentKey!== null && parentKey.value != null) {
    return [parentKey.value, CACHE_KEY, key];
  }
  const parentKeyValue = crypto.randomUUID();
  await store.set(["KV_CACHE_PARENT_KEY"], parentKeyValue, { ttl: 120 });
  return [parentKeyValue, CACHE_KEY, key];
}
export async function setCache<T>(
  id: string,
  content: T | string | string[],
): Promise<void> {
  const key = await getCacheKey(id);
  await store.set(key, content, { ttl: 120 });
}

export async function getCache<T>(id: string): Promise<T | null> {
  const key = await getCacheKey(id);
  const val = await store.get<string>(key);

  return val.value ?? null;
}

export async function fetchCache<T>(
  key: string,
  func: () => Promise<T | null>,
) {
  let res = await getCache<T | string[] | string>(key);

  if (!res) {
    res = await func();
    if (res == null) {
      return null;
    }
    await setCache(key, res);
  }
  return res;
}

export async function deleteCache<T>(id: string): Promise<void> {
  const key = await getCacheKey(id);
  await store.delete(key);
}
