/**
 * Public API endpoint for FAQ data.
 * Returns FAQ entries for a given resource (product, collection, or store).
 */
export const loader = async ({ request }) => {
  const { default: prisma } = await import("../db.server");
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const resourceType = url.searchParams.get("type") || "store";
  const resourceId = url.searchParams.get("resource_id");

  if (!shop) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const where = { shop, resourceType, published: true };
  if (resourceId) where.resourceId = resourceId;

  const faqs = await prisma.faqEntry.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: {
      question: true,
      answer: true,
      keywords: true,
    },
  });

  return new Response(JSON.stringify({ faqs }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
