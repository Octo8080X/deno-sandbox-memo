import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../libs/http.ts";
import { fetchSandboxApi } from "../../../../../libs/connectSandboxGit.ts";
import { fetchCache } from "../../../../../libs/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const diff = await fetchCache(
        `${ctx.params.name}-diff-${ctx.params.commit}`,
        120,
        async () => {
          const resp = await fetchSandboxApi(ctx.state, "/diff", {
            method: "POST",
            json: {
              fileName: `${ctx.params.name}`,
              commit: ctx.params.commit,
            },
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          return (data as { diff?: string }).diff ?? null;
        },
      );
      if (diff === null) return errorResponse("Diff not available", 404);
      return jsonResponse({ diff });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load diff", 500);
    }
  },
});
