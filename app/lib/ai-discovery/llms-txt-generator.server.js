/**
 * llms.txt and llms-full.txt Generator
 *
 * Generates standardized Markdown files that help LLMs and AI shopping agents
 * (ChatGPT, Perplexity, Google AI) understand and index your store.
 *
 * Spec: https://llmstxt.org/
 */

/**
 * Fetch all store data needed for llms.txt generation.
 */
export async function fetchStoreData(admin) {
  const [shopRes, productsRes, collectionsRes, pagesRes] = await Promise.all([
    admin.graphql(`{
      shop {
        name
        description
        myshopifyDomain
        primaryDomain { url host }
        brand {
          shortDescription
          slogan
        }
        shipsToCountries
        currencyCode
        contactEmail
      }
    }`),
    admin.graphql(`{
      products(first: 250, query: "status:active") {
        edges {
          node {
            id
            title
            description
            productType
            vendor
            tags
            handle
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            featuredImage { url altText }
            totalInventory
            variants(first: 5) {
              edges {
                node {
                  title
                  price
                  sku
                  availableForSale
                }
              }
            }
          }
        }
      }
    }`),
    admin.graphql(`{
      collections(first: 50) {
        edges {
          node {
            id
            title
            description
            handle
            productsCount { count }
          }
        }
      }
    }`),
    admin.graphql(`{
      pages(first: 20) {
        edges {
          node {
            id
            title
            handle
            bodySummary
          }
        }
      }
    }`),
  ]);

  const [shopData, productsData, collectionsData, pagesData] =
    await Promise.all([
      shopRes.json(),
      productsRes.json(),
      collectionsRes.json(),
      pagesRes.json(),
    ]);

  return {
    shop: shopData.data.shop,
    products: productsData.data.products.edges.map((e) => e.node),
    collections: collectionsData.data.collections.edges.map((e) => e.node),
    pages: pagesData.data.pages.edges.map((e) => e.node),
  };
}

/**
 * Generate the llms.txt index file (concise, with links).
 */
export function generateLlmsTxt(storeData) {
  const { shop, products, collections, pages } = storeData;
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const description =
    shop.brand?.shortDescription || shop.description || "";

  let content = `# ${shop.name}\n\n`;

  // Summary blockquote (40-80 words recommended)
  const summaryParts = [shop.name];
  if (description) summaryParts.push(description);
  summaryParts.push(
    `We offer ${products.length} products across ${collections.length} collections.`
  );
  if (shop.shipsToCountries?.length > 0) {
    summaryParts.push(
      `Shipping to ${shop.shipsToCountries.length} countries.`
    );
  }
  summaryParts.push(`Currency: ${shop.currencyCode}.`);
  if (shop.contactEmail) {
    summaryParts.push(`Contact: ${shop.contactEmail}`);
  }
  content += `> ${summaryParts.join(" ")}\n\n`;

  // Collections
  if (collections.length > 0) {
    content += `## Collections\n\n`;
    for (const col of collections) {
      const desc = col.description
        ? `: ${col.description.slice(0, 120)}`
        : "";
      content += `- [${col.title}](${domain}/collections/${col.handle})${desc}\n`;
    }
    content += `\n`;
  }

  // Top products (up to 50 in index)
  if (products.length > 0) {
    content += `## Products\n\n`;
    const listed = products.slice(0, 50);
    for (const p of listed) {
      const price = p.priceRangeV2?.minVariantPrice;
      const priceStr = price ? ` — ${price.currencyCode} ${price.amount}` : "";
      content += `- [${p.title}](${domain}/products/${p.handle})${priceStr}\n`;
    }
    if (products.length > 50) {
      content += `- ... and ${products.length - 50} more products\n`;
    }
    content += `\n`;
  }

  // Pages
  if (pages.length > 0) {
    content += `## Pages\n\n`;
    for (const page of pages) {
      const summary = page.bodySummary
        ? `: ${page.bodySummary.slice(0, 100)}`
        : "";
      content += `- [${page.title}](${domain}/pages/${page.handle})${summary}\n`;
    }
    content += `\n`;
  }

  // Policies
  content += `## Policies\n\n`;
  content += `- [Shipping Policy](${domain}/policies/shipping-policy)\n`;
  content += `- [Refund Policy](${domain}/policies/refund-policy)\n`;
  content += `- [Privacy Policy](${domain}/policies/privacy-policy)\n`;
  content += `- [Terms of Service](${domain}/policies/terms-of-service)\n`;

  return content;
}

