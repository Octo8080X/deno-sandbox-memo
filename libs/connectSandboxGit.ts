import { getCache, setCache } from "./kvCache.ts";
import {
  isRunningSandbox,
  SERVER_APP_ENTRYPOINT,
  SERVER_APP_SANDBOX_OPTIONS,
  startServerAppSandbox,
  stopServerAppSandbox
} from "./sandboxGit.ts";

type SandboxConnectInfo ={
    publicUrl: string;
    passPhrase: string;
}

export async function ensureServerAppReady(): Promise<SandboxConnectInfo> {
  const publicUrl = await getCache<string>("server_app_public_url");
  const passPhrase = await getCache<string>("server_app_pass_phrase");
  if (publicUrl && passPhrase) {
    return { publicUrl, passPhrase };
  }


  const sandboxId = await getCache<string>("server_app_sandbox_id");
  if (sandboxId && await isRunningSandbox(sandboxId)) {
    await stopServerAppSandbox(sandboxId);
  }

  const newPassPhrase = crypto.randomUUID();
  await setCache("server_app_pass_phrase", newPassPhrase, 600000);

  const { publicUrl: createdUrl, sandboxId: createdId } =
    await startServerAppSandbox(
      SERVER_APP_ENTRYPOINT,
      {
        ...SERVER_APP_SANDBOX_OPTIONS,
        env: { CALLER_PASSPHRASE: newPassPhrase },
      },
    );

  await setCache("server_app_public_url", createdUrl, 600000);
  await setCache("server_app_sandbox_id", createdId, 600000);

  return { publicUrl: createdUrl, passPhrase: newPassPhrase };
}
