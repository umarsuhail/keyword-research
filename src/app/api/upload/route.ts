import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "API disabled: this app runs client-only and parses the HTML in your browser.",
    },
    { status: 410 },
  );
}
