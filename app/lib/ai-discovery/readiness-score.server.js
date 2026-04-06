/**
 * AI Readiness Score Calculator
 *
 * Analyzes a Shopify store and produces a 0-100 score indicating
 * how well optimized it is for AI shopping agent discovery.
 *
 * Score breakdown:
 *  - llms.txt           (20 pts)
 *  - Structured Data    (20 pts)
 *  - robots.txt         (15 pts)
 *  - FAQ Coverage       (15 pts)
 *  - Content Quality    (15 pts)
 *  - Metadata Quality   (15 pts)
 */

import { analyzeRobotsTxt } from "./robots-txt-generator.server.js";
import { getGrade } from "./readiness-utils.js";

/**
 * Calculate the full AI readiness score for a store.
 */
export async function calculateReadinessScore(admin, existingData = {}) {
  const results = {
    overallScore: 0,
    llmsTxtScore: 0,
    structuredDataScore: 0,
    robotsTxtScore: 0,
    faqScore: 0,
    contentScore: 0,
    metadataScore: 0,
    issues: [],
    recommendations: [],
  };

  // Fetch store data for analysis
  const shopRes = await admin.graphql(`{
    shop {
      name
      description
      myshopifyDomain
      primaryDomain { url host }
      contactEmail
    }
  }`);
  const { data: shopData } = await shopRes.json();
  const shop = shopData.shop;

  const productsRes = await admin.graphql(`{
    products(first: 50, query: "status:active") {
      edges {
        node {
          id
          title
          description
          descriptionHtml
          productType
          vendor
          tags
          handle
          seo { title description }
          featuredImage { url altText }
          totalInventory
          variants(first: 5) {
            edges {
              node { title price availableForSale }
            }
          }
        }
      }
    }
  }`);
  const { data: productsData } = await productsRes.json();
  const products = productsData.products.edges.map((e) => e.node);

  // === 1. llms.txt Score (20 pts) ===
  if (existingData.hasLlmsTxt) {
    results.llmsTxtScore = 15;
    if (existingData.hasLlmsFullTxt) {
      results.llmsTxtScore = 20;
    } else {
      results.recommendations.push("Generate llms-full.txt for comprehensive AI agent indexing");
    }
  } else {
    results.llmsTxtScore = 0;
    results.issues.push("No llms.txt file — AI agents cannot easily index your store");
    results.recommendations.push("Generate llms.txt and llms-full.txt files immediately — this is the #1 quick win");
  }

  // === 2. Structured Data Score (20 pts) ===
  let sdScore = 0;
  if (existingData.hasStructuredData) {
    sdScore += 10;
  } else {
    results.issues.push("No enhanced structured data — AI agents rely on JSON-LD to understand products");
    results.recommendations.push("Enable Product, FAQ, and Organization JSON-LD schemas");
  }
  if (existingData.hasFaqSchema) sdScore += 5;
  if (existingData.hasOrgSchema) sdScore += 5;
  results.structuredDataScore = sdScore;

  // === 3. robots.txt Score (15 pts) ===
  if (existingData.robotsTxtContent) {
    const robotsAnalysis = analyzeRobotsTxt(existingData.robotsTxtContent);
    results.robotsTxtScore = Math.round((robotsAnalysis.score / 100) * 15);
    results.issues.push(...robotsAnalysis.issues);
    results.recommendations.push(...robotsAnalysis.recommendations);
  } else if (existingData.hasRobotsConfig) {
    results.robotsTxtScore = 10;
  } else {
    results.robotsTxtScore = 3; // Shopify default robots.txt gives some baseline
    results.recommendations.push("Configure robots.txt to explicitly allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot)");
  }

  // === 4. FAQ Coverage Score (15 pts) ===
  const faqCount = existingData.faqCount || 0;
  if (faqCount >= products.length * 3) {
    results.faqScore = 15; // Good coverage — ~3+ FAQs per product
  } else if (faqCount >= products.length) {
    results.faqScore = 10;
    results.recommendations.push("Add more FAQ entries per product — aim for 3+ per product");
  } else if (faqCount > 0) {
    results.faqScore = 5;
    results.recommendations.push("FAQ coverage is low — generate FAQs for all products");
  } else {
    results.faqScore = 0;
    results.issues.push("No FAQ content — AI agents prioritize stores with Q&A content");
    results.recommendations.push("Generate conversational FAQs for all products");
  }

  // === 5. Content Quality Score (15 pts) ===
  let contentScore = 0;
  let thinDescriptions = 0;
  let missingImages = 0;
  let missingSeo = 0;

  for (const p of products) {
    const desc = p.description?.replace(/<[^>]*>/g, "").trim() || "";
    if (desc.length < 50) thinDescriptions++;
    if (!p.featuredImage?.url) missingImages++;
    if (!p.seo?.title && !p.seo?.description) missingSeo++;
  }

  if (products.length > 0) {
    const descRatio = 1 - thinDescriptions / products.length;
    const imageRatio = 1 - missingImages / products.length;
    contentScore = Math.round((descRatio * 8 + imageRatio * 7));

    if (thinDescriptions > 0) {
      results.issues.push(`${thinDescriptions} product(s) have thin descriptions (<50 chars) — AI agents skip products they can't understand`);
      results.recommendations.push(`Improve descriptions for ${thinDescriptions} product(s) — aim for 100+ words with natural language`);
    }
    if (missingImages > 0) {
      results.recommendations.push(`Add images to ${missingImages} product(s) — AI agents need visuals to recommend products`);
    }
  }
  results.contentScore = Math.min(contentScore, 15);

  // === 6. Metadata Quality Score (15 pts) ===
  let metaScore = 0;

  // Store-level metadata
  if (shop.description) metaScore += 3;
  else results.recommendations.push("Add a store description in Shopify admin");

  // brand field not available in all API versions — give 2 pts if description exists
  if (shop.description && shop.description.length > 30) metaScore += 2;

  if (shop.contactEmail) metaScore += 1;

  // Product-level metadata
  if (products.length > 0) {
    const withTypes = products.filter((p) => p.productType).length;
    const withVendor = products.filter((p) => p.vendor).length;
    const withTags = products.filter((p) => p.tags?.length > 0).length;
    const withSeo = products.filter(
      (p) => p.seo?.title || p.seo?.description
    ).length;

    metaScore += Math.round((withTypes / products.length) * 2);
    metaScore += Math.round((withVendor / products.length) * 2);
    metaScore += Math.round((withTags / products.length) * 2);
    metaScore += Math.round((withSeo / products.length) * 3);

    if (withTypes < products.length)
      results.recommendations.push(`Add product types to ${products.length - withTypes} product(s) — AI agents use this for categorization`);
    if (withTags < products.length)
      results.recommendations.push(`Add tags to ${products.length - withTags} product(s) — tags become keywords for AI discovery`);
    if (missingSeo > 0)
      results.recommendations.push(`Add SEO titles/descriptions to ${missingSeo} product(s)`);
  }
  results.metadataScore = Math.min(metaScore, 15);

  // === Overall Score ===
  results.overallScore =
    results.llmsTxtScore +
    results.structuredDataScore +
    results.robotsTxtScore +
    results.faqScore +
    results.contentScore +
    results.metadataScore;

  return results;
}

// Re-export getGrade from shared utils for backward compatibility
export { getGrade } from "./readiness-utils.js";
