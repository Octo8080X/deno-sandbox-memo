import { define } from "../../utils.ts";
import { errorResponse, parseBody, redirectResponse } from "../../libs/http.ts";
import { getCache, setCache } from "../../libs/kvCache.ts";

const HEADER_KEY = "X-App-Header";

export const handler = define.handlers({
  async POST(ctx) {
    const body = await parseBody(ctx.req);
    const content = (body.content ?? "").toString();

    if (!content.trim()) {
      return Response.redirect("/new");
    }

    try {
      const publicUrl = ctx.state.server_app_public_url
      const passphrase = await getCache<string>("server_app_pass_phrase");
      if (!publicUrl || !passphrase) {
        return errorResponse("Server app not ready", 502);
      }

      const resp = await fetch(`${publicUrl}/create_file`, {
        method: "POST",
        headers: {
          [HEADER_KEY]: passphrase,
          "content-type": "application/json",
        },
        body: JSON.stringify({ content }),
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
