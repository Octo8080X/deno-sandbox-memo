import { define } from "../../utils.ts";
import { errorResponse, parseBody, redirectResponse } from "../../lib/http.ts";
import { getStorageApi } from "../../lib/sandboxGit.ts";
import { deleteCache } from "../../lib/kvCache.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const { createFile } = await getStorageApi();
    const body = await parseBody(ctx.req);
    const content = (body.content ?? "").toString();

    if (!content.trim()) {
      return Response.redirect("/new");
    }

    // simple slug based on timestamp for uniqueness
    try {
      await createFile(content);
      await deleteCache("home_files");
      return redirectResponse(`/`);
    } catch (err) {
      console.error(err);
      return errorResponse("Failed to create file", 500);
    }
  },
});
