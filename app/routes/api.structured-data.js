/**
 * Public API endpoint for structured data.
 * Returns JSON-LD schemas for a given product or homepage.
 */
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const type = url.searchParams.get("type") || "homepage"; // "homepage" or "product"
  const productHandle = url.searchParams.get("handle");

  if (!shop) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const config = await prisma.structuredDataConfig.findUnique({
    where: { shop },
  });

  if (!config) {
    return new Response(JSON.stringify({ error: "Structured data not configured" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return the config — actual schema generation happens in the theme extension
  return new Response(JSON.stringify({ config, type, productHandle }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
