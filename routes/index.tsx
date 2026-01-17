import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { getCache } from "../libs/kvCache.ts";
import { fetchSandboxApi } from "../libs/connectSandboxGit.ts";

export default define.page(async function Home(ctx) {


  console.log(ctx)

  let files: string[] = []
  if(await getCache("git_files") == null) {
    const resp = await fetchSandboxApi(ctx.state, "/files", { method: "GET" });

    if (!resp.ok) {
      const message = await resp.text();
      return new Response(
        JSON.stringify({ error: message || "convert failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
    files = (await resp.json())["files"]
  }

  console.log("Fetching files from server app sandbox...");

  return (
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-4">
      <Head>
        <title>Memo List</title>
      </Head>

      <section class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-base-content/60">
              Memo Files
            </p>
          </div>
        </div>

        {files.length === 0 && (
          <div class="alert alert-info shadow-sm">
            <p class="font-semibold">No files in storage.</p>
            <p class="text-sm opacity-80">Add a memo to see it here.</p>
          </div>
        )}

        {files.length > 0 && (
          <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <li
                class="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition duration-150"
                key={file}
              >
                <a
                  class="card-body p-4 gap-2 flex flex-col h-full"
                  href={`/storage/${encodeURIComponent(file)}`}
                >
                  <div class="text-xl" aria-hidden="true">📄</div>
                  <div class="space-y-1">
                    <h2 class="card-title text-lg">{file}</h2>
                    <p class="text-sm text-base-content/70">Click to open</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});
