import { define } from "../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../lib/http.ts";
import { getStorageApi } from "../../../../lib/sandoboxGit.ts";
import { fetchCache } from "../../../../lib/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { getCommits } = await getStorageApi();
    try {
      const commits = await fetchCache<{}>(
        `commits-${ctx.params.name}.md`,
        async () => await getCommits(`${ctx.params.name}.md`),
      );

      return jsonResponse({ commits });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load commits", 500);
    }
  },
});
