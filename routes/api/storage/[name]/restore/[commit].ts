import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../lib/http.ts";
import { getStorageApi } from "../../../../../lib/sandoboxGit.ts";
import { deleteCache } from "../../../../../lib/kvCache.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const { restoreFileFromCommit } = await getStorageApi();
    try {
      const ok = await restoreFileFromCommit(
        `${ctx.params.name}`,
        ctx.params.commit,
      );
      if (!ok) return errorResponse("Restore failed", 500);
      deleteCache(`${ctx.params.name}.md`);
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to restore", 500);
    }
  },
});
