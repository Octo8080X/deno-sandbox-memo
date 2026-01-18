import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../libs/http.ts";
import { fetchSandboxApi } from "../../../../../libs/connectSandboxGit.ts";
import { fetchCache } from "../../../../../libs/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const [before, after] = await Promise.all([
        fetchCache(
          `${ctx.params.name}-${ctx.params.commit}-before`,
          120,
          async () => {
            const resp = await fetchSandboxApi(ctx.state, "/file_at_commit", {
              method: "POST",
              json: {
                fileName: `${ctx.params.name}`,
                commit: ctx.params.commit,
                parent: true,
              },
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return (data as { content?: string }).content ?? null;
          },
        ),
        fetchCache(
          `${ctx.params.name}-${ctx.params.commit}-after`,
          120,
          async () => {
            const resp = await fetchSandboxApi(ctx.state, "/file_at_commit", {
              method: "POST",
              json: {
                fileName: `${ctx.params.name}`,
                commit: ctx.params.commit,
              },
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return (data as { content?: string }).content ?? null;
          },
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
