export async function GET() {
  return new Response(
    "API disabled: this app runs client-only and renders original HTML locally.",
    { status: 410 },
  );
}
