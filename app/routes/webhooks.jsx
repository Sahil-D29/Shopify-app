import { logger } from "../lib/logger.server";

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  logger.info("Webhook received", { topic, shop });

  switch (topic) {
    case "APP_UNINSTALLED":
      logger.info("App uninstalled, cleaning up shop data", { shop });
      try {
        // Delete all shop data from every model
        await Promise.allSettled([
          prisma.session.deleteMany({ where: { shop } }),
          prisma.aiReadinessScore.deleteMany({ where: { shop } }),
          prisma.llmsTxt.deleteMany({ where: { shop } }),
          prisma.faqEntry.deleteMany({ where: { shop } }),
          prisma.structuredDataConfig.deleteMany({ where: { shop } }),
          prisma.robotsTxtConfig.deleteMany({ where: { shop } }),
          prisma.keywordMapping.deleteMany({ where: { shop } }),
          prisma.shopPlan.deleteMany({ where: { shop } }),
          prisma.onboardingState.deleteMany({ where: { shop } }),
          prisma.seoAudit.deleteMany({ where: { shop } }),
          prisma.geoOptimization.deleteMany({ where: { shop } }),
          prisma.scoreHistory.deleteMany({ where: { shop } }),
        ]);
        logger.info("Shop data cleanup complete", { shop });
      } catch (error) {
        logger.error("Error cleaning up shop data", { shop, error: error.message });
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // This app does not store customer PII.
      // Log the request and respond with acknowledgment.
      logger.info("Customer data request received - no customer PII stored", { shop });
      break;

    case "CUSTOMERS_REDACT":
      // This app does not store customer PII.
      // Log and acknowledge.
      logger.info("Customer redact request received - no customer PII stored", { shop });
      break;

    case "SHOP_REDACT":
      // Final cleanup 48 hours after uninstall - delete all remaining shop data.
      logger.info("Shop redact request - final cleanup", { shop });
      try {
        await Promise.allSettled([
          prisma.aiReadinessScore.deleteMany({ where: { shop } }),
          prisma.llmsTxt.deleteMany({ where: { shop } }),
          prisma.faqEntry.deleteMany({ where: { shop } }),
          prisma.structuredDataConfig.deleteMany({ where: { shop } }),
          prisma.robotsTxtConfig.deleteMany({ where: { shop } }),
          prisma.keywordMapping.deleteMany({ where: { shop } }),
          prisma.shopPlan.deleteMany({ where: { shop } }),
          prisma.onboardingState.deleteMany({ where: { shop } }),
          prisma.seoAudit.deleteMany({ where: { shop } }),
          prisma.geoOptimization.deleteMany({ where: { shop } }),
          prisma.scoreHistory.deleteMany({ where: { shop } }),
        ]);
        logger.info("Shop redact cleanup complete", { shop });
      } catch (error) {
        logger.error("Error during shop redact", { shop, error: error.message });
      }
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
