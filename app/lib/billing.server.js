/**
 * Billing helpers for plan gating and subscription management.
 * Uses Shopify's built-in billing API via shopify-app-remix.
 */
import { redirect } from "@remix-run/node";

export const PLANS = {
  Free: {
    name: "Free",
    amount: 0,
    features: {
      maxFaqs: 10,
      maxKeywordProducts: 5,
      maxSeoAuditProducts: 5,
      structuredDataTypes: ["product", "organization"],
      seoMetaOptimizer: false,
      seoImageAudit: false,
      geoOptimizer: false,
      contentAnalysis: false,
      mcpServer: false,
    },
  },
  Pro: {
    name: "Pro",
    amount: 79,
    features: {
      maxFaqs: -1, // unlimited
      maxKeywordProducts: -1,
      maxSeoAuditProducts: -1,
      structuredDataTypes: ["product", "organization", "faq", "breadcrumb", "reviews", "sitelinks"],
      seoMetaOptimizer: true,
      seoImageAudit: true,
      geoOptimizer: false,
      contentAnalysis: true,
      mcpServer: false,
    },
  },
  Enterprise: {
    name: "Enterprise",
    amount: 149,
    features: {
      maxFaqs: -1,
      maxKeywordProducts: -1,
      maxSeoAuditProducts: -1,
      structuredDataTypes: ["product", "organization", "faq", "breadcrumb", "reviews", "sitelinks"],
      seoMetaOptimizer: true,
      seoImageAudit: true,
      geoOptimizer: true,
      contentAnalysis: true,
      mcpServer: true,
    },
  },
};

/**
 * Get the current plan for a shop from the database.
 */
export async function getShopPlan(prisma, shop) {
  const record = await prisma.shopPlan.findUnique({ where: { shop } });
  return record?.plan || "Free";
}

/**
 * Get feature access for a shop based on their plan.
 */
export async function getFeatureAccess(prisma, shop) {
  const planName = await getShopPlan(prisma, shop);
  return {
    plan: planName,
    ...PLANS[planName].features,
  };
}

/**
 * Check if a shop has at minimum the required plan.
 * Returns the plan name if sufficient, or null if not.
 */
export function meetsMinimumPlan(currentPlan, requiredPlan) {
  const planOrder = ["Free", "Pro", "Enterprise"];
  const currentIndex = planOrder.indexOf(currentPlan);
  const requiredIndex = planOrder.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}

/**
 * Middleware: require a minimum plan level in a route loader/action.
 * Redirects to billing page if plan is insufficient.
 */
export async function requirePlan(prisma, shop, minimumPlan) {
  const currentPlan = await getShopPlan(prisma, shop);
  if (!meetsMinimumPlan(currentPlan, minimumPlan)) {
    throw redirect(`/app/billing?required=${minimumPlan}`);
  }
  return currentPlan;
}

/**
 * Ensure the ShopPlan record exists (create with Free if missing).
 */
export async function ensureShopPlan(prisma, shop) {
  return prisma.shopPlan.upsert({
    where: { shop },
    create: { shop, plan: "Free" },
    update: {},
  });
}
