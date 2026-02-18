/**
 * Structured Data (JSON-LD) Generator
 *
 * Generates Schema.org JSON-LD markup for products, FAQ, Organization,
 * breadcrumbs, and sitelinks so AI agents can parse store content.
 */

/**
 * Generate Product JSON-LD schema for a single product.
 */
export function generateProductSchema(product, shop) {
  const domain =
    shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const variants = product.variants?.edges?.map((e) => e.node) || [];

  const offers = variants.map((v) => ({
    "@type": "Offer",
    name: v.title !== "Default Title" ? v.title : undefined,
    price: v.price,
    priceCurrency: product.priceRangeV2?.minVariantPrice?.currencyCode || shop.currencyCode,
    availability: v.availableForSale
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    sku: v.sku || undefined,
    url: `${domain}/products/${product.handle}`,
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description?.replace(/<[^>]*>/g, "").slice(0, 5000),
    url: `${domain}/products/${product.handle}`,
    brand: product.vendor
      ? { "@type": "Brand", name: product.vendor }
      : undefined,
    category: product.productType || undefined,
    image: product.featuredImage?.url || undefined,
    offers:
      offers.length === 1
        ? offers[0]
        : { "@type": "AggregateOffer", lowPrice: product.priceRangeV2?.minVariantPrice?.amount, highPrice: product.priceRangeV2?.maxVariantPrice?.amount, priceCurrency: product.priceRangeV2?.minVariantPrice?.currencyCode, offerCount: offers.length, offers },
  };

  // Add keywords from tags
  if (product.tags?.length > 0) {
    schema.keywords = product.tags.join(", ");
  }

  return schema;
}

/**
 * Generate FAQ JSON-LD schema from FAQ entries.
 */
export function generateFaqSchema(faqEntries) {
  if (!faqEntries || faqEntries.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries
      .filter((f) => f.published)
      .map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
  };
}

/**
 * Generate Organization JSON-LD schema for the store.
 */
export function generateOrganizationSchema(shop, config = {}) {
  const domain =
    shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.customOrgName || shop.name,
    description:
      config.customOrgDescription ||
      shop.brand?.shortDescription ||
      shop.description ||
      "",
    url: domain,
    logo: config.customOrgLogo || undefined,
    contactPoint: shop.contactEmail
      ? {
          "@type": "ContactPoint",
          email: shop.contactEmail,
          contactType: "customer service",
        }
      : undefined,
    sameAs: [],
  };
}

/**
 * Generate BreadcrumbList JSON-LD schema.
 */
export function generateBreadcrumbSchema(breadcrumbs, shop) {
  const domain =
    shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${domain}${item.url}`,
    })),
  };
}

/**
 * Generate WebSite JSON-LD with SearchAction for sitelinks searchbox.
 */
export function generateSitelinksSchema(shop) {
  const domain =
    shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: shop.name,
    url: domain,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${domain}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generate all structured data for a product page.
 */
export function generateProductPageSchemas(product, shop, faqEntries = [], config = {}) {
  const schemas = [];

  if (config.enableProduct !== false) {
    schemas.push(generateProductSchema(product, shop));
  }

  if (config.enableFaq !== false && faqEntries.length > 0) {
    const faqSchema = generateFaqSchema(faqEntries);
    if (faqSchema) schemas.push(faqSchema);
  }

  if (config.enableBreadcrumb !== false) {
    schemas.push(
      generateBreadcrumbSchema(
        [
          { name: "Home", url: "/" },
          { name: product.productType || "Products", url: "/collections/all" },
          { name: product.title, url: `/products/${product.handle}` },
        ],
        shop
      )
    );
  }

  return schemas;
}

/**
 * Generate all structured data for the store homepage.
 */
export function generateHomepageSchemas(shop, config = {}) {
  const schemas = [];

  if (config.enableOrganization !== false) {
    schemas.push(generateOrganizationSchema(shop, config));
  }

  if (config.enableSitelinks !== false) {
    schemas.push(generateSitelinksSchema(shop));
  }

  return schemas;
}
