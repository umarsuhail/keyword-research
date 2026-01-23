import { loadOriginalHtml } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return new Response("Missing query param 'fileId'.", { status: 400 });
  }

  try {
    const html = await loadOriginalHtml(fileId);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Unknown fileId (not uploaded yet, or data was deleted).", {
      status: 404,
    });
  }
}
