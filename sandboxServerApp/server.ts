import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";

const HEADER_KEY = "X-App-Header";
const PASSPHRASE_ENV = "CALLER_PASSPHRASE"; // 呼び出し元パスフレーズを格納

const app = new Hono();

const STORAGE_DIR = "/data/storage";
const GIT_BIN = "/data/git/git";
const textDecoder = new TextDecoder();


type GitOutput = {
  stdout: string;
  stderr: string;
};

async function runGit(
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): Promise<GitOutput> {
  const command = new Deno.Command(GIT_BIN, {
    args,
    cwd: options.cwd ?? STORAGE_DIR,
    env: {
      GIT_CONFIG_GLOBAL: "/data/git/.gitconfig",
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdoutText = textDecoder.decode(output.stdout);
  const stderrText = textDecoder.decode(output.stderr);
  if (output.code !== 0 && !options.allowFailure) {
    throw new Error(stderrText || `git exited with ${output.code}`);
  }
  return { stdout: stdoutText, stderr: stderrText };
}

function mergeGitStdout(outputs: GitOutput[]) {
  return outputs.map((o) => o.stdout).filter(Boolean).join("\n");
}

function mergeGitStderr(outputs: GitOutput[]) {
  return outputs.map((o) => o.stderr).filter(Boolean).join("\n");
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
): Promise<{ content: string | null; gitStdout: string; gitStderr: string }> {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  const ref = opts.parent ? `${commit}^` : commit;
  try {
    const output = await runGit(["show", `${ref}:${pathArg}`], {
      allowFailure: false,
    });
    return {
      content: output.stdout,
      gitStdout: output.stdout,
      gitStderr: output.stderr,
    };
  } catch (_err) {
    return { content: null, gitStdout: "", gitStderr: "" };
  }
}

async function getDiff(
  fileName: string,
  commit: string,
): Promise<{ diff: string | null; gitStdout: string; gitStderr: string }> {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  try {
    const output = await runGit(["show", commit, "--", pathArg], {
      allowFailure: false,
    });
    return { diff: output.stdout, gitStdout: output.stdout, gitStderr: output.stderr };
  } catch (_err) {
    return { diff: null, gitStdout: "", gitStderr: "" };
  }
}

async function restoreFileFromCommit(fileName: string, commit: string) {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;
  const outputs: GitOutput[] = [];
  const showOutput = await runGit(["show", `${commit}:${pathArg}`]);
  outputs.push(showOutput);
  await Deno.writeTextFile(`${STORAGE_DIR}/${target}`, showOutput.stdout);
  outputs.push(await runGit(["add", target], { allowFailure: true }));
  outputs.push(await runGit([
    "commit",
    "-m",
    `restore ${target} to ${commit}`,
  ], { allowFailure: true }));
  return {
    ok: true,
    gitStdout: mergeGitStdout(outputs),
    gitStderr: mergeGitStderr(outputs),
  };
}

async function updateFileContent(fileName: string, content: string) {
  const outputs: GitOutput[] = [];
  await Deno.writeTextFile(`${STORAGE_DIR}/${fileName}`, content);
  outputs.push(await runGit(["add", fileName], { allowFailure: true }));
  outputs.push(await runGit([
    "commit",
    "-m",
    `update ${fileName}`,
  ], { allowFailure: true }));
  return {
    gitStdout: mergeGitStdout(outputs),
    gitStderr: mergeGitStderr(outputs),
  };
}

async function getStatus() {
  const output = await runGit(["status"], { allowFailure: true });
  return { status: output.stdout, gitStdout: output.stdout, gitStderr: output.stderr };
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

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) {
    return `${fallback}: ${err.message}`;
  }
  return fallback;
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
    return c.text(errorMessage(err, "Failed to list files"), 500);
  }
});

async function getCommits(fileName: string) {
  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const pathArg = target.startsWith("./") ? target : `./${target}`;

  const outputs: GitOutput[] = [];
  const tracked = await runGit(["ls-files", "--", pathArg], {
    allowFailure: true,
  });
  outputs.push(tracked);
  if (!tracked.stdout.trim()) {
    return {
      commits: [] as Array<
        {
          hash: string;
          author: string;
          email: string;
          date: string;
          message: string;
        }
      >,
      gitStdout: mergeGitStdout(outputs),
      gitStderr: mergeGitStderr(outputs),
    };
  }

  const raw = await runGit([
    "log",
    '--pretty=format:%H|%an|%ae|%ad|%s',
    "--date=iso",
    "--",
    pathArg,
  ], { allowFailure: true });
  outputs.push(raw);

  const lines = raw.stdout.trim().split("\n").filter(Boolean);
  const commits = lines.map((line) => {
    const [hash, author, email, date, ...messageParts] = line.split("|");
    const message = messageParts.join("|");
    return { hash, author, email, date, message };
  });

  return {
    commits,
    gitStdout: mergeGitStdout(outputs),
    gitStderr: mergeGitStderr(outputs),
  };
}

app.get("/commits", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  const fileName = c.req.query("fileName") ?? "";
  if (!fileName.trim()) {
    return c.text("Missing fileName", 400);
  }
  try {
    const { commits, gitStdout, gitStderr } = await getCommits(fileName);
    return c.json({ commits, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to get commits"), gitStdout: "", gitStderr: "" },
      500,
    );
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
    return c.text(errorMessage(err, "Failed to get file content"), 500);
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
    const { content, gitStdout, gitStderr } = await getFileAtCommit(
      fileName,
      commit,
      { parent },
    );
    if (content === null) {
      return c.text("File not found", 404);
    }
    return c.json({ content, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to get file at commit"), gitStdout: "", gitStderr: "" },
      500,
    );
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
    const { diff, gitStdout, gitStderr } = await getDiff(fileName, commit);
    if (diff === null) {
      return c.text("Diff not found", 404);
    }
    return c.json({ diff, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to get diff"), gitStdout: "", gitStderr: "" },
      500,
    );
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
    const { ok, gitStdout, gitStderr } = await restoreFileFromCommit(
      fileName,
      commit,
    );
    return c.json({ ok, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to restore file"), gitStdout: "", gitStderr: "" },
      500,
    );
  }
});

async function createFile(content: string) {
  const fileName = `${crypto.randomUUID()}.md`;
  const outputs: GitOutput[] = [];
  await Deno.writeTextFile(`${STORAGE_DIR}/${fileName}`, content);
  outputs.push(await runGit(["add", fileName], { allowFailure: true }));
  outputs.push(await runGit([
    "commit",
    "-m",
    `create ${fileName}`,
  ], { allowFailure: true }));
  return {
    fileName,
    gitStdout: mergeGitStdout(outputs),
    gitStderr: mergeGitStderr(outputs),
  };
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
    const { fileName, gitStdout, gitStderr } = await createFile(content);
    return c.json({ fileName, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to create file"), gitStdout: "", gitStderr: "" },
      500,
    );
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
    const { gitStdout, gitStderr } = await updateFileContent(fileName, content);
    return c.json({ ok: true, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to update file"), gitStdout: "", gitStderr: "" },
      500,
    );
  }
});

app.get("/status", async (c: Context) => {
  const res = validateCaller(c);
  if (res) return res;

  try {
    const { status, gitStdout, gitStderr } = await getStatus();
    return c.json({ status, gitStdout, gitStderr });
  } catch (err) {
    console.error(err);
    return c.json(
      { error: errorMessage(err, "Failed to get status"), gitStdout: "", gitStderr: "" },
      500,
    );
  }
});

Deno.serve({ port: 3000 }, app.fetch);