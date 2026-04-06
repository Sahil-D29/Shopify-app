/**
 * SEO Meta Tag Analyzer
 * Analyzes SEO title and description quality for products, collections, and pages.
 */

const IDEAL_TITLE_MIN = 30;
const IDEAL_TITLE_MAX = 60;
const IDEAL_DESC_MIN = 120;
const IDEAL_DESC_MAX = 160;

/**
 * Score a single SEO title (0-100).
 */
export function scoreSeoTitle(title, productTitle) {
  if (!title || title.trim().length === 0) return { score: 0, issues: ["Missing SEO title"] };

  const issues = [];
  let score = 100;
  const len = title.trim().length;

  if (len < IDEAL_TITLE_MIN) {
    score -= 30;
    issues.push(`Title too short (${len} chars, aim for ${IDEAL_TITLE_MIN}-${IDEAL_TITLE_MAX})`);
  } else if (len > IDEAL_TITLE_MAX) {
    score -= 20;
    issues.push(`Title too long (${len} chars, may be truncated in search results)`);
  }

  // Check if title is just the product title with no optimization
  if (productTitle && title.trim().toLowerCase() === productTitle.trim().toLowerCase()) {
    score -= 15;
    issues.push("Title is identical to product name — add brand or keywords");
  }

  // Check for power words
  const powerWords = ["best", "top", "buy", "shop", "premium", "official", "new", "sale", "free shipping"];
  const hasActionWord = powerWords.some((w) => title.toLowerCase().includes(w));
  if (!hasActionWord) {
    score -= 10;
    issues.push("Consider adding action or power words (e.g., 'Buy', 'Premium', 'Shop')");
  }

  return { score: Math.max(0, score), issues };
}

/**
 * Score a single SEO description (0-100).
 */
export function scoreSeoDescription(description) {
  if (!description || description.trim().length === 0) {
    return { score: 0, issues: ["Missing meta description"] };
  }

  const issues = [];
  let score = 100;
  const len = description.trim().length;

  if (len < IDEAL_DESC_MIN) {
    score -= 30;
    issues.push(`Description too short (${len} chars, aim for ${IDEAL_DESC_MIN}-${IDEAL_DESC_MAX})`);
  } else if (len > IDEAL_DESC_MAX) {
    score -= 15;
    issues.push(`Description too long (${len} chars, may be truncated)`);
  }

  // Check for call-to-action
  const ctaWords = ["shop", "buy", "order", "discover", "explore", "find", "get", "browse", "view"];
  const hasCta = ctaWords.some((w) => description.toLowerCase().includes(w));
  if (!hasCta) {
    score -= 10;
    issues.push("Add a call-to-action (e.g., 'Shop now', 'Discover more')");
  }

  // Check for unique selling proposition indicators
  if (description.toLowerCase().includes("free shipping") || description.toLowerCase().includes("guarantee")) {
    score += 5; // bonus for USP
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

/**
 * Analyze SEO for a product using Shopify GraphQL product data.
 */
export function analyzeProductSeo(product) {
  const title = product.seo?.title || "";
  const description = product.seo?.description || "";
  const productTitle = product.title || "";

  const titleResult = scoreSeoTitle(title, productTitle);
  const descResult = scoreSeoDescription(description);

  return {
    resourceId: product.id,
    resourceTitle: productTitle,
    seoTitle: title,
    seoDescription: description,
    seoTitleScore: titleResult.score,
    seoDescScore: descResult.score,
    issues: [...titleResult.issues, ...descResult.issues],
  };
}

/**
 * Fetch and analyze all products for a shop via GraphQL admin.
 * Returns array of audit results.
 */
export async function runSeoAudit(admin, maxProducts = 50) {
  const response = await admin.graphql(`
    query getProductsSeo($first: Int!) {
      products(first: $first) {
        nodes {
          id
          title
          handle
          descriptionHtml
          seo { title description }
          featuredImage { url altText }
          images(first: 10) {
            nodes { url altText }
          }
        }
      }
    }
  `, { variables: { first: maxProducts } });

  const data = await response.json();
  const products = data.data?.products?.nodes || [];

  return products.map((product) => {
    const seoResult = analyzeProductSeo(product);

    // Image alt text scoring
    const images = product.images?.nodes || [];
    const totalImages = images.length;
    const missingAlt = images.filter((img) => !img.altText || img.altText.trim().length === 0).length;
    const genericAlt = images.filter((img) => {
      const alt = (img.altText || "").toLowerCase();
      return alt === "image" || alt === "photo" || alt === "picture" || alt === "img";
    }).length;
    const imageAltScore = totalImages === 0 ? 50 : Math.round(((totalImages - missingAlt - genericAlt) / totalImages) * 100);

    const imageIssues = [];
    if (missingAlt > 0) imageIssues.push(`${missingAlt} image(s) missing alt text`);
    if (genericAlt > 0) imageIssues.push(`${genericAlt} image(s) with generic alt text`);
    if (totalImages === 0) imageIssues.push("No product images");

    // Content scoring
    const descHtml = product.descriptionHtml || "";
    const descText = descHtml.replace(/<[^>]*>/g, "").trim();
    const wordCount = descText.split(/\s+/).filter(Boolean).length;

    let contentScore = 100;
    const contentIssues = [];

    if (wordCount === 0) {
      contentScore = 0;
      contentIssues.push("No product description");
    } else if (wordCount < 20) {
      contentScore = 25;
      contentIssues.push(`Very short description (${wordCount} words, aim for 100+)`);
    } else if (wordCount < 50) {
      contentScore = 50;
      contentIssues.push(`Short description (${wordCount} words, aim for 100+)`);
    } else if (wordCount < 100) {
      contentScore = 70;
      contentIssues.push(`Description could be longer (${wordCount} words)`);
    } else if (wordCount > 500) {
      contentScore = 85;
      contentIssues.push("Long description — good for SEO but check readability");
    }

    return {
      ...seoResult,
      imageAltScore,
      contentScore,
      issues: [...seoResult.issues, ...imageIssues, ...contentIssues],
    };
  });
}
