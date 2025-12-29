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
    <div
      class="card bg-base-100 shadow-sm border border-base-200 p-4 space-y-4"
      style={{ marginTop: "16px" }}
    >
      <header class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.2em] text-base-content/60">
            History
          </p>
          <h2 class="text-2xl font-bold">Commits</h2>
        </div>
      </header>
      {loading.value && (
        <p class="flex items-center gap-2 text-sm text-base-content/70">
          <span
            class="loading loading-spinner loading-sm"
            aria-label="Loading"
          />
          <span>Loading commits...</span>
        </p>
      )}
      {error.value && !loading.value && (
        <p class="alert alert-error shadow-sm">{error.value}</p>
      )}
      {!loading.value && !error.value && commits.value.length === 0 && (
        <p class="alert alert-info shadow-sm">No commits yet.</p>
      )}
      {!loading.value && commits.value.length > 0 && (
        <ul class="space-y-3">
          {commits.value.map((c) => (
            <li
              class="border border-base-200 rounded-lg p-3 flex items-start justify-between gap-3"
              key={c.hash}
            >
              <div class="space-y-1">
                <p class="font-semibold">{c.message || "(no message)"}</p>
                <p class="text-sm text-base-content/70">
                  {new Date(c.date).toLocaleString()} — {c.author}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  class="btn btn-ghost btn-sm"
                  href={`/storage/${encodeURIComponent(name)}/diff/${c.hash}`}
                >
                  Diff
                </a>
                <span class="badge badge-outline badge-sm font-mono">
                  {c.hash.slice(0, 8)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
