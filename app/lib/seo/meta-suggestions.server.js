/**
 * SEO Meta Tag Suggestion Generator
 * Generates optimized title and description suggestions for products.
 */

/**
 * Generate an optimized SEO title for a product.
 */
export function generateTitleSuggestion(product, shopName) {
  const title = product.title || "";
  const vendor = product.vendor || "";
  const type = product.productType || "";

  let suggestion = title;

  // Add type if available and not already in title
  if (type && !title.toLowerCase().includes(type.toLowerCase())) {
    suggestion = `${title} - ${type}`;
  }

  // Add vendor/brand if it fits
  if (vendor && !suggestion.includes(vendor)) {
    const withVendor = `${suggestion} by ${vendor}`;
    if (withVendor.length <= 60) {
      suggestion = withVendor;
    }
  }

  // Add shop name as suffix if it fits
  if (shopName) {
    const withShop = `${suggestion} | ${shopName}`;
    if (withShop.length <= 60) {
      suggestion = withShop;
    }
  }

  // Truncate to 60 chars if needed
  if (suggestion.length > 60) {
    suggestion = suggestion.substring(0, 57) + "...";
  }

  return suggestion;
}

/**
 * Generate an optimized SEO description for a product.
 */
export function generateDescriptionSuggestion(product, shopName) {
  const title = product.title || "";
  const descHtml = product.descriptionHtml || "";
  const descText = descHtml.replace(/<[^>]*>/g, "").trim();
  const vendor = product.vendor || "";
  const type = product.productType || "";

  // Get first meaningful sentence from description
  const sentences = descText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const firstSentence = sentences[0]?.trim() || "";

  // Get price if available
  const price = product.priceRangeV2?.minVariantPrice?.amount;
  const currency = product.priceRangeV2?.minVariantPrice?.currencyCode || "USD";
  const priceStr = price ? `Starting at $${parseFloat(price).toFixed(2)}` : "";

  // Build description
  const parts = [];

  // Action opener
  parts.push(`Shop the ${title}${vendor ? ` by ${vendor}` : ""}.`);

  // First sentence from existing description
  if (firstSentence && firstSentence.length < 80) {
    parts.push(firstSentence + ".");
  }

  // Price and CTA
  if (priceStr) {
    parts.push(`${priceStr}.`);
  }

  if (shopName) {
    parts.push(`Available at ${shopName}.`);
  }

  let suggestion = parts.join(" ");

  // Truncate to 160 chars if needed
  if (suggestion.length > 160) {
    suggestion = suggestion.substring(0, 157) + "...";
  }

  return suggestion;
}

/**
 * Generate suggestions for a batch of products.
 */
export function generateBulkSuggestions(products, shopName) {
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    currentSeoTitle: product.seo?.title || "",
    currentSeoDescription: product.seo?.description || "",
    suggestedTitle: generateTitleSuggestion(product, shopName),
    suggestedDescription: generateDescriptionSuggestion(product, shopName),
  }));
}
