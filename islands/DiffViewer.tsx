import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";

interface DiffViewerProps {
  name: string;
  commit: string;
}

export default function DiffViewer({ name, commit }: DiffViewerProps) {
  const diff = useSignal<string | null>(null);
  const beforeContent = useSignal<string | null>(null);
  const afterContent = useSignal<string | null>(null);
  const loading = useSignal(true);
  const snapshotLoading = useSignal(false);
  const restoreLoading = useSignal(false);
  const error = useSignal<string>("");
  const snapshotError = useSignal<string>("");
  const restoreError = useSignal<string>("");
  const restoreDone = useSignal<string>("");
  const view = useSignal<"split" | "before" | "after">("split");

  useEffect(() => {
    const fetchDiff = async () => {
      loading.value = true;
      error.value = "";
      beforeContent.value = null;
      afterContent.value = null;
      snapshotError.value = "";
      restoreError.value = "";
      restoreDone.value = "";
      snapshotLoading.value = false;
      view.value = "split";
      try {
        const res = await fetch(
          `/api/storage/${encodeURIComponent(name)}/diff/${commit}`,
        );
        if (!res.ok) throw new Error(`Failed to load diff: ${res.statusText}`);
        const data = await res.json();
        diff.value = data.diff ?? "";
      } catch (err) {
        error.value = err instanceof Error
          ? err.message
          : "Failed to load diff";
      } finally {
        loading.value = false;
      }
    };
    fetchDiff();
  }, [name, commit]);

  const fetchSnapshotIfNeeded = async () => {
    if (
      (beforeContent.value !== null || afterContent.value !== null) ||
      snapshotLoading.value
    ) return;
    snapshotLoading.value = true;
    snapshotError.value = "";
    try {
      const res = await fetch(
        `/api/storage/${encodeURIComponent(name)}/snapshot/${commit}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to load snapshot: ${res.statusText}`);
      }
      const data = await res.json();
      beforeContent.value = data.before ?? null;
      afterContent.value = data.after ?? null;
    } catch (err) {
      snapshotError.value = err instanceof Error
        ? err.message
        : "Failed to load snapshot";
    } finally {
      snapshotLoading.value = false;
    }
  };

  const getActiveLines = () => {
    if (view.value === "before") return (beforeContent.value ?? "").split("\n");
    if (view.value === "after") return (afterContent.value ?? "").split("\n");
    return (diff.value ?? "").split("\n");
  };

  const lines = getActiveLines();

  type DiffEntry = {
    type: "add" | "del" | "context" | "meta";
    oldLine: number | null;
    newLine: number | null;
    text: string;
    gutter: string;
  };

  const parseDiff = (text: string): DiffEntry[] => {
    if (!text) return [];
    const result: DiffEntry[] = [];
    const rawLines = text.split("\n");
    let oldLine = 0;
    let newLine = 0;

    for (const line of rawLines) {
      if (line.startsWith("@@")) {
        const m = /@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
        if (m) {
          oldLine = parseInt(m[1], 10);
          newLine = parseInt(m[3], 10);
        }
        result.push({
          type: "meta",
          oldLine: null,
          newLine: null,
          text: line,
          gutter: "@",
        });
        continue;
      }

      if (
        line.startsWith("diff ") || line.startsWith("index ") ||
        line.startsWith("---") || line.startsWith("+++")
      ) {
        result.push({
          type: "meta",
          oldLine: null,
          newLine: null,
          text: line,
          gutter: "@",
        });
        continue;
      }

      if (line.startsWith("+")) {
        result.push({
          type: "add",
          oldLine: null,
          newLine: newLine++,
          text: line.slice(1),
          gutter: "+",
        });
        continue;
      }

      if (line.startsWith("-")) {
        result.push({
          type: "del",
          oldLine: oldLine++,
          newLine: null,
          text: line.slice(1),
          gutter: "-",
        });
        continue;
      }

      if (line.startsWith(" ")) {
        result.push({
          type: "context",
          oldLine: oldLine++,
          newLine: newLine++,
          text: line.slice(1),
          gutter: " ",
        });
        continue;
      }

      // Fallback for unexpected lines
      result.push({
        type: "meta",
        oldLine: null,
        newLine: null,
        text: line,
        gutter: "@",
      });
    }

    return result;
  };

  const parsedDiff = useMemo(() => parseDiff(diff.value ?? ""), [diff.value]);
  const metaOnly = useMemo(
    () =>
      parsedDiff.filter((l) => l.type === "meta" && !l.text.startsWith("@@")),
    [parsedDiff],
  );
  const hunkRows = useMemo(
    () =>
      parsedDiff.filter((l) => l.type !== "meta" || l.text.startsWith("@@")),
    [parsedDiff],
  );

  const handleRestore = async () => {
    if (restoreLoading.value) return;
    restoreError.value = "";
    restoreDone.value = "";
    const ok = window.confirm("Restore this file to the selected commit?");
    if (!ok) return;
    restoreLoading.value = true;
    try {
      const res = await fetch(`/api/storage/${name}/restore/${commit}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Failed to restore: ${res.statusText}`);
      restoreDone.value =
        "Restored. Reload or reopen the file to see the latest content.";
    } catch (err) {
      restoreError.value = err instanceof Error
        ? err.message
        : "Failed to restore";
    } finally {
      restoreLoading.value = false;
    }
  };

  return (
    <div
      class="card bg-base-100 shadow-sm border border-base-200 p-4 space-y-4"
      style={{ marginTop: "16px" }}
    >
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.2em] text-base-content/60">
            Diff
          </p>
          <h2 class="text-2xl font-bold break-all">Commit {commit}</h2>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button
            class={`btn btn-outline ${
              view.value === "split" ? "btn-active" : ""
            }`}
            onClick={() => (view.value = "split")}
          >
            Split
          </button>
          <button
            class={`btn btn-outline ${
              view.value === "before" ? "btn-active" : ""
            }`}
            onClick={() => {
              view.value = "before";
              fetchSnapshotIfNeeded();
            }}
          >
            Before
          </button>
          <button
            class={`btn btn-outline ${
              view.value === "after" ? "btn-active" : ""
            }`}
            onClick={() => {
              view.value = "after";
              fetchSnapshotIfNeeded();
            }}
          >
            After
          </button>
          <button
            class={`btn btn-error ${restoreLoading.value ? "loading" : ""}`}
            onClick={handleRestore}
          >
            {restoreLoading.value ? "Restoring..." : "Restore"}
          </button>
        </div>
      </header>

      {restoreDone.value && (
        <p class="alert alert-success shadow-sm" role="status">
          {restoreDone.value}
        </p>
      )}
      {restoreError.value && (
        <p class="alert alert-error shadow-sm" role="alert">
          {restoreError.value}
        </p>
      )}

      {(view.value === "before" || view.value === "after") &&
        snapshotLoading.value && (
        <p class="flex items-center gap-2 text-sm text-base-content/70">
          <span
            class="loading loading-spinner loading-sm"
            aria-label="Loading"
          />
          <span>Loading snapshot...</span>
        </p>
      )}
      {(view.value === "before" || view.value === "after") &&
        snapshotError.value && !snapshotLoading.value && (
        <p class="alert alert-error shadow-sm">{snapshotError.value}</p>
      )}

      {loading.value && (
        <p class="flex items-center gap-2 text-sm text-base-content/70">
          <span
            class="loading loading-spinner loading-sm"
            aria-label="Loading"
          />
          <span>Loading diff...</span>
        </p>
      )}
      {error.value && !loading.value && (
        <p class="alert alert-error shadow-sm">{error.value}</p>
      )}

      {!loading.value && !error.value && view.value === "split" && (
        <div class="rounded-lg border border-base-300 bg-base-200 shadow-sm overflow-hidden">
          {metaOnly.length > 0 && (
            <div class="px-4 py-3 text-sm bg-base-300 border-b border-base-200 font-mono text-base-content/80">
              {metaOnly.map((line, idx) => (
                <div key={idx} class="leading-relaxed">
                  <code>{line.text}</code>
                </div>
              ))}
            </div>
          )}
          {hunkRows.length === 0 && (
            <p class="px-4 py-3 text-base-content/70 text-sm">(no diff)</p>
          )}
          {hunkRows.length > 0 && (
            <div class="grid grid-cols-[64px_1fr_64px_1fr] border-b border-base-300 bg-base-300 text-xs font-semibold uppercase text-base-content">
              <div class="px-3 py-2" style={{ gridColumn: "1 / span 2" }}>
                Before
              </div>
              <div class="px-3 py-2" style={{ gridColumn: "3 / span 2" }}>
                After
              </div>
            </div>
          )}
          {hunkRows.map((line, idx) => {
            if (line.type === "meta") {
              return (
                <div
                  class="grid grid-cols-[64px_1fr_64px_1fr] border-b border-base-300 bg-base-300 font-semibold text-base-content"
                  key={idx}
                >
                  <div class="px-3 py-2 col-span-4 whitespace-pre-wrap">
                    <code>{line.text}</code>
                  </div>
                </div>
              );
            }

            const oldText = line.type === "add" ? "" : line.text;
            const newText = line.type === "del" ? "" : line.text;

            const baseRowClass =
              "grid grid-cols-[64px_1fr_64px_1fr] border-b border-base-300 text-sm font-mono whitespace-pre-wrap text-base-content";
            const rowHighlight = line.type === "add"
              ? "bg-success/15 border-l-4 border-success/60"
              : line.type === "del"
              ? "bg-error/15 border-l-4 border-error/60"
              : "bg-base-100";

            return (
              <div class={`${baseRowClass} ${rowHighlight}`} key={idx}>
                <div class="px-3 py-2 text-right text-xs text-base-content/70 font-mono align-top">
                  {line.oldLine ?? ""}
                </div>
                <div class="px-3 py-2 align-top whitespace-pre-wrap">
                  <code class="text-base-content">{oldText || " "}</code>
                </div>
                <div class="px-3 py-2 text-right text-xs text-base-content/70 font-mono align-top">
                  {line.newLine ?? ""}
                </div>
                <div class="px-3 py-2 align-top whitespace-pre-wrap">
                  <code class="text-base-content">{newText || " "}</code>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view.value === "before" && !snapshotLoading.value &&
        !snapshotError.value && (
        <div class="rounded-lg border border-base-300 bg-base-200 shadow-sm overflow-hidden">
          {beforeContent.value === null && (
            <p class="px-4 py-3 text-base-content/70">(no parent snapshot)</p>
          )}
          {beforeContent.value !== null &&
            lines.map((line, idx) => (
              <div
                class="grid grid-cols-[56px_1fr] border-b border-base-300 text-sm font-mono whitespace-pre-wrap"
                key={idx}
              >
                <span class="px-3 py-2 text-right text-xs text-base-content/70 font-mono">
                  {idx + 1}
                </span>
                <code class="px-3 py-2 whitespace-pre-wrap block">
                  {line || " "}
                </code>
              </div>
            ))}
        </div>
      )}

      {view.value === "after" && !snapshotLoading.value &&
        !snapshotError.value && (
        <div class="rounded-lg border border-base-300 bg-base-200 shadow-sm overflow-hidden">
          {afterContent.value === null && (
            <p class="px-4 py-3 text-base-content/70">
              (file not present in commit)
            </p>
          )}
          {afterContent.value !== null &&
            lines.map((line, idx) => (
              <div
                class="grid grid-cols-[56px_1fr] border-b border-base-300 text-sm font-mono whitespace-pre-wrap"
                key={idx}
              >
                <span class="px-3 py-2 text-right text-xs text-base-content/70 font-mono">
                  {idx + 1}
                </span>
                <code class="px-3 py-2 whitespace-pre-wrap block">
                  {line || " "}
                </code>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
