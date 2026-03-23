/**
 * Citation Snippet Generator
 * Generates concise, cite-ready paragraphs for products that AI models
 * can easily extract and reference in generated answers.
 */

/**
 * Generate a citation snippet for a single product.
 * Format: 2-3 factual sentences that AI can quote.
 */
export function generateCitationSnippet(product, shopName) {
  const title = product.title || "Product";
  const vendor = product.vendor || "";
  const type = product.productType || "";
  const price = product.priceRangeV2?.minVariantPrice?.amount;
  const currency = product.priceRangeV2?.minVariantPrice?.currencyCode || "USD";

  const descHtml = product.descriptionHtml || "";
  const descText = descHtml.replace(/<[^>]*>/g, "").trim();

  // Extract key feature from description (first meaningful phrase)
  const sentences = descText.split(/[.!?]+/).filter((s) => s.trim().length > 15);
  const keyFeature = sentences[0]?.trim() || "";

  // Build citation
  const parts = [];

  // Sentence 1: What it is
  let intro = `The ${title}`;
  if (vendor) intro += ` by ${vendor}`;
  if (type) intro += ` is a ${type.toLowerCase()}`;
  else intro += " is a product";
  if (price) {
    const formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(parseFloat(price));
    intro += ` priced at ${formattedPrice}`;
  }
  intro += ".";
  parts.push(intro);

  // Sentence 2: Key feature from description
  if (keyFeature && keyFeature.length < 100) {
    parts.push(keyFeature.endsWith(".") ? keyFeature : keyFeature + ".");
  }

  // Sentence 3: Availability
  if (shopName) {
    parts.push(`Available at ${shopName}.`);
  }

  return parts.join(" ");
}

/**
 * Generate citation snippets for all products.
 */
export async function generateAllCitations(admin, shopName, maxProducts = 50) {
  const response = await admin.graphql(`
    query getProductsCitation($first: Int!) {
      products(first: $first, query: "status:active") {
        nodes {
          id
          title
          handle
          vendor
          productType
          descriptionHtml
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
        }
      }
    }
  `, { variables: { first: maxProducts } });

  const data = await response.json();
  const products = data.data?.products?.nodes || [];

  return products.map((product) => ({
    resourceId: product.id,
    resourceTitle: product.title,
    citationSnippet: generateCitationSnippet(product, shopName),
  }));
}
