import { Client, Sandbox, Volume } from "@deno/sandbox";

const GIT_STORAGE_VOLUME_NAME = "git-storage-volume";
const DATA_STORAGE_VOLUME_NAME = "data-storage-volume";

async function getGitStorageVolume() {
  const client = new Client();
  let volume: Volume | null = null;

  console.log(await (await client.volumes.list()).items);
  if (
    await (await client.volumes.list()).items.filter((v) =>
      v.slug === GIT_STORAGE_VOLUME_NAME
    )
      .length > 0
  ) {
    //console.log(`using existing volume: ${GIT_STORAGE_VOLUME_NAME}`);
    volume = await client.volumes.get(GIT_STORAGE_VOLUME_NAME)!;
  } else {
    //console.log(`creating volume: ${GIT_STORAGE_VOLUME_NAME}`);
    volume = await client.volumes.create({
      slug: GIT_STORAGE_VOLUME_NAME,
      region: "ord",
      capacity: "300MiB",
    });
  }
  return volume;
}

async function getDataStorageVolume() {
  const client = new Client();
  let storageVolume: Volume | null = null;
  if (
    await (await client.volumes.list()).items.filter((v) =>
      v.slug === DATA_STORAGE_VOLUME_NAME
    )
      .length > 0
  ) {
    //console.log(`using existing volume: ${DATA_STORAGE_VOLUME_NAME}`);
    storageVolume = await client.volumes.get(DATA_STORAGE_VOLUME_NAME)!;
  } else {
    //console.log(`creating volume: ${DATA_STORAGE_VOLUME_NAME}`);
    storageVolume = await client.volumes.create({
      slug: DATA_STORAGE_VOLUME_NAME,
      region: "ord",
      capacity: "300MiB",
    });
  }
  return storageVolume;
}

export async function initSandBoxStorage() {
  const gitStorageVolume = await getGitStorageVolume();
  const storageVolume = await getDataStorageVolume();

  {
    console.log("initialize volume on sandbox");
    await using sandbox = await Sandbox.create({
      memoryMb: 4096,
      volumes: {
        "/data/git": gitStorageVolume!.id,
        "/data/storage": storageVolume!.id,
      },
      env: {
        GIT_CONFIG_GLOBAL: "/data/git/.gitconfig",
      },

      region: "ord",
    });

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

    // sandbox を落とす前にsyncしておかないと反映されないケースがある。
    await sandbox.sh`sync`.sudo();
  }
}

