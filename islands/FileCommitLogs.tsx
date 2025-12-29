import { Signal, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface FileCommitLogsProps {
  name: string;
  sync: Signal;
}

interface CommitEntry {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export default function FileCommitLogs({ name, sync }: FileCommitLogsProps) {
  const commits = useSignal<CommitEntry[]>([]);
  const loading = useSignal(true);
  const error = useSignal<string>("");

  useEffect(() => {
    const fetchCommits = async () => {
      loading.value = true;
      error.value = "";
      try {
        const res = await fetch(
          `/api/storage/${encodeURIComponent(name)}/commits`,
        );
        if (!res.ok) {
          throw new Error(`Failed to load commits: ${res.statusText}`);
        }
        const data = await res.json();
        commits.value = Array.isArray(data.commits) ? data.commits : [];
      } catch (err) {
        error.value = err instanceof Error
          ? err.message
          : "Failed to load commits";
      } finally {
        loading.value = false;
      }
    };
    fetchCommits();
  }, [name, sync.value]);

  return (
    <div class="commits" style={{ marginTop: "16px" }}>
      <header class="section-header">
        <div>
          <p class="eyebrow">History</p>
          <h2 class="title">Commits</h2>
        </div>
      </header>
      {loading.value && (
        <p class="muted">
          <span class="loading-spinner" aria-label="Loading" />{" "}
          Loading commits...
        </p>
      )}
      {error.value && !loading.value && <p class="muted">{error.value}</p>}
      {!loading.value && !error.value && commits.value.length === 0 && (
        <p class="muted">No commits yet.</p>
      )}
      {!loading.value && commits.value.length > 0 && (
        <ul class="commit-list">
          {commits.value.map((c) => (
            <li class="commit" key={c.hash}>
              <div>
                <p class="commit__title">{c.message || "(no message)"}</p>
                <p class="muted">
                  {new Date(c.date).toLocaleString()} — {c.author}
                </p>
              </div>
              <div class="actions">
                <a
                  class="button ghost"
                  href={`/storage/${encodeURIComponent(name)}/diff/${c.hash}`}
                >
                  Diff
                </a>
                <code class="muted" style={{ fontSize: "12px" }}>
                  {c.hash.slice(0, 8)}
                </code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
