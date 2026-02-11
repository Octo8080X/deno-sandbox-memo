import { getCache, setCache, withLock } from "./kvCache.ts";
import {
  SERVER_APP_ENTRYPOINT,
  SERVER_APP_SANDBOX_OPTIONS,
  startServerAppSandbox,
} from "./sandboxGit.ts";

type SandboxConnectInfo = {
  publicUrl: string;
  passPhrase: string;
};

export type SandboxRequestState = {
  server_app_public_url: string;
  server_app_pass_phrase: string;
};

async function isServerAppReachable(
  publicUrl: string,
  passPhrase: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${publicUrl}/`, {
      method: "GET",
      headers: { "X-App-Header": passPhrase },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshSandbox(): Promise<SandboxConnectInfo> {
  const passPhrase = crypto.randomUUID();
  await setCache("server_app_pass_phrase", passPhrase, 600000);

  const { publicUrl, sandboxId } = await startServerAppSandbox(
    SERVER_APP_ENTRYPOINT,
    {
      ...SERVER_APP_SANDBOX_OPTIONS,
      env: {
        ...SERVER_APP_SANDBOX_OPTIONS.env,
        CALLER_PASSPHRASE: passPhrase,
      },
    },
  );

  await setCache("server_app_public_url", publicUrl, 600000);
  await setCache("server_app_sandbox_id", sandboxId, 600000);

  return { publicUrl, passPhrase };
}

export async function ensureServerAppReady(): Promise<SandboxConnectInfo> {
  const cachedUrl = await getCache<string>("server_app_public_url");
  const cachedId = await getCache<string>("server_app_sandbox_id");
  const cachedPass = await getCache<string>("server_app_pass_phrase");

  console.log("Cached server app info:", JSON.stringify({
    publicUrl: cachedUrl,
    sandboxId: cachedId,
    passPhrase: cachedPass,
  }, null, 2));

  if (
    cachedUrl && cachedId && cachedPass &&
    await isServerAppReachable(cachedUrl, cachedPass)
  ) {
    return { publicUrl: cachedUrl, passPhrase: cachedPass };
  }

  return await withLock("server_app_refresh", async () => {
    const cachedUrl2 = await getCache<string>("server_app_public_url");
    const cachedId2 = await getCache<string>("server_app_sandbox_id");
    const cachedPass2 = await getCache<string>("server_app_pass_phrase");

    if (
      cachedUrl2 && cachedId2 && cachedPass2 &&
      await isServerAppReachable(cachedUrl2, cachedPass2)
    ) {
      return { publicUrl: cachedUrl2, passPhrase: cachedPass2 };
    }
    return await refreshSandbox();
  }, { ttlMs: 20_000, waitMs: 200, maxWaitMs: 20_000 });
}

export async function fetchSandboxApi(
  state: SandboxRequestState,
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-App-Header", state.server_app_pass_phrase);

  if (!headers.has("accept") && init.json !== undefined) {
    headers.set("accept", "application/json");
  }

  let body: BodyInit | undefined = init.body ?? undefined;

  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }

  return await fetch(`${state.server_app_public_url}${path}`, {
    ...init,
    headers,
    body,
  });
}
