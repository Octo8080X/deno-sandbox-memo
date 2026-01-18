import { Client, Sandbox, SandboxOptions, Volume } from "@deno/sandbox";

const GIT_STORAGE_VOLUME_NAME = "git-storage-volume";
const SERVER_APP_STORAGE_VOLUME_NAME = "git-server-app-storage-volume";
const DATA_STORAGE_VOLUME_NAME = `${Deno.env.get("APP_ENV")}-git-data-storage-volume`

async function getStorageVolume(slug: string) {
  const client = new Client();

  let volume: Volume | null = null;

  const volumes = await client.volumes.list();
  if (volumes.items.filter((v) => v.slug === slug).length > 0) {
    volume = await client.volumes.get(slug)!;
  } else {
    volume = await client.volumes.create({
      slug,
      region: "ord",
      capacity: "300MiB",
    });
  }
  return volume;
}

const createSandbox = async (options?: SandboxOptions) => {
  const sandbox = await Sandbox.create({
    memoryMb: 4096,
    region: "ord",
    ...options,
  });
  return sandbox;
};

const withSandbox = async <T>(
  fn: (sandbox: Sandbox) => Promise<T>,
  options?: SandboxOptions,
): Promise<T> => {
  await using sandbox = await createSandbox(options);
  return await fn(sandbox);
};

export const SERVER_APP_ENTRYPOINT = "/data/server_app/server.ts";
export const SERVER_APP_SANDBOX_OPTIONS: SandboxOptions = {
  volumes: {
    "/data/server_app": SERVER_APP_STORAGE_VOLUME_NAME,
    "/data/git": GIT_STORAGE_VOLUME_NAME,
    "/data/storage": DATA_STORAGE_VOLUME_NAME,
  },
  env: {
    GIT_CONFIG_GLOBAL: "/data/git/.gitconfig",
  },
  region: "ord",
  memoryMb: 4096,
  timeout: "10m",
};


const buildGitSandboxOptions = (volumes: Record<string, string>): SandboxOptions => {
  return {
    volumes,
    env: {
      GIT_CONFIG_GLOBAL: "/data/git/.gitconfig",
    },
    region: "ord",
    memoryMb: 4096,
  };
};

export async function isRunningSandbox(sandboxId: string): Promise<boolean> {
  const client = new Client();

  const sandboxes = await client.sandboxes.list();
  for (const sandbox of sandboxes) {
    if (sandbox.id === sandboxId && sandbox.status === "running") {
      console.info(`Sandbox ${sandboxId} is found in the list.`);
      return true;
    }
  }
  console.info(`Sandbox ${sandboxId} is not found in the list.`);
  return false;
  
}

export const startServerAppSandbox = async (
  entrypoint: string,
  options?: SandboxOptions,
): Promise<{publicUrl: string, sandboxId: string}> => {
  console.info("startServerAppSandbox options:", options);
  await using sandbox = await createSandbox(options);
  await sandbox.deno.run({ entrypoint });
  const publicUrl = await sandbox.exposeHttp({ port: 3000 });
  return {publicUrl, sandboxId: sandbox.id};
}

export const stopServerAppSandbox = async (sandboxId: string) => {
  const client = new Client();
  const list = await client.sandboxes.list();
  for (const sandbox of list) {
    if (sandbox.id === sandboxId) {
      const sandbox = await Sandbox.connect({id: sandboxId});
      await sandbox.kill()
      console.log(`Sandbox ${sandboxId} stopped and deleted.`);
      return;
    }
}
}

export async function initSandBoxStorage() {
  const gitStorageVolume = await getStorageVolume(GIT_STORAGE_VOLUME_NAME);
  const storageVolume = await getStorageVolume(DATA_STORAGE_VOLUME_NAME);

  const gitSandboxOptions = buildGitSandboxOptions({
    "/data/git": gitStorageVolume!.id,
    "/data/storage": storageVolume!.id,
  });

  await withSandbox(async (sandbox) => {
    console.log("initialize volume on sandbox");

    console.log("apt update");
    await sandbox.sh`apt-get update > /dev/null 2>&1`.sudo();

    console.log("install git");
    await sandbox.sh`apt-get install -y git`.sudo();
    console.log(await sandbox.sh`git --version`.text());

    console.log("stage git binaries into /data/git volume");
    await sandbox.sh`mkdir -p /data/git/app /data/git/lib`.sudo();
    await sandbox.sh`sh -c 'cd /tmp && apt-get download git git-man'`.sudo();
    await sandbox.sh`dpkg -x /tmp/git_* /data/git/app`.sudo();
    await sandbox.sh`dpkg -x /tmp/git-man_* /data/git/app`.sudo();
    await sandbox
      .sh`sh -c 'set -e; ldd /data/git/app/usr/bin/git | awk "/=>/ {print $3}" | grep -E "^/" | while read -r path; do echo "lib: $path"; cp -n "$path" /data/git/lib/; done'`
      .sudo();
    await sandbox.sh`sh -c 'cat <<"EOF" > /data/git/git
#!/bin/sh
export LD_LIBRARY_PATH=/data/git/lib:\${LD_LIBRARY_PATH}
export GIT_EXEC_PATH=/data/git/app/usr/libexec/git-core
export PATH=/data/git/app/usr/bin:/data/git/app/usr/libexec/git-core:\${PATH}
exec /data/git/app/usr/bin/git "$@"
EOF'`.sudo();
    await sandbox.sh`chmod +x /data/git/git`.sudo();
    await sandbox.sh`/data/git/git --version`.sudo();
    console.log(await sandbox.sh`ls -la /data/git | head`.text());
    await sandbox.sh`sync`.sudo();

    console.log("configure git identity (volume git)");
    await sandbox.sh`/data/git/git config --global user.name "sandbox"`;
    await sandbox
      .sh`/data/git/git config --global user.email "sandbox@example.com"`;

    console.log("init repo into storage volume using volume git");
    await sandbox
      .sh`cd /data/storage && /data/git/git init && /data/git/git branch -m main && /data/git/git add -A && /data/git/git commit --allow-empty -m "initial commit"`;

    console.log("list git log from volume");
    await sandbox
      .sh`cd /data/storage && /data/git/git log`;

    //await sandbox.fs.writeTextFile("/data/storage/a.md", "# Hello from sandbox\nThis is a test file.");
    //await sandbox
    //  .sh`cd /data/storage && /data/git/git add a.md && /data/git/git commit -m "add a.md"`;

    // sandbox を落とす前にsyncしておかないと反映されないケースがある。
    await sandbox.sh`sync`.sudo();
  }, gitSandboxOptions);

    // server app 用の volume初期化
  const serverAppStorageVolume = await getStorageVolume(SERVER_APP_STORAGE_VOLUME_NAME);
  const serverAppSandboxOptions: SandboxOptions = {
    volumes: {
      "/data/server_app": serverAppStorageVolume!.id,
    },
    region: "ord",
  };

  await withSandbox(async (sandbox) => {
    await sandbox.fs.writeTextFile("/data/server_app/server.ts", Deno.readTextFileSync("./sandboxServerApp/server.ts"));
    await sandbox.fs.writeTextFile("/data/server_app/deno.json", Deno.readTextFileSync("./sandboxServerApp/deno.json"));
    await sandbox.sh`cd /data/server_app && deno install`;
    await sandbox.sh`ls -la /data/server_app`.sudo();
    
    // sandbox を落とす前にsyncしておかないと反映されないケースがある。
    await sandbox.sh`sync`.sudo();
  }, serverAppSandboxOptions);
}

if (import.meta.main) {
  await initSandBoxStorage();
}
