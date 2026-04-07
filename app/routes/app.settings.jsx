import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Banner,
  Divider,
} from "@shopify/polaris";
export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { getShopPlan, PLANS, ensureShopPlan } = await import("../lib/billing.server");
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let currentPlan = "Free";
  try {
    await ensureShopPlan(prisma, shop);
    currentPlan = await getShopPlan(prisma, shop);
  } catch (e) {
    console.error("[settings] ensureShopPlan/getShopPlan failed:", e);
  }

  // Get data counts for the shop — wrap each in catch so one failure doesn't 500 the page
  const [faqCount, keywordCount, seoAuditCount, geoCount] = await Promise.all([
    prisma.faqEntry.count({ where: { shop } }).catch((e) => {
      console.error("[settings] faqEntry.count failed:", e);
      return 0;
    }),
    prisma.keywordMapping.count({ where: { shop } }).catch((e) => {
      console.error("[settings] keywordMapping.count failed:", e);
      return 0;
    }),
    prisma.seoAudit.count({ where: { shop } }).catch(() => 0),
    prisma.geoOptimization.count({ where: { shop } }).catch(() => 0),
  ]);

  return json({
    shop,
    currentPlan,
    planDetails: PLANS[currentPlan],
    dataCounts: { faqCount, keywordCount, seoAuditCount, geoCount },
  });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export_data") {
    // Export all shop data as JSON (GDPR self-service)
    const [score, llmsTxt, faqs, structuredData, robotsTxt, keywords] = await Promise.all([
      prisma.aiReadinessScore.findUnique({ where: { shop } }),
      prisma.llmsTxt.findUnique({ where: { shop } }),
      prisma.faqEntry.findMany({ where: { shop } }),
      prisma.structuredDataConfig.findUnique({ where: { shop } }),
      prisma.robotsTxtConfig.findUnique({ where: { shop } }),
      prisma.keywordMapping.findMany({ where: { shop } }),
    ]);

    const exportData = {
      shop,
      exportedAt: new Date().toISOString(),
      aiReadinessScore: score,
      llmsTxt,
      faqEntries: faqs,
      structuredDataConfig: structuredData,
      robotsTxtConfig: robotsTxt,
      keywordMappings: keywords,
    };

    return json({ exportData });
  }

  if (intent === "delete_all_data") {
    await Promise.allSettled([
      prisma.aiReadinessScore.deleteMany({ where: { shop } }),
      prisma.llmsTxt.deleteMany({ where: { shop } }),
      prisma.faqEntry.deleteMany({ where: { shop } }),
      prisma.structuredDataConfig.deleteMany({ where: { shop } }),
      prisma.robotsTxtConfig.deleteMany({ where: { shop } }),
      prisma.keywordMapping.deleteMany({ where: { shop } }),
      prisma.seoAudit.deleteMany({ where: { shop } }),
      prisma.geoOptimization.deleteMany({ where: { shop } }),
      prisma.scoreHistory.deleteMany({ where: { shop } }),
      prisma.onboardingState.deleteMany({ where: { shop } }),
    ]);
    return json({ deleted: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function SettingsPage() {
  const { shop, currentPlan, planDetails, dataCounts } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Current Plan</Text>
                  <Badge tone={currentPlan === "Free" ? "info" : "success"}>
                    {currentPlan}
                  </Badge>
                </InlineStack>
                <Text variant="bodyMd" tone="subdued">
                  {planDetails.amount === 0
                    ? "You're on the free plan with basic features."
                    : `$${planDetails.amount}/month — Full access to ${currentPlan} features.`}
                </Text>
                <Button url="/app/billing">
                  {currentPlan === "Free" ? "Upgrade Plan" : "Manage Plan"}
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Your Data</Text>
                <Text variant="bodyMd" tone="subdued">
                  Store: <strong>{shop}</strong>
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd">FAQ entries: {dataCounts.faqCount}</Text>
                  <Text variant="bodyMd">Keyword mappings: {dataCounts.keywordCount}</Text>
                  <Text variant="bodyMd">SEO audits: {dataCounts.seoAuditCount}</Text>
                  <Text variant="bodyMd">GEO optimizations: {dataCounts.geoCount}</Text>
                </BlockStack>
                <Button
                  loading={isSubmitting}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("intent", "export_data");
                    submit(fd, { method: "POST" });
                  }}
                >
                  Export All Data (JSON)
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2" tone="critical">Danger Zone</Text>
                <Banner tone="critical">
                  <p>This will permanently delete all generated data (FAQs, keywords, SEO audits, scores, configs). This cannot be undone.</p>
                </Banner>
                <Button
                  tone="critical"
                  loading={isSubmitting}
                  onClick={() => {
                    if (confirm("Are you sure? This will delete ALL your generated data and cannot be undone.")) {
                      const fd = new FormData();
                      fd.set("intent", "delete_all_data");
                      submit(fd, { method: "POST" });
                    }
                  }}
                >
                  Delete All Data
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
