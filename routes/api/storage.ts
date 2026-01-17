import { define } from "../../utils.ts";
import { errorResponse, parseBody, redirectResponse } from "../../libs/http.ts";
import { fetchSandboxApi } from "../../libs/connectSandboxGit.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const body = await parseBody(ctx.req);
    const content = (body.content ?? "").toString();

    if (!content.trim()) {
      return Response.redirect("/new");
    }

    try {
      const resp = await fetchSandboxApi(ctx.state, "/create_file", {
        method: "POST",
        json: { content },
      });

      console.log("Create file response:", resp);

      if (!resp.ok) {
        const message = await resp.text();
        return errorResponse(message || "Failed to create file", 502);
      }

      return redirectResponse(`/`);
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to create file", 500);
    }
  },
});
