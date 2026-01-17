import { define } from "../../../utils.ts";
import { errorResponse, jsonResponse, parseBody } from "../../../libs/http.ts";
import { fetchSandboxApi } from "../../../libs/connectSandboxGit.ts";
import { deleteCache, fetchCache, setCache } from "../../../libs/kvCache.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const body = await parseBody(ctx.req);
    const content = (body.content ?? "").toString();
    try {
      const resp = await fetchSandboxApi(ctx.state, "/update_file", {
        method: "POST",
        json: { fileName: `${ctx.params.name}.md`, content },
      });


      console.log("Update file response:", resp);



      if (!resp.ok) {
        const message = await resp.text();
        return errorResponse(message || "Failed to save file", 502);
      }

      console.log("Saving to cache:", await resp.json());

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
    try {
      const content = await fetchCache<string>(
        `${ctx.params.name}.md`,
        120,
        async () => {
          const resp = await fetchSandboxApi(ctx.state, "/file_content", {
            method: "POST",
            json: { fileName: `${ctx.params.name}.md` },
          });
          if (!resp.ok) {
            return null;
          }
          const data = await resp.json();
          return (data as { content?: string }).content ?? null;
        },
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
