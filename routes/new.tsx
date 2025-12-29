import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { NoteForm } from "../components/NoteForm.tsx";

export default define.page(function NewNote() {
  return (
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <Head>
        <title>New Memo</title>
      </Head>
      <header class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-3xl font-bold">Create a memo</h1>
          <p class="text-base-content/70">Just start typing your note.</p>
        </div>
        <a class="btn btn-ghost" href="/">Back</a>
      </header>

      <NoteForm />
    </div>
  );
});
