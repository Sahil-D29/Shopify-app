import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  ProgressBar,
  Button,
  List,
  Divider,
  Box,
  Badge,
  InlineGrid,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  calculateReadinessScore,
  getGrade,
} from "../lib/ai-discovery/readiness-score.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Load existing score or return null
  const score = await prisma.aiReadinessScore.findUnique({ where: { shop } });
  const llmsTxt = await prisma.llmsTxt.findUnique({ where: { shop } });
  const sdConfig = await prisma.structuredDataConfig.findUnique({
    where: { shop },
  });
  const robotsConfig = await prisma.robotsTxtConfig.findUnique({
    where: { shop },
  });
  const faqCount = await prisma.faqEntry.count({ where: { shop } });

  // Fetch basic shop info
  const shopRes = await admin.graphql(`{
    shop {
      name
      myshopifyDomain
      primaryDomain { url }
    }
    products(first: 1, query: "status:active") {
      edges { node { id } }
    }
  }`);
  const { data } = await shopRes.json();

  return json({
    shopName: data.shop.name,
    domain: data.shop.primaryDomain?.url || `https://${data.shop.myshopifyDomain}`,
    score,
    hasLlmsTxt: !!llmsTxt,
    hasStructuredData: !!sdConfig,
    hasRobotsConfig: !!robotsConfig,
    faqCount,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Run full scan
  const llmsTxt = await prisma.llmsTxt.findUnique({ where: { shop } });
  const sdConfig = await prisma.structuredDataConfig.findUnique({
    where: { shop },
  });
  const robotsConfig = await prisma.robotsTxtConfig.findUnique({
    where: { shop },
  });
  const faqCount = await prisma.faqEntry.count({ where: { shop } });

  const results = await calculateReadinessScore(admin, {
    hasLlmsTxt: !!llmsTxt?.content,
    hasLlmsFullTxt: !!llmsTxt?.fullContent,
    hasStructuredData: !!sdConfig,
    hasFaqSchema: sdConfig?.enableFaq ?? false,
    hasOrgSchema: sdConfig?.enableOrganization ?? false,
    hasRobotsConfig: !!robotsConfig,
    robotsTxtContent: null,
    faqCount,
  });

  // Upsert score
  await prisma.aiReadinessScore.upsert({
    where: { shop },
    create: {
      shop,
      overallScore: results.overallScore,
      llmsTxtScore: results.llmsTxtScore,
      structuredDataScore: results.structuredDataScore,
      robotsTxtScore: results.robotsTxtScore,
      faqScore: results.faqScore,
      contentScore: results.contentScore,
      metadataScore: results.metadataScore,
      lastScanAt: new Date(),
    },
    update: {
      overallScore: results.overallScore,
      llmsTxtScore: results.llmsTxtScore,
      structuredDataScore: results.structuredDataScore,
      robotsTxtScore: results.robotsTxtScore,
      faqScore: results.faqScore,
      contentScore: results.contentScore,
      metadataScore: results.metadataScore,
      lastScanAt: new Date(),
    },
  });

  return json({ score: results });
};

export default function Dashboard() {
  const {
    shopName,
    domain,
    score,
    hasLlmsTxt,
    hasStructuredData,
    hasRobotsConfig,
    faqCount,
  } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  const gradeInfo = score ? getGrade(score.overallScore) : null;

  const categories = score
    ? [
        { label: "llms.txt", score: score.llmsTxtScore, max: 20, link: "/app/llms-txt" },
        { label: "Structured Data", score: score.structuredDataScore, max: 20, link: "/app/structured-data" },
        { label: "robots.txt", score: score.robotsTxtScore, max: 15, link: "/app/robots-txt" },
        { label: "FAQ Coverage", score: score.faqScore, max: 15, link: "/app/faqs" },
        { label: "Content Quality", score: score.contentScore, max: 15, link: "/app/keywords" },
        { label: "Metadata Quality", score: score.metadataScore, max: 15, link: "/app/keywords" },
      ]
    : [];

  return (
    <Page title="AI Discovery Optimizer">
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Make <strong>{shopName}</strong> visible to AI shopping agents like
            ChatGPT, Perplexity, and Google AI. AI-referred traffic to retail
            sites grew 4,700% YoY.
          </p>
        </Banner>

        <Layout>
          {/* Score Card */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    AI Readiness Score
                  </Text>
                  <Button
                    variant="primary"
                    onClick={() => submit({}, { method: "POST" })}
                    loading={isScanning}
                  >
                    {score ? "Re-scan" : "Scan My Store"}
                  </Button>
                </InlineStack>

                {score ? (
                  <BlockStack gap="400">
                    <InlineStack gap="400" blockAlign="center">
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: "50%",
                          background:
                            gradeInfo.tone === "success"
                              ? "#22c55e"
                              : gradeInfo.tone === "info"
                                ? "#3b82f6"
                                : gradeInfo.tone === "warning"
                                  ? "#f59e0b"
                                  : "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 28,
                          fontWeight: "bold",
                        }}
                      >
                        {score.overallScore}
                      </div>
                      <BlockStack gap="100">
                        <Text variant="headingMd">
                          Grade: {gradeInfo.grade} — {gradeInfo.label}
                        </Text>
                        <Text tone="subdued">
                          Last scanned:{" "}
                          {new Date(score.lastScanAt).toLocaleString()}
                        </Text>
                      </BlockStack>
                    </InlineStack>

                    <ProgressBar
                      progress={score.overallScore}
                      tone={gradeInfo.tone}
                      size="small"
                    />

                    <Divider />

                    <Text as="h3" variant="headingSm">
                      Score Breakdown
                    </Text>
                    <BlockStack gap="300">
                      {categories.map((cat) => (
                        <InlineStack
                          key={cat.label}
                          align="space-between"
                          blockAlign="center"
                        >
                          <Text>{cat.label}</Text>
                          <InlineStack gap="200" blockAlign="center">
                            <div style={{ width: 120 }}>
                              <ProgressBar
                                progress={Math.round(
                                  (cat.score / cat.max) * 100
                                )}
                                size="small"
                                tone={
                                  cat.score / cat.max >= 0.7
                                    ? "success"
                                    : cat.score / cat.max >= 0.4
                                      ? "highlight"
                                      : "critical"
                                }
                              />
                            </div>
                            <Text variant="bodySm">
                              {cat.score}/{cat.max}
                            </Text>
                          </InlineStack>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <Text>
                      Run your first scan to see how well your store is
                      optimized for AI shopping agents.
                    </Text>
                    <Text tone="subdued">
                      We check llms.txt, structured data, robots.txt, FAQ
                      coverage, content quality, and metadata.
                    </Text>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Quick Actions */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="200">
                  <Button url="/app/llms-txt" fullWidth>
                    {hasLlmsTxt ? "Update" : "Generate"} llms.txt
                  </Button>
                  <Button url="/app/structured-data" fullWidth>
                    {hasStructuredData ? "Configure" : "Enable"} Structured Data
                  </Button>
                  <Button url="/app/faqs" fullWidth>
                    {faqCount > 0 ? `Manage FAQs (${faqCount})` : "Generate FAQs"}
                  </Button>
                  <Button url="/app/robots-txt" fullWidth>
                    {hasRobotsConfig ? "Update" : "Configure"} robots.txt
                  </Button>
                  <Button url="/app/keywords" fullWidth>
                    Keywords & Synonyms
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* What AI Agents See */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  AI Agents We Optimize For
                </Text>
                <InlineGrid columns={3} gap="400">
                  {[
                    { name: "ChatGPT Shopping", bot: "GPTBot", status: hasRobotsConfig },
                    { name: "Perplexity Shopping", bot: "PerplexityBot", status: hasRobotsConfig },
                    { name: "Google AI Overviews", bot: "Google-Extended", status: hasRobotsConfig },
                    { name: "Claude AI", bot: "ClaudeBot", status: hasRobotsConfig },
                    { name: "Cohere AI", bot: "cohere-ai", status: hasRobotsConfig },
                    { name: "Meta AI / Llama", bot: "FacebookBot", status: hasRobotsConfig },
                  ].map((agent) => (
                    <Box key={agent.name} padding="300" borderRadius="200" background="bg-surface-secondary">
                      <BlockStack gap="100">
                        <Text variant="bodySm" fontWeight="bold">
                          {agent.name}
                        </Text>
                        <Badge tone={agent.status ? "success" : "attention"}>
                          {agent.status ? "Configured" : "Not set"}
                        </Badge>
                      </BlockStack>
                    </Box>
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
