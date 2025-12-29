import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { getStorageApi } from "../lib/sandoboxGit.ts";
import { fetchCache } from "../lib/kvCache.ts";

export default define.page(async function Home() {
  // sandbox 経由でファイルの一覧を取得
  const { getFiles } = await getStorageApi();
  const files = await fetchCache<string[]>("home_files", getFiles) as string[];

  return (
    <div class="page">
      <Head>
        <title>Memo List</title>
      </Head>

      <section class="files">
        <div class="page__header">
          <div>
            <p class="eyebrow">Memo Files</p>
          </div>
        </div>

        {files.length === 0 && (
          <div class="empty">
            <p>No files in storage.</p>
            <p class="muted">Add a memo to see it here.</p>
          </div>
        )}

        {files.length > 0 && (
          <ul class="note-grid">
            {files.map((file) => (
              <li class="note-card" key={file}>
                <a
                  class="note-card__link"
                  href={`/storage/${encodeURIComponent(file)}`}
                >
                  <div class="note-card__icon" aria-hidden="true">📄</div>
                  <div>
                    <h2>{file}</h2>
                    <p class="preview muted">Click to open</p>
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
