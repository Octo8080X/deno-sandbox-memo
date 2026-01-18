import { define } from "../../../../utils.ts";
import { errorResponse, jsonResponse } from "../../../../libs/http.ts";
import { fetchSandboxApi } from "../../../../libs/connectSandboxGit.ts";
import { fetchCache } from "../../../../libs/kvCache.ts";

interface CommitEntry {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export const handler = define.handlers({
  async GET(ctx) {
    try {
      const commits = await fetchCache<CommitEntry[]>(
        `commits-${ctx.params.name}.md`,
        120,
        async () => {
          const resp = await fetchSandboxApi(ctx.state, `/commits?fileName=${ctx.params.name}`, {
            method: "GET",
          });

          if (!resp.ok) {
            return null;
          }
          const data = await resp.json();
          return (data as { commits?: CommitEntry[] }).commits ?? null;
        },
      );

      return jsonResponse({ commits });
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to load commits", 500);
    }
  },
});
