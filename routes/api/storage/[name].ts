import { define } from "../../../utils.ts";
import { errorResponse, jsonResponse, parseBody } from "../../../lib/http.ts";
import { getStorageApi } from "../../../lib/sandboxGit.ts";
import { deleteCache, fetchCache, setCache } from "../../../lib/kvCache.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const { updateFileContent } = await getStorageApi();
    const body = await parseBody(ctx.req);
    const content = (body.content ?? "").toString();
    try {
      await updateFileContent(`${ctx.params.name}.md`, content);
      await setCache(`${ctx.params.name}.md`, content);
      await deleteCache(`commits-${ctx.params.name}.md`);

      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      await deleteCache(`${ctx.params.name}.md`);
      return errorResponse("Failed to save file", 500);
    }
  },
  async GET(ctx) {
    const { getFileContent } = await getStorageApi();
    try {
      const content = await fetchCache<string>(
        `${ctx.params.name}.md`,
        () => getFileContent(`${ctx.params.name}.md`),
      );

      if (content === null) {
        return errorResponse("File not found", 404);
      }
      return jsonResponse({ content });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to read file", 500);
    }
  },
});
