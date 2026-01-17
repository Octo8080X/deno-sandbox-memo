import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../libs/http.ts";
import { getStorageApi } from "../../../../../libs/sandboxGit.ts";
import { fetchCache } from "../../../../../libs/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { getDiff } = await getStorageApi();
    try {
      const diff = await fetchCache(
        `${ctx.params.name}-diff-${ctx.params.commit}`,
        () => getDiff(`${ctx.params.name}`, ctx.params.commit),
      );
      if (diff === null) return errorResponse("Diff not available", 404);
      return jsonResponse({ diff });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load diff", 500);
    }
  },
});
