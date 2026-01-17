export function jsonResponse(
  data: unknown,
  init: number | ResponseInit = 200,
): Response {
  const responseInit: ResponseInit = typeof init === "number"
    ? { status: init }
    : init;
  const headers = new Headers(responseInit.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...responseInit, headers });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export async function parseBody(
  req: Request,
): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = await req.json();
      return typeof json === "object" && json !== null
        ? json as Record<string, unknown>
        : {};
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      return Object.fromEntries(formData.entries());
    }
  } catch (_err) {
    // Fall through to empty object on parse errors
  }
  return {};
}

export function methodOverride(req: Request): string {
  const url = new URL(req.url);
  const override = url.searchParams.get("_method");
  return override ? override.toUpperCase() : req.method.toUpperCase();
}

export function redirectResponse(location: string, status = 303): Response {
  return new Response(null, {
    status,
    headers: {
      location,
    },
  });
}
