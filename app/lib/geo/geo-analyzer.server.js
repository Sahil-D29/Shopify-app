/**
 * GEO (Generative Engine Optimization) Analyzer
 * Scores how well products are optimized for AI-generated search results.
 */

/**
 * Analyze GEO readiness for a single product.
 * Returns score breakdown and issues.
 */
export function analyzeProductGeo(product, shopData = {}) {
  const issues = [];
  const scores = {
    citability: 0,
    authority: 0,
    surfaceCoverage: 0,
    freshness: 0,
    queryAlignment: 0,
  };

  const descHtml = product.descriptionHtml || "";
  const descText = descHtml.replace(/<[^>]*>/g, "").trim();
  const wordCount = descText.split(/\s+/).filter(Boolean).length;

  // 1. CITABILITY (30 pts) - Can AI easily extract and cite this content?
  if (wordCount >= 50) {
    scores.citability += 10;
  } else if (wordCount >= 20) {
    scores.citability += 5;
    issues.push("Description too short for AI citation (aim for 50+ words)");
  } else {
    issues.push("Very short/missing description — AI cannot cite this product");
  }

  // Does it contain specifics (numbers, measurements, percentages)?
  const hasNumbers = /\d+/.test(descText);
  const hasSpecifics = /\b(\d+\s*(oz|ml|g|kg|lb|cm|mm|in|ft|%|pack|count|piece))\b/i.test(descText);
  if (hasSpecifics) {
    scores.citability += 12;
  } else if (hasNumbers) {
    scores.citability += 7;
    issues.push("Add specific measurements or quantities for better AI citations");
  } else {
    scores.citability += 2;
    issues.push("No specific numbers/measurements — AI prefers factual, cite-ready content");
  }

  // Has a clear introductory sentence?
  const sentences = descText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length >= 2) {
    scores.citability += 8;
  } else if (sentences.length === 1) {
    scores.citability += 4;
    issues.push("Add more sentences to description for better AI extraction");
  }

  // 2. AUTHORITY (20 pts) - Trust signals
  const title = (product.title || "").toLowerCase();
  const vendor = product.vendor || "";

  // Has a brand/vendor?
  if (vendor && vendor.trim().length > 0) {
    scores.authority += 8;
  } else {
    scores.authority += 2;
    issues.push("Add a brand/vendor — AI weighs brand authority");
  }

  // Has product type classification?
  if (product.productType && product.productType.trim().length > 0) {
    scores.authority += 6;
  } else {
    scores.authority += 1;
    issues.push("Set a product type for better AI categorization");
  }

  // Has tags/categories?
  const tags = product.tags || [];
  if (tags.length >= 3) {
    scores.authority += 6;
  } else if (tags.length > 0) {
    scores.authority += 3;
    issues.push("Add more tags (3+) to improve AI classification");
  } else {
    issues.push("No tags — add tags for better AI discovery");
  }

  // 3. SURFACE COVERAGE (20 pts) - Appears in multiple AI-accessible formats
  // Check if product has images
  const imageCount = product.images?.nodes?.length || 0;
  if (imageCount >= 3) {
    scores.surfaceCoverage += 7;
  } else if (imageCount > 0) {
    scores.surfaceCoverage += 4;
    issues.push("Add more product images (3+) for better visibility");
  } else {
    issues.push("No product images");
  }

  // Has SEO title & description set?
  if (product.seo?.title) scores.surfaceCoverage += 4;
  else issues.push("Set SEO title for AI search surfaces");

  if (product.seo?.description) scores.surfaceCoverage += 4;
  else issues.push("Set meta description for AI search surfaces");

  // Has featured image with alt text?
  if (product.featuredImage?.altText) {
    scores.surfaceCoverage += 5;
  } else if (product.featuredImage) {
    scores.surfaceCoverage += 2;
    issues.push("Add alt text to featured image");
  }

  // 4. FRESHNESS (15 pts)
  const updatedAt = product.updatedAt ? new Date(product.updatedAt) : null;
  if (updatedAt) {
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) {
      scores.freshness = 15;
    } else if (daysSinceUpdate < 60) {
      scores.freshness = 10;
    } else if (daysSinceUpdate < 90) {
      scores.freshness = 5;
      issues.push("Product not updated in 60+ days — fresher content ranks better");
    } else {
      scores.freshness = 2;
      issues.push("Product not updated in 90+ days — update for better AI visibility");
    }
  }

  // 5. QUERY ALIGNMENT (15 pts) - Common questions can be answered from content
  const commonQueries = [
    { q: "what is", check: wordCount >= 20 },
    { q: "price", check: !!product.priceRangeV2?.minVariantPrice },
    { q: "available", check: product.status === "ACTIVE" },
    { q: "features", check: wordCount >= 50 },
    { q: "review/rating", check: false }, // Would need reviews data
  ];

  const answerable = commonQueries.filter((cq) => cq.check).length;
  scores.queryAlignment = Math.round((answerable / commonQueries.length) * 15);
  if (answerable < 3) {
    issues.push("Content doesn't answer common AI shopping queries (price, features, availability)");
  }

  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

  return {
    resourceId: product.id,
    resourceTitle: product.title,
    geoReadiness: totalScore,
    authorityScore: scores.authority,
    scores,
    issues,
  };
}

/**
 * Run GEO analysis for all products via GraphQL.
 */
export async function runGeoAudit(admin, maxProducts = 50) {
  const response = await admin.graphql(`
    query getProductsGeo($first: Int!) {
      products(first: $first) {
        nodes {
          id
          title
          handle
          vendor
          productType
          tags
          status
          descriptionHtml
          updatedAt
          seo { title description }
          featuredImage { url altText }
          images(first: 10) { nodes { url altText } }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
        }
      }
    }
  `, { variables: { first: maxProducts } });

  const data = await response.json();
  const products = data.data?.products?.nodes || [];

  return products.map((product) => analyzeProductGeo(product));
}
