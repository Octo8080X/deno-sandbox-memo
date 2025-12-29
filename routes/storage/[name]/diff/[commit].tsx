import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import DiffViewer from "../../../../islands/DiffViewer.tsx";

export default define.page(function DiffPage(ctx) {
  return (
    <div class="page">
      <Head>
        <title>Diff {ctx.params.name} @ {ctx.params.commit}</title>
      </Head>
      <header class="page__header">
        <div>
          <p class="eyebrow">Diff</p>
          <h1 class="title">{ctx.params.name}</h1>
          <p class="muted">Commit {ctx.params.commit}</p>
        </div>
        <a class="button" href={`/storage/${ctx.params.name}`}>Back</a>
      </header>
      <DiffViewer name={ctx.params.name} commit={ctx.params.commit} />
    </div>
  );
});
