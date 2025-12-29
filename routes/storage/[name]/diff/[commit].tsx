import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import DiffViewer from "../../../../islands/DiffViewer.tsx";

export default define.page(function DiffPage(ctx) {
  return (
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <Head>
        <title>Diff {ctx.params.name} @ {ctx.params.commit}</title>
      </Head>
      <header class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.2em] text-base-content/60">Diff</p>
          <h1 class="text-3xl font-bold break-all">{ctx.params.name}</h1>
          <p class="text-base-content/70">Commit {ctx.params.commit}</p>
        </div>
        <a class="btn btn-ghost" href={`/storage/${ctx.params.name}`}>Back</a>
      </header>
      <DiffViewer name={ctx.params.name} commit={ctx.params.commit} />
    </div>
  );
});
