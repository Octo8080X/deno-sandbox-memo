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
    <div class="commits" style={{ marginTop: "16px" }}>
      <header class="section-header">
        <div>
          <p class="eyebrow">Diff</p>
          <h2 class="title">Commit {commit}</h2>
        </div>
        <div class="diff-toolbar">
          <button
            class={`button ${view.value === "split" ? "primary" : "ghost"}`}
            onClick={() => (view.value = "split")}
          >
            Split
          </button>
          <button
            class={`button ${view.value === "before" ? "primary" : "ghost"}`}
            onClick={() => {
              view.value = "before";
              fetchSnapshotIfNeeded();
            }}
          >
            Before
          </button>
          <button
            class={`button ${view.value === "after" ? "primary" : "ghost"}`}
            onClick={() => {
              view.value = "after";
              fetchSnapshotIfNeeded();
            }}
          >
            After
          </button>
          <button
            class={`button danger ${restoreLoading.value ? "loading" : ""}`}
            onClick={handleRestore}
          >
            {restoreLoading.value ? "Restoring..." : "Restore"}
          </button>
        </div>
      </header>

      {restoreDone.value && (
        <p class="muted" role="status">{restoreDone.value}</p>
      )}
      {restoreError.value && (
        <p class="muted" role="alert">{restoreError.value}</p>
      )}

      {(view.value === "before" || view.value === "after") &&
        snapshotLoading.value && (
        <p class="muted">
          <span class="loading-spinner" aria-label="Loading" />{" "}
          Loading snapshot...
        </p>
      )}
      {(view.value === "before" || view.value === "after") &&
        snapshotError.value && !snapshotLoading.value && (
        <p class="muted">{snapshotError.value}</p>
      )}

      {loading.value && (
        <p class="muted">
          <span class="loading-spinner" aria-label="Loading" /> Loading diff...
        </p>
      )}
      {error.value && !loading.value && <p class="muted">{error.value}</p>}

      {!loading.value && !error.value && view.value === "split" && (
        <div class="diff-block diff-split">
          {metaOnly.length > 0 && (
            <div class="diff-meta-block">
              {metaOnly.map((line, idx) => (
                <div key={idx} class="diff-meta-line">
                  <code>{line.text}</code>
                </div>
              ))}
            </div>
          )}
          {hunkRows.length === 0 && (
            <p class="muted" style={{ padding: "10px" }}>(no diff)</p>
          )}
          {hunkRows.length > 0 && (
            <div class="split-head">
              <div
                class="split-cell label"
                style={{ gridColumn: "1 / span 2" }}
              >
                Before
              </div>
              <div
                class="split-cell label"
                style={{ gridColumn: "3 / span 2" }}
              >
                After
              </div>
            </div>
          )}
          {hunkRows.map((line, idx) => {
            if (line.type === "meta") {
              return (
                <div class="split-row meta" key={idx}>
                  <div class="split-cell meta">
                    <code>{line.text}</code>
                  </div>
                </div>
              );
            }

            const oldText = line.type === "add" ? "" : line.text;
            const newText = line.type === "del" ? "" : line.text;

            return (
              <div class={`split-row ${line.type}`} key={idx}>
                <div class="split-cell line-no">{line.oldLine ?? ""}</div>
                <div class="split-cell code old">
                  <code>{oldText || " "}</code>
                </div>
                <div class="split-cell line-no">{line.newLine ?? ""}</div>
                <div class="split-cell code new">
                  <code>{newText || " "}</code>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view.value === "before" && !snapshotLoading.value &&
        !snapshotError.value && (
        <div class="diff-block">
          {beforeContent.value === null && (
            <p class="muted">(no parent snapshot)</p>
          )}
          {beforeContent.value !== null &&
            lines.map((line, idx) => (
              <div class="diff-line" key={idx}>
                <span class="line-no">{idx + 1}</span>
                <code>{line || " "}</code>
              </div>
            ))}
        </div>
      )}

      {view.value === "after" && !snapshotLoading.value &&
        !snapshotError.value && (
        <div class="diff-block">
          {afterContent.value === null && (
            <p class="muted">(file not present in commit)</p>
          )}
          {afterContent.value !== null &&
            lines.map((line, idx) => (
              <div class="diff-line" key={idx}>
                <span class="line-no">{idx + 1}</span>
                <code>{line || " "}</code>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
