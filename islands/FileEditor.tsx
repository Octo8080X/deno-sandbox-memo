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
    <div class="editor">
      <div class="editor__header">
        <div>
          <p class="eyebrow">Editing</p>
          <h2 class="title">{name}</h2>
        </div>
        <button
          class="button primary"
          disabled={status.value === "saving"}
          onClick={save}
        >
          {status.value === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
      {onLoading && (
        <p class="muted">
          <span class="loading-spinner" aria-label="Loading" /> Loading
        </p>
      )}
      {!onLoading && (
        <textarea
          class="textarea editor__textarea"
          value={content.value ?? ""}
          onInput={(e) => {
            const target = e.currentTarget as HTMLTextAreaElement;
            content.value = target.value;
          }}
          rows={20}
        />
      )}
      {message.value && (
        <p class={status.value === "error" ? "muted" : "muted"}>
          {message.value}
        </p>
      )}
    </div>
  );
}
