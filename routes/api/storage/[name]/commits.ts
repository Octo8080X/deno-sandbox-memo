import { define } from "../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../libs/http.ts";
import { fetchSandboxApi } from "../../../../libs/connectSandboxGit.ts";
import { fetchCache } from "../../../../libs/kvCache.ts";

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const commits = await fetchCache<{}>(
        `commits-${ctx.params.name}.md`,
        120,
        async () => {
          const resp = await fetchSandboxApi(ctx.state, `/commits?fileName=${ctx.params.name}`, {
            method: "GET",
          });

          console.log("Commits response:", resp);

          if (!resp.ok) {
            return null;
          }
          const data = await resp.json();
          console.log("Commits data:", data);
          return (data as { commits?: {} }).commits ?? null;
        },
      );

      return jsonResponse({ commits });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load commits", 500);
    }
  },
});
