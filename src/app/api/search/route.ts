import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "API disabled: this app runs client-only and performs search in your browser.",
    },
    { status: 410 },
  );
}
