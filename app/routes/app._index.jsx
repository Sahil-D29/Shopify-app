import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, Link } from "@remix-run/react";
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
  Divider,
  Box,
  Badge,
  InlineGrid,
} from "@shopify/polaris";

import { getGrade } from "../lib/ai-discovery/readiness-utils";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Load all scores in parallel
  const [score, llmsTxt, sdConfig, robotsConfig, faqCount, seoAudits, geoData, scoreHistory, shopPlan] =
    await Promise.all([
      prisma.aiReadinessScore.findUnique({ where: { shop } }),
      prisma.llmsTxt.findUnique({ where: { shop } }),
      prisma.structuredDataConfig.findUnique({ where: { shop } }),
      prisma.robotsTxtConfig.findUnique({ where: { shop } }),
      prisma.faqEntry.count({ where: { shop } }),
      prisma.seoAudit.findMany({ where: { shop }, take: 250 }).catch(() => []),
      prisma.geoOptimization.findMany({ where: { shop }, take: 250 }).catch(() => []),
      prisma.scoreHistory.findMany({
        where: { shop },
        orderBy: { recordedAt: "desc" },
        take: 15,
      }).catch(() => []),
      prisma.shopPlan.findUnique({ where: { shop } }).catch(() => null),
    ]);

  // Compute SEO average score
  const seoAvgScore =
    seoAudits.length > 0
      ? Math.round(
          seoAudits.reduce(
            (s, a) =>
              s + (a.seoTitleScore + a.seoDescScore + a.imageAltScore + a.contentScore) / 4,
            0
          ) / seoAudits.length
        )
      : null;

  // Compute GEO average score
  const geoAvgScore =
    geoData.length > 0
      ? Math.round(geoData.reduce((s, g) => s + g.geoReadiness, 0) / geoData.length)
      : null;

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
    seoAvgScore,
    geoAvgScore,
    seoAuditCount: seoAudits.length,
    geoProductCount: geoData.length,
    hasLlmsTxt: !!llmsTxt,
    hasStructuredData: !!sdConfig,
    hasRobotsConfig: !!robotsConfig,
    faqCount,
    currentPlan: shopPlan?.plan || "Free",
    scoreHistory: scoreHistory.map((h) => ({
      type: h.scoreType,
      score: h.score,
      date: h.recordedAt,
    })),
  });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { calculateReadinessScore } = await import(
    "../lib/ai-discovery/readiness-score.server"
  );

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

  // Record to score history
  await prisma.scoreHistory.create({
    data: { shop, scoreType: "ai", score: results.overallScore },
  });

  return json({ score: results });
};

