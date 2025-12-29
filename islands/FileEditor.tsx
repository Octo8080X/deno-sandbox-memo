import { Signal, useSignal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";

interface FileEditorProps {
  name: string;
  sync: Signal;
}

export default function FileEditor({ name, sync }: FileEditorProps) {
  const content = useSignal<string | null>(null);
  const status = useSignal<"idle" | "saving" | "saved" | "error">("idle");
  const message = useSignal<string>("");
  const [onLoading, setOnLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setOnLoading(true);
      try {
        const res = await fetch(`/api/storage/${encodeURIComponent(name)}`);
        if (!res.ok) {
          throw new Error(`Failed to load file: ${res.statusText}`);
        }
        const data = await res.json();
        content.value = data.content;
      } catch (err) {
        content.value = "";
        status.value = "error";
        message.value = err instanceof Error
          ? err.message
          : "Failed to load file";
      } finally {
        setOnLoading(false);
      }
    };

    if (content.value === null) {
      console.log(`Fetching content for file: ${name}`);
      fetchContent();
    }
  }, []);

  const save = async () => {
    status.value = "saving";
    message.value = "";
    try {
      const res = await fetch(`/api/storage/${name}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: content.value }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save");
      }
      status.value = "saved";
      message.value = "Saved";
      setTimeout(() => {
        if (status.value === "saved") status.value = "idle";
        message.value = "";
        sync.value++;
      }, 1200);
    } catch (err) {
      status.value = "error";
      message.value = err instanceof Error ? err.message : "Failed to save";
    }
  };

  return (
    <div class="card bg-base-100 shadow-sm border border-base-200 p-4 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.2em] text-base-content/60">Editing</p>
          <h2 class="text-2xl font-bold break-all">{name}</h2>
        </div>
        <button
          class={`btn btn-primary ${status.value === "saving" ? "loading" : ""}`}
          disabled={status.value === "saving"}
          onClick={save}
        >
          {status.value === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
      {onLoading && (
        <p class="flex items-center gap-2 text-sm text-base-content/70">
          <span class="loading loading-spinner loading-sm" aria-label="Loading" />
          <span>Loading</span>
        </p>
      )}
      {!onLoading && (
        <textarea
          class="textarea textarea-bordered w-full min-h-[24rem]"
          value={content.value ?? ""}
          onInput={(e) => {
            const target = e.currentTarget as HTMLTextAreaElement;
            content.value = target.value;
          }}
          rows={20}
        />
      )}
      {message.value && (
        <p
          class={`alert shadow-sm ${status.value === "error" ? "alert-error" : "alert-success"}`}
        >
          {message.value}
        </p>
      )}
    </div>
  );
}
