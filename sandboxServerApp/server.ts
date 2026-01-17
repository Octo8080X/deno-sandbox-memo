import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";

const HEADER_KEY = "X-App-Header";
const PASSPHRASE_ENV = "CALLER_PASSPHRASE"; // 呼び出し元パスフレーズを格納

const app = new Hono();

const STORAGE_DIR = "/data/storage";


async function runGit(
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd: "/data/git",
  });
  const output = await command.outputSync();
  const textDecoder = new TextDecoder();
  const stdoutText = textDecoder.decode(output.stdout);
  if (output.code !== 0 && !options.allowFailure) {
    const stderrText = textDecoder.decode(output.stderr);
    throw new Error(stderrText || `git exited with ${output.code}`);
  }
  return stdoutText;
}

async function listFiles(): Promise<string[]> {
  const entries = [] as string[];
  for await (const entry of Deno.readDir(STORAGE_DIR)) {
    if (!entry.isFile) continue;
    if (!entry.name.endsWith(".md")) continue;
    entries.push(entry.name.slice(0, -3));
  }
  return entries;
}

async function getCommits(fileName: string) {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;

  const tracked = await runGit(["ls-files", "--", pathArg], {
    allowFailure: true,
  });
  if (!tracked.trim()) {
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

  const raw = await runGit([
    "log",
    '--pretty=format:%H|%an|%ae|%ad|%s',
    "--date=iso",
    "--",
    pathArg,
  ], { allowFailure: true });

  const lines = raw.trim().split("\n").filter(Boolean);
  return lines.map((line) => {
    const [hash, author, email, date, ...messageParts] = line.split("|");
    const message = messageParts.join("|");
    return { hash, author, email, date, message };
  });
}

async function getFileContent(fileName: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(`${STORAGE_DIR}/${fileName}`);
  } catch (_err) {
    return null;
  }
}

async function getFileAtCommit(
  fileName: string,
  commit: string,
  opts: { parent?: boolean } = {},
): Promise<string | null> {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  const ref = opts.parent ? `${commit}^` : commit;
  try {
    return await runGit(["show", `${ref}:${pathArg}`], { allowFailure: false });
  } catch (_err) {
    return null;
  }
}

async function getDiff(fileName: string, commit: string): Promise<string | null> {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  try {
    return await runGit(["show", commit, "--", pathArg], {
      allowFailure: false,
    });
  } catch (_err) {
    return null;
  }
}

async function restoreFileFromCommit(fileName: string, commit: string) {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  const content = await runGit(["show", `${commit}:${pathArg}`]);
  await Deno.writeTextFile(`${STORAGE_DIR}/${target}`, content);
  await runGit(["add", target], { allowFailure: true });
  await runGit([
    "commit",
    "-m",
    `restore ${target} to ${commit}`,
  ], { allowFailure: true });
  return true;
}

async function updateFileContent(fileName: string, content: string) {
  await Deno.writeTextFile(`${STORAGE_DIR}/${fileName}`, content);
  await runGit(["add", fileName], { allowFailure: true });
  await runGit([
    "commit",
    "-m",
    `update ${fileName}`,
  ], { allowFailure: true });
}



async function getStatus() {
  return await runGit(["status"], { allowFailure: true });
}

function validateCaller(c: Context) {
  const expected = Deno.env.get(PASSPHRASE_ENV);
  if (!expected) {
    return c.text("Server misconfigured: missing passphrase", 500);
  }

  const received = c.req.header(HEADER_KEY);
  if (!received || received !== expected) {
    return c.text("Forbidden", 403);
  }

  return null;
}

app.get("/", (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  return c.text("Hello, Hono! from Deno Sandbox");
});

app.get("/files", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  try {
    const files = await listFiles();
    return c.json({ files });
  } catch (err) {
    console.error(err);
    return c.text("Failed to list files", 500);
  }
});

app.get("/commits", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const fileName = c.req.query("fileName") ?? "";
  if (!fileName.trim()) {
    return c.text("Missing fileName", 400);
  }
  try {
    const commits = await getCommits(fileName);
    return c.json({ commits });
  } catch (err) {
    console.error(err);
    return c.text("Failed to get commits", 500);
  }
});

app.post("/file_content", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const fileName = (body.fileName ?? "").toString();
  if (!fileName.trim()) {
    return c.text("Missing fileName", 400);
  }
  try {
    const content = await getFileContent(fileName);
    if (content === null) {
      return c.text("File not found", 404);
    }
    return c.json({ content });
  } catch (err) {
    console.error(err);
    return c.text("Failed to get file content", 500);
  }
});

app.post("/file_at_commit", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const fileName = (body.fileName ?? "").toString();
  const commit = (body.commit ?? "").toString();
  const parent = Boolean(body.parent);
  if (!fileName.trim() || !commit.trim()) {
    return c.text("Missing fileName or commit", 400);
  }
  try {
    const content = await getFileAtCommit(fileName, commit, { parent });
    if (content === null) {
      return c.text("File not found", 404);
    }
    return c.json({ content });
  } catch (err) {
    console.error(err);
    return c.text("Failed to get file at commit", 500);
  }
});

app.post("/diff", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const fileName = (body.fileName ?? "").toString();
  const commit = (body.commit ?? "").toString();
  if (!fileName.trim() || !commit.trim()) {
    return c.text("Missing fileName or commit", 400);
  }
  try {
    const diff = await getDiff(fileName, commit);
    if (diff === null) {
      return c.text("Diff not found", 404);
    }
    return c.json({ diff });
  } catch (err) {
    console.error(err);
    return c.text("Failed to get diff", 500);
  }
});

app.post("/restore_file", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const fileName = (body.fileName ?? "").toString();
  const commit = (body.commit ?? "").toString();
  if (!fileName.trim() || !commit.trim()) {
    return c.text("Missing fileName or commit", 400);
  }
  try {
    const ok = await restoreFileFromCommit(fileName, commit);
    return c.json({ ok });
  } catch (err) {
    console.error(err);
    return c.text("Failed to restore file", 500);
  }
});

async function createFile(content: string) {
  const fileName = `${crypto.randomUUID()}.md`;
  await Deno.writeTextFile(`${STORAGE_DIR}/${fileName}`, content);
  await runGit(["add", fileName], { allowFailure: true });
  await runGit([
    "commit",
    "-m",
    `create ${fileName}`,
  ], { allowFailure: true });
  return fileName;
}

app.post("/create_file", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const content = (body.content ?? "").toString();
  
  
  if (!content.trim()) {
    return c.text("Missing content", 400);
  }


  try {
    const fileName = await createFile(content);
    return c.json({ fileName });
  } catch (err) {
    console.error(err);
    return c.text(`Failed to create file ${err}`, 500);
  }
});


app.post("/update_file", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const body = await c.req.json().catch(() => ({}));
  const fileName = (body.fileName ?? "").toString();
  const content = (body.content ?? "").toString();
  if (!fileName.trim()) {
    return c.text("Missing fileName", 400);
  }
  try {
    await updateFileContent(fileName, content);
    return c.json({ ok: true });
  } catch (err) {
    console.error(err);
    return c.text("Failed to update file", 500);
  }
});

app.get("/status", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  try {
    const status = await getStatus();
    return c.json({ status });
  } catch (err) {
    console.error(err);
    return c.text("Failed to get status", 500);
  }
});

Deno.serve({ port: 3000 }, app.fetch);