import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import FileContainer from "../../islands/FileContainer.tsx";

export default define.page(async function StorageFilePage(ctx) {
  return (
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <Head>
        <title>{ctx.params.name}</title>
      </Head>
      <FileContainer name={ctx.params.name} />
    </div>
  );
});
