import { define } from "../../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../../libs/http.ts";
import { fetchSandboxApi } from "../../../../../libs/connectSandboxGit.ts";
import { deleteCache } from "../../../../../libs/kvCache.ts";

export const handler = define.handlers({
  async POST(ctx) {
    try {
      const resp = await fetchSandboxApi(ctx.state, "/restore_file", {
        method: "POST",
        json: {
          fileName: `${ctx.params.name}`,
          commit: ctx.params.commit,
        },
      });
      if (!resp.ok) {
        const message = await resp.text();
        return errorResponse(message || "Restore failed", 502);
      }

      console.log("Restore response:", await resp.json());

      await deleteCache(`${ctx.params.name}.md`);
      await deleteCache(`commits-${ctx.params.name}.md`);
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to restore", 500);
    }
  },
});