function ScoreRing({ label, score, maxScore, color, subtitle }) {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return (
    <Card>
      <BlockStack gap="300" inlineAlign="center">
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: `conic-gradient(${color} ${percentage * 3.6}deg, #e5e7eb ${percentage * 3.6}deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <Text variant="headingLg" as="p">
              {score}
            </Text>
          </div>
        </div>
        <Text variant="headingSm" as="h3" alignment="center">
          {label}
        </Text>
        {subtitle && (
          <Text variant="bodySm" tone="subdued" alignment="center">
            {subtitle}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

function TopActions({ seoAvgScore, geoAvgScore, score }) {
  const actions = [];

  if (!score) {
    actions.push({
      text: "Run your first AI Readiness scan",
      url: null,
      priority: "critical",
    });
  } else if (score.overallScore < 50) {
    if (score.llmsTxtScore < 15)
      actions.push({ text: "Generate llms.txt to boost AI visibility", url: "/app/llms-txt", priority: "critical" });
    if (score.structuredDataScore < 10)
      actions.push({ text: "Enable structured data schemas", url: "/app/structured-data", priority: "critical" });
    if (score.faqScore < 5)
      actions.push({ text: "Generate FAQs for your products", url: "/app/faqs", priority: "warning" });
  }

  if (seoAvgScore === null) {
    actions.push({ text: "Run your first SEO audit", url: "/app/seo", priority: "warning" });
  } else if (seoAvgScore < 60) {
    actions.push({ text: "Improve SEO — score is below 60", url: "/app/seo", priority: "warning" });
  }

  if (geoAvgScore === null) {
    actions.push({ text: "Analyze GEO readiness for AI search", url: "/app/geo", priority: "info" });
  } else if (geoAvgScore < 50) {
    actions.push({ text: "Improve GEO score for AI search citations", url: "/app/geo", priority: "warning" });
  }

  if (actions.length === 0) {
    actions.push({ text: "All looking good! Re-scan to check for updates.", url: null, priority: "success" });
  }

  return actions.slice(0, 3);
}

export default function Dashboard() {
  const {
    shopName,
    domain,
    score,
    seoAvgScore,
    geoAvgScore,
    seoAuditCount,
    geoProductCount,
    hasLlmsTxt,
    hasStructuredData,
    hasRobotsConfig,
    faqCount,
    currentPlan,
    scoreHistory,
  } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  const gradeInfo = score ? getGrade(score.overallScore) : null;
  const topActions = TopActions({ seoAvgScore, geoAvgScore, score });

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
        {/* Plan Badge + Store Info */}
        <Banner tone="info">
          <p>
            Make <strong>{shopName}</strong> visible to AI shopping agents like ChatGPT,
            Perplexity, and Google AI. AI-referred traffic to retail sites grew 4,700% YoY.
            {currentPlan !== "Free" && (
              <> You're on the <strong>{currentPlan}</strong> plan.</>
            )}
          </p>
        </Banner>

        {/* Top 3 Actions */}
        {topActions.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Top Actions to Improve
              </Text>
              {topActions.map((action, i) => (
                <InlineStack key={i} gap="300" blockAlign="center">
                  <Badge
                    tone={
                      action.priority === "critical"
                        ? "critical"
                        : action.priority === "warning"
                          ? "warning"
                          : action.priority === "success"
                            ? "success"
                            : "info"
                    }
                  >
                    {i + 1}
                  </Badge>
                  <Text variant="bodyMd">{action.text}</Text>
                  {action.url && (
                    <Button url={action.url} size="slim">
                      Fix
                    </Button>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Three Score Rings: AI + SEO + GEO */}
        <Layout>
          <Layout.Section variant="oneThird">
            <ScoreRing
              label="AI Readiness"
              score={score?.overallScore || 0}
              maxScore={100}
              color="#3b82f6"
              subtitle={score ? `Grade: ${gradeInfo?.grade}` : "Not scanned yet"}
            />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <ScoreRing
              label="SEO Health"
              score={seoAvgScore || 0}
              maxScore={100}
              color="#22c55e"
              subtitle={
                seoAvgScore !== null
                  ? `${seoAuditCount} products audited`
                  : "Run SEO audit"
              }
            />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <ScoreRing
              label="GEO Readiness"
              score={geoAvgScore || 0}
              maxScore={100}
              color="#a855f7"
              subtitle={
                geoAvgScore !== null
                  ? `${geoProductCount} products analyzed`
                  : "Run GEO analysis"
              }
            />
          </Layout.Section>
        </Layout>

        <Layout>
          {/* AI Score Details */}
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
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    AI Discovery
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

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    SEO & GEO
                  </Text>
                  <BlockStack gap="200">
                    <Button url="/app/seo" fullWidth>
                      {seoAvgScore !== null ? `SEO Audit (${seoAvgScore}/100)` : "Run SEO Audit"}
                    </Button>
                    <Button url="/app/geo" fullWidth>
                      {geoAvgScore !== null ? `GEO Optimizer (${geoAvgScore}/100)` : "GEO Optimizer"}
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Plan</Text>
                    <Badge tone={currentPlan === "Free" ? "info" : "success"}>
                      {currentPlan}
                    </Badge>
                  </InlineStack>
                  {currentPlan === "Free" && (
                    <Button url="/app/billing" fullWidth>
                      Upgrade Plan
                    </Button>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
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
