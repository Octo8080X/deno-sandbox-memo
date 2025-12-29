import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../lib/http.ts";
import { getStorageApi } from "../../../../../lib/sandoboxGit.ts";
import { fetchCache } from "../../../../../lib/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { getFileAtCommit } = await getStorageApi();
    try {
      const [before, after] = await Promise.all([
        fetchCache(
          `${ctx.params.name}-${ctx.params.commit}`,
          () =>
            getFileAtCommit(`${ctx.params.name}`, ctx.params.commit, {
              parent: true,
            }),
        ),
        fetchCache(
          `${ctx.params.name}-${ctx.params.commit}`,
          () => getFileAtCommit(`${ctx.params.name}`, ctx.params.commit),
        ),
      ]);

      if (before === null && after === null) {
        return errorResponse("Snapshot not available", 404);
      }

      return jsonResponse({ before, after });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load snapshot", 500);
    }
  },
});
