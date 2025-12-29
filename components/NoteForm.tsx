export function NoteForm() {
  return (
    <form class="form" method="post" action="/api/storage">
      <label class="form__field">
        <span class="form__label">Memo</span>
        <textarea
          name="content"
          rows={12}
          placeholder="Write your memo..."
          class="textarea"
          required
        />
      </label>
      <div>
        <button class="button primary" type="submit">Create</button>
      </div>
    </form>
  );
}