export async function getStorageApi() {
  const createSandbox = async (volumes: { [key: string]: string }) =>
    await Sandbox.create({
      memoryMb: 4096,
      volumes,
      env: {
        GIT_CONFIG_GLOBAL: "/data/git/.gitconfig",
      },
      region: "ord",
    });

  const withSandbox = async <T>(
    fn: (sandbox: Sandbox) => Promise<T>,
  ): Promise<T> => {
    const gitStorageVolume = await getGitStorageVolume();
    const storageVolume = await getDataStorageVolume();

    await using sandbox = await createSandbox(
      {
        "/data/git": gitStorageVolume!.id,
        "/data/storage": storageVolume!.id,
      },
    );
    return await fn(sandbox);
  };

  async function getFiles() {
    // markdown ファイルのみをリストアップ
    // 末尾の.mdは削除
    return await withSandbox(async (sandbox) => {
      return (await Array.fromAsync(sandbox.readDir("/data/storage")))
        .filter((de) => de.isFile)
        .map((de) => de.name)
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -3));
    });
  }

  async function getCommits(fileName: string) {
    return await withSandbox(async (sandbox) => {
      const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
      const pathArg = target.startsWith("./") ? target : `./${target}`;
      try {
        // ensure the file is tracked; if not, git log will fail
        const tracked = await sandbox
          .sh`cd /data/storage && /data/git/git ls-files -- ${pathArg}`.text();
        if (!tracked.trim()) {
          console.log(`git log skipped (not tracked): ${target}`);
          return [] as Array<
            {
              hash: string;
              author: string;
              email: string;
              date: string;
              message: string;
            }
          >;
        }

        const raw = await sandbox
          .sh`cd /data/storage && /data/git/git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso -- ${pathArg} || true`
          .text();
        console.log(`git log raw for ${target}:\n${raw}`);

        const lines = raw.trim().split("\n").filter(Boolean);
        return lines.map((line) => {
          const [hash, author, email, date, ...messageParts] = line.split("|");
          const message = messageParts.join("|");
          return { hash, author, email, date, message };
        });
      } catch (err) {
        console.error(`getCommits failed for ${target}:`, err);
        return [] as Array<{
          hash: string;
          author: string;
          email: string;
          date: string;
          message: string;
        }>;
      }
    });
  }

  async function getFileContent(fileName: string): Promise<string | null> {
    console.log(`getFileContent: ${fileName}`);
    try {
      return await withSandbox(async (sandbox) => {
        return await sandbox.readTextFile(`/data/storage/${fileName}`);
      });
    } catch (_err) {
      return null;
    }
  }

  async function getFileAtCommit(
    fileName: string,
    commit: string,
    opts: { parent?: boolean } = {},
  ) {
    const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const pathArg = target.startsWith("./") ? target : `./${target}`;
    const ref = opts.parent ? `${commit}^` : commit;
    console.log(`getFileAtCommit: ${ref}:${pathArg}`);
    try {
      return await withSandbox(async (sandbox) => {
        return await sandbox
          .sh`cd /data/storage && /data/git/git show ${ref}:${pathArg}`
          .text();
      });
    } catch (err) {
      console.error(`getFileAtCommit failed for ${ref}:${pathArg}:`, err);
      return null;
    }
  }
  async function getDiff(fileName: string, commit: string) {
    const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const pathArg = target.startsWith("./") ? target : `./${target}`;
    console.log(`getDiff: ${pathArg} @ ${commit}`);
    try {
      return await withSandbox(async (sandbox) => {
        return await sandbox
          .sh`cd /data/storage && /data/git/git show ${commit} -- ${pathArg}`
          .text();
      });
    } catch (err) {
      console.error(`getDiff failed for ${pathArg} @ ${commit}:`, err);
      return null;
    }
  }

  async function restoreFileFromCommit(fileName: string, commit: string) {
    const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const pathArg = target.startsWith("./") ? target : `./${target}`;
    console.log(`restoreFileFromCommit: ${pathArg} <= ${commit}`);
    try {
      return await withSandbox(async (sandbox) => {
        const content = await sandbox
          .sh`cd /data/storage && /data/git/git show ${commit}:${pathArg}`
          .text();

        await sandbox.writeTextFile(`/data/storage/${target}`, content);
        await sandbox
          .sh`cd /data/storage && /data/git/git add ${target} && /data/git/git commit -m "restore ${target} to ${commit}" || echo "no changes to commit"`;
        await sandbox.sh`sync`.sudo();
        return true;
      });
    } catch (err) {
      console.error(
        `restoreFileFromCommit failed for ${pathArg} @ ${commit}:`,
        err,
      );
      return false;
    }
  }

  async function updateFileContent(fileName: string, content: string) {
    await withSandbox(async (sandbox) => {
      await sandbox.writeTextFile(`/data/storage/${fileName}`, content);
      await sandbox
        .sh`cd /data/storage && /data/git/git add ${fileName} && /data/git/git commit -m "update ${fileName}" || echo "no changes to commit"`;
      await sandbox.sh`sync`.sudo();
    });
  }

  async function createFile(content: string) {
    const fileName = `${crypto.randomUUID()}.md`;
    await withSandbox(async (sandbox) => {
      await sandbox.writeTextFile(`/data/storage/${fileName}`, content);
      await sandbox
        .sh`cd /data/storage && /data/git/git add ${fileName} && /data/git/git commit -m "create ${fileName}" || echo "no changes to commit"`;
      await sandbox.sh`sync`.sudo();
    });
    return fileName;
  }
  async function getStatus() {
    return await withSandbox(async (sandbox) => {
      return await sandbox
        .sh`cd /data/storage && /data/git/git status`
        .text();
    });
  }
  return {
    getFiles,
    getCommits,
    getFileContent,
    getFileAtCommit,
    getDiff,
    restoreFileFromCommit,
    createFile,
    updateFileContent,
    getStatus,
  };
}
