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
) {
  console.log("fetchCache key:", key);
  let res = await getCache<T | string[] | string>(key);
  console.log("fetchCache res:", res);

  if (!res) {
    res = await func();
    if (res == null) {
      return null;
    }
    await setCache(key, res, expireIn);
  }
  return res;
}
