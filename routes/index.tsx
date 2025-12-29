import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { getStorageApi } from "../lib/sandoboxGit.ts";
import { fetchCache } from "../lib/kvCache.ts";

export default define.page(async function Home() {
  // sandbox 経由でファイルの一覧を取得
  const { getFiles } = await getStorageApi();
  const files = await fetchCache<string[]>("home_files", getFiles) as string[];

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
