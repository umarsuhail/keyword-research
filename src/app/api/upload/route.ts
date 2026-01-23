import { NextResponse } from "next/server";

import { parseMessagesFromHtml } from "@/lib/parseHtml";
import { saveOriginalHtml, saveParsedFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing form file field 'file'." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max is ${MAX_UPLOAD_BYTES} bytes.` },
      { status: 413 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const html = Buffer.from(arrayBuffer).toString("utf-8");

  const messages = parseMessagesFromHtml(html);
  if (messages.length === 0) {
    return NextResponse.json(
      {
        error:
          "No message blocks found. The HTML may not match the expected export format.",
      },
      { status: 422 },
    );
  }

  const fileId = crypto.randomUUID();

  // Persist original HTML for the "Original HTML" viewer.
  await saveOriginalHtml(fileId, html);

  const meta = await saveParsedFile({
    fileId,
    originalName: file.name,
    messages,
  });

  return NextResponse.json({ fileId, meta });
}
