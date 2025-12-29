import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import FileContainer from "../../islands/FileContainer.tsx";

export default define.page(async function StorageFilePage(ctx) {
  return (
    <div class="page">
      <Head>
        <title>{ctx.params.name}</title>
      </Head>
      <FileContainer name={ctx.params.name} />
    </div>
  );
});
