/**
 * Conversational FAQ Generator
 *
 * Generates natural-language Q&A pairs for products and collections,
 * optimized for AI shopping agents. Includes keyword synonyms and
 * conversational phrases that match how people ask AI assistants.
 */

/**
 * Generate FAQ entries for a product.
 * Creates conversational Q&A pairs that AI agents love to cite.
 */
export function generateProductFaqs(product, shop) {
  const faqs = [];
  const title = product.title;
  const vendor = product.vendor;
  const type = product.productType;
  const minPrice = product.priceRangeV2?.minVariantPrice;
  const maxPrice = product.priceRangeV2?.maxVariantPrice;
  const variants = product.variants?.edges?.map((e) => e.node) || [];
  const inStock = product.totalInventory > 0;
  const description = product.description?.replace(/<[^>]*>/g, "").trim() || "";

  // Q: What is this product?
  faqs.push({
    question: `What is the ${title}?`,
    answer: description
      ? `The ${title}${vendor ? ` by ${vendor}` : ""} is ${type ? `a ${type.toLowerCase()}` : "a product"} available at ${shop.name}. ${description.slice(0, 300)}`
      : `The ${title}${vendor ? ` by ${vendor}` : ""} is ${type ? `a ${type.toLowerCase()}` : "a product"} available at ${shop.name}.`,
    keywords: [title, vendor, type, ...(product.tags || [])].filter(Boolean).join(", "),
  });

  // Q: How much does it cost?
  if (minPrice) {
    const priceAnswer =
      maxPrice && parseFloat(maxPrice.amount) > parseFloat(minPrice.amount)
        ? `The ${title} ranges from ${minPrice.currencyCode} ${minPrice.amount} to ${maxPrice.amount} depending on the variant you choose.`
        : `The ${title} costs ${minPrice.currencyCode} ${minPrice.amount}.`;

    faqs.push({
      question: `How much does the ${title} cost?`,
      answer: priceAnswer,
      keywords: `${title} price, ${title} cost, how much ${title}, ${title} ${minPrice.currencyCode} ${minPrice.amount}`,
    });
  }

  // Q: Is it in stock?
  faqs.push({
    question: `Is the ${title} in stock?`,
    answer: inStock
      ? `Yes, the ${title} is currently in stock and available for purchase at ${shop.name}.`
      : `The ${title} is currently out of stock. Check back soon or contact ${shop.name} for restocking updates.`,
    keywords: `${title} availability, ${title} in stock, buy ${title}, ${title} available`,
  });

  // Q: What options/variants are available?
  if (variants.length > 1) {
    const variantList = variants
      .map((v) => `${v.title} (${minPrice?.currencyCode || ""} ${v.price})`)
      .join(", ");

    faqs.push({
      question: `What options are available for the ${title}?`,
      answer: `The ${title} comes in ${variants.length} options: ${variantList}.`,
      keywords: `${title} options, ${title} variants, ${title} sizes, ${title} colors`,
    });
  }

  // Q: What brand makes it?
  if (vendor) {
    faqs.push({
      question: `Who makes the ${title}?`,
      answer: `The ${title} is made by ${vendor}, available exclusively through ${shop.name}.`,
      keywords: `${title} brand, ${title} manufacturer, ${vendor} products, ${vendor} ${type || ""}`.trim(),
    });
  }

  // Q: Comparison/recommendation style
  if (type) {
    faqs.push({
      question: `Is the ${title} a good ${type.toLowerCase()}?`,
      answer: `The ${title}${vendor ? ` by ${vendor}` : ""} is a popular ${type.toLowerCase()} at ${shop.name}. ${description ? description.slice(0, 200) : `Check the product page for full details and customer reviews.`}`,
      keywords: `best ${type.toLowerCase()}, ${title} review, ${title} worth it, recommended ${type.toLowerCase()}`,
    });
  }

  // Q: Shipping
  faqs.push({
    question: `Does ${shop.name} ship the ${title}?`,
    answer: `Yes, ${shop.name} ships the ${title}${shop.shipsToCountries?.length > 0 ? ` to ${shop.shipsToCountries.length} countries` : ""}. Check our shipping policy for delivery times and rates.`,
    keywords: `${title} shipping, ${title} delivery, buy ${title} online, ${shop.name} shipping`,
  });

  return faqs;
}

/**
 * Generate store-level FAQ entries.
 */
export function generateStoreFaqs(shop, productCount, collectionCount) {
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const name = shop.name;
  const description = shop.brand?.shortDescription || shop.description || "";

  return [
    {
      question: `What is ${name}?`,
      answer: `${name} is an online store${description ? ` — ${description}` : ""}. We offer ${productCount} products across ${collectionCount} collections. Visit us at ${domain}.`,
      keywords: `${name}, about ${name}, what is ${name}, ${name} store`,
    },
    {
      question: `What products does ${name} sell?`,
      answer: `${name} offers ${productCount} products across ${collectionCount} collections. Browse our full catalog at ${domain}/collections/all.`,
      keywords: `${name} products, ${name} catalog, shop ${name}, what does ${name} sell`,
    },
    {
      question: `Does ${name} offer shipping?`,
      answer: `Yes, ${name} offers shipping${shop.shipsToCountries?.length > 0 ? ` to ${shop.shipsToCountries.length} countries worldwide` : ""}. Check our shipping policy at ${domain}/policies/shipping-policy for details.`,
      keywords: `${name} shipping, ${name} delivery, does ${name} ship internationally`,
    },
    {
      question: `What is ${name}'s return policy?`,
      answer: `${name} has a return and refund policy. Visit ${domain}/policies/refund-policy for full details on returns, exchanges, and refunds.`,
      keywords: `${name} returns, ${name} refund, ${name} exchange policy`,
    },
    {
      question: `How do I contact ${name}?`,
      answer: shop.contactEmail
        ? `You can reach ${name} by email at ${shop.contactEmail}. Visit ${domain}/pages/contact for more contact options.`
        : `Visit ${domain}/pages/contact for ways to get in touch with ${name}.`,
      keywords: `${name} contact, ${name} email, ${name} support, reach ${name}`,
    },
    {
      question: `What payment methods does ${name} accept?`,
      answer: `${name} accepts major credit cards, debit cards, and other popular payment methods through Shopify's secure checkout. Visit ${domain} to see all available payment options at checkout.`,
      keywords: `${name} payment, ${name} credit card, ${name} payment methods, how to pay ${name}`,
    },
  ];
}

/**
 * Generate collection-level FAQ entries.
 */
export function generateCollectionFaqs(collection, shop) {
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const title = collection.title;
  const desc = collection.description?.replace(/<[^>]*>/g, "").trim() || "";
  const count = collection.productsCount?.count || "multiple";

  return [
    {
      question: `What is in the ${title} collection?`,
      answer: `The ${title} collection at ${shop.name} features ${count} curated products. ${desc ? desc.slice(0, 200) : `Browse the full collection at ${domain}/collections/${collection.handle}.`}`,
      keywords: `${title} collection, ${shop.name} ${title}, ${title} products`,
    },
    {
      question: `Where can I browse ${title} products?`,
      answer: `You can browse all ${title} products at ${domain}/collections/${collection.handle}. The collection includes ${count} items.`,
      keywords: `shop ${title}, buy ${title}, ${title} category, ${shop.name} ${title}`,
    },
  ];
}
