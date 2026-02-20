/**
 * Public API endpoint that serves llms.txt content.
 * Accessible at /api/llms-txt (no auth required).
 * Merchants link this from their storefront proxy.
 */
export const loader = async ({ request }) => {
  const { default: prisma } = await import("../db.server");
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const record = await prisma.llmsTxt.findUnique({ where: { shop } });

  if (!record) {
    return new Response("# No llms.txt generated yet\n\nInstall the AI Discovery Optimizer app to generate this file.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const full = url.searchParams.get("full") === "true";
  const content = full ? record.fullContent || record.content : record.content;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
