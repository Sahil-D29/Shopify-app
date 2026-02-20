/**
 * robots.txt Optimizer for AI Crawlers
 *
 * Generates optimized robots.txt rules that allow AI shopping agents
 * (GPTBot, ClaudeBot, PerplexityBot, etc.) to crawl product pages
 * while blocking sensitive areas.
 */

// Import shared AI crawler definitions
import { AI_CRAWLERS } from "./ai-crawlers.js";

// Re-export for backward compatibility
export { AI_CRAWLERS };

// Paths that should always be blocked (security/privacy)
const ALWAYS_BLOCKED = [
  "/admin",
  "/cart",
  "/checkout",
  "/account",
  "/*.json$",
  "/orders",
  "/customer_identity",
];

// Paths that should always be allowed (for discoverability)
const ALWAYS_ALLOWED = [
  "/products/*",
  "/collections/*",
  "/pages/*",
  "/blogs/*",
  "/policies/*",
  "/llms.txt",
  "/llms-full.txt",
  "/sitemap.xml",
];

/**
 * Generate optimized robots.txt content.
 */
export function generateRobotsTxt(config = {}) {
  let content = `# AI Discovery Optimizer — Robots.txt\n`;
  content += `# Optimized for AI shopping agent crawlability\n`;
  content += `# Generated: ${new Date().toISOString()}\n\n`;

  // Default rules for all bots
  content += `User-agent: *\n`;
  for (const path of ALWAYS_ALLOWED) {
    content += `Allow: ${path}\n`;
  }
  for (const path of ALWAYS_BLOCKED) {
    content += `Disallow: ${path}\n`;
  }
  content += `\n`;

  // Per-AI-crawler rules
  for (const crawler of AI_CRAWLERS) {
    const allowed = config[crawler.key] !== false; // default to allowed

    content += `# ${crawler.description}\n`;
    content += `User-agent: ${crawler.userAgent}\n`;

    if (allowed) {
      for (const path of ALWAYS_ALLOWED) {
        content += `Allow: ${path}\n`;
      }
      for (const path of ALWAYS_BLOCKED) {
        content += `Disallow: ${path}\n`;
      }
    } else {
      content += `Disallow: /\n`;
    }
    content += `\n`;
  }

  // ChatGPT-User (distinct from GPTBot for conversational use)
  content += `# OpenAI ChatGPT conversational user agent\n`;
  content += `User-agent: ChatGPT-User\n`;
  if (config.allowGPTBot !== false) {
    for (const path of ALWAYS_ALLOWED) {
      content += `Allow: ${path}\n`;
    }
    for (const path of ALWAYS_BLOCKED) {
      content += `Disallow: ${path}\n`;
    }
  } else {
    content += `Disallow: /\n`;
  }
  content += `\n`;

  // Custom rules
  if (config.customRules) {
    content += `# Custom rules\n`;
    content += `${config.customRules}\n\n`;
  }

  // Sitemaps
  content += `# Sitemaps\n`;
  content += `Sitemap: {DOMAIN}/sitemap.xml\n`;

  return content;
}

/**
 * Analyze existing robots.txt for AI crawler issues.
 */
export function analyzeRobotsTxt(robotsTxtContent) {
  const issues = [];
  const recommendations = [];

  if (!robotsTxtContent || robotsTxtContent.trim() === "") {
    issues.push("No robots.txt found — AI crawlers have no guidance");
    recommendations.push("Generate an optimized robots.txt with AI crawler rules");
    return { score: 0, issues, recommendations };
  }

  const content = robotsTxtContent.toLowerCase();

  // Check if all AI crawlers are explicitly allowed
  let allowedCount = 0;
  for (const crawler of AI_CRAWLERS) {
    const ua = crawler.userAgent.toLowerCase();
    if (content.includes(ua)) {
      // Check if disallowed
      const regex = new RegExp(
        `user-agent:\\s*${ua}[\\s\\S]*?disallow:\\s*/\\s*$`,
        "im"
      );
      if (regex.test(robotsTxtContent)) {
        issues.push(`${crawler.userAgent} is blocked — ${crawler.description} cannot crawl your store`);
        recommendations.push(`Allow ${crawler.userAgent} to crawl product and collection pages`);
      } else {
        allowedCount++;
      }
    } else {
      recommendations.push(
        `Add explicit rules for ${crawler.userAgent} (${crawler.description})`
      );
    }
  }

  // Check for overly broad blocks
  if (content.includes("user-agent: *") && content.includes("disallow: /")) {
    const hasAllows = content.includes("allow:");
    if (!hasAllows) {
      issues.push("Blanket 'Disallow: /' blocks all crawlers including AI agents");
      recommendations.push("Add Allow rules for product and collection pages");
    }
  }

  // Check for llms.txt reference
  if (!content.includes("llms.txt")) {
    recommendations.push("Add 'Allow: /llms.txt' and 'Allow: /llms-full.txt' rules");
  }

  const maxScore = AI_CRAWLERS.length;
  const score = Math.round(
    ((allowedCount / maxScore) * 70 +
      (issues.length === 0 ? 30 : 0)) *
      (100 / 100)
  );

  return { score: Math.min(score, 100), issues, recommendations };
}