/**
 * Generate the llms-full.txt complete file (all details in one document).
 */
export function generateLlmsFullTxt(storeData) {
  const { shop, products, collections, pages } = storeData;
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const description =
    shop.brand?.shortDescription || shop.description || "";
  const slogan = shop.brand?.slogan || "";

  let content = `# ${shop.name}\n\n`;

  // Full summary
  content += `> ${description || shop.name} — ${slogan || "Your trusted online store."}\n\n`;

  content += `## About ${shop.name}\n\n`;
  content += `${shop.name} is an online store at ${domain}. `;
  if (description) content += `${description} `;
  content += `We carry ${products.length} products organized in ${collections.length} collections. `;
  content += `All prices are in ${shop.currencyCode}. `;
  if (shop.contactEmail) {
    content += `For inquiries, contact us at ${shop.contactEmail}.\n\n`;
  } else {
    content += `\n\n`;
  }

  // Full collections with descriptions
  if (collections.length > 0) {
    content += `## Collections\n\n`;
    for (const col of collections) {
      content += `### ${col.title}\n\n`;
      if (col.description) content += `${col.description}\n\n`;
      content += `Browse: ${domain}/collections/${col.handle}\n`;
      content += `Products in collection: ${col.productsCount?.count || "N/A"}\n\n`;
    }
  }

  // Full product details
  if (products.length > 0) {
    content += `## Products\n\n`;
    for (const p of products) {
      content += `### ${p.title}\n\n`;
      if (p.description) {
        // Strip HTML tags for clean markdown
        const cleanDesc = p.description.replace(/<[^>]*>/g, "").trim();
        content += `${cleanDesc}\n\n`;
      }
      content += `- **URL:** ${domain}/products/${p.handle}\n`;
      if (p.vendor) content += `- **Brand:** ${p.vendor}\n`;
      if (p.productType) content += `- **Category:** ${p.productType}\n`;

      const minPrice = p.priceRangeV2?.minVariantPrice;
      const maxPrice = p.priceRangeV2?.maxVariantPrice;
      if (minPrice) {
        if (
          maxPrice &&
          parseFloat(maxPrice.amount) > parseFloat(minPrice.amount)
        ) {
          content += `- **Price:** ${minPrice.currencyCode} ${minPrice.amount} – ${maxPrice.amount}\n`;
        } else {
          content += `- **Price:** ${minPrice.currencyCode} ${minPrice.amount}\n`;
        }
      }

      if (p.tags?.length > 0) {
        content += `- **Tags:** ${p.tags.join(", ")}\n`;
      }

      const inStock = p.totalInventory > 0;
      content += `- **Availability:** ${inStock ? "In Stock" : "Out of Stock"}\n`;

      // Variants
      const variants = p.variants?.edges?.map((e) => e.node) || [];
      if (variants.length > 1) {
        content += `- **Options:** `;
        content += variants
          .filter((v) => v.availableForSale)
          .map((v) => `${v.title} (${minPrice?.currencyCode || ""} ${v.price})`)
          .join(", ");
        content += `\n`;
      }

      content += `\n`;
    }
  }

  // Pages content
  if (pages.length > 0) {
    content += `## Store Pages\n\n`;
    for (const page of pages) {
      content += `### ${page.title}\n\n`;
      if (page.bodySummary) content += `${page.bodySummary}\n\n`;
      content += `Read more: ${domain}/pages/${page.handle}\n\n`;
    }
  }

  return content;
}
