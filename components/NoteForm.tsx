export function NoteForm() {
  return (
    <form
      class="card bg-base-100 shadow-sm border border-base-200 p-4 space-y-4"
      method="post"
      action="/api/storage"
    >
      <label class="form-control w-full gap-2">
        <span class="label-text text-sm font-semibold">Memo</span>
        <textarea
          name="content"
          rows={12}
          placeholder="Write your memo..."
          class="textarea textarea-bordered w-full"
          required
        />
      </label>
      <div>
        <button class="btn btn-primary" type="submit">Create</button>
      </div>
    </form>
  );
}
