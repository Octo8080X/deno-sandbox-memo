import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import { NoteForm } from "../components/NoteForm.tsx";

export default define.page(function NewNote() {
  return (
    <div class="page">
      <Head>
        <title>New Memo</title>
      </Head>
      <header class="page__header">
        <div>
          <h1 class="title">Create a memo</h1>
          <p class="muted">Just start typing your note.</p>
        </div>
        <a class="button" href="/">Back</a>
      </header>

      <NoteForm />
    </div>
  );
});
