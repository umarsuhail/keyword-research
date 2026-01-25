export async function GET() {
  return new Response(
    "API disabled: this app runs client-only and generates the readable view locally.",
    { status: 410 },
  );
}
