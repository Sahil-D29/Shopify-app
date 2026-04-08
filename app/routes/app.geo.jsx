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
  DataTable,
  ProgressBar,
  Tabs,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { getFeatureAccess, ensureShopPlan } = await import("../lib/billing.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  let access = { geoOptimizer: true };
  try {
    await ensureShopPlan(prisma, shop);
    access = await getFeatureAccess(prisma, shop);
  } catch (e) {
    console.error("[geo] ensureShopPlan/getFeatureAccess failed:", e);
  }

  if (!access.geoOptimizer) {
    return json({ locked: true, access, geoData: [], stats: {} });
  }

  let geoData = [];
  try {
    geoData = await prisma.geoOptimization.findMany({
      where: { shop },
      orderBy: { geoReadiness: "asc" },
      take: 250,
    });
  } catch (e) {
    console.error("[geo] geoOptimization.findMany failed:", e);
  }

  const totalProducts = geoData.length;
  const avgScore = totalProducts > 0
    ? Math.round(geoData.reduce((s, g) => s + g.geoReadiness, 0) / totalProducts)
    : 0;

  return json({
    locked: false,
    access,
    geoData,
    stats: { totalProducts, avgScore },
  });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "run_geo_audit") {
    const { runGeoAudit } = await import("../lib/geo/geo-analyzer.server");
    const results = await runGeoAudit(admin, 50);

    for (const result of results) {
      await prisma.geoOptimization.upsert({
        where: { id: result.resourceId + "-" + shop }, // Will create new since ID is uuid
        create: {
          shop,
          resourceType: "product",
          resourceId: result.resourceId,
          authorityScore: result.authorityScore,
          geoReadiness: result.geoReadiness,
          issues: JSON.stringify(result.issues),
        },
        update: {
          authorityScore: result.authorityScore,
          geoReadiness: result.geoReadiness,
          issues: JSON.stringify(result.issues),
        },
      });
    }

    // Simpler approach: delete old and create new
    await prisma.geoOptimization.deleteMany({ where: { shop } });
    for (const result of results) {
      await prisma.geoOptimization.create({
        data: {
          shop,
          resourceType: "product",
          resourceId: result.resourceId,
          authorityScore: result.authorityScore,
          geoReadiness: result.geoReadiness,
          issues: JSON.stringify(result.issues),
        },
      });
    }

    // Record score history
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.geoReadiness, 0) / results.length)
      : 0;

    await prisma.scoreHistory.create({
      data: { shop, scoreType: "geo", score: avgScore },
    });

    return json({ success: true, analyzed: results.length });
  }

  if (intent === "generate_citations") {
    const { generateAllCitations } = await import("../lib/geo/citation-generator.server");

    // Get shop name
    const shopResponse = await admin.graphql(`{ shop { name } }`);
    const shopData = await shopResponse.json();
    const shopName = shopData.data?.shop?.name || shop;

    const citations = await generateAllCitations(admin, shopName, 50);

    // Update GEO records with citations
    for (const citation of citations) {
      await prisma.geoOptimization.updateMany({
        where: { shop, resourceId: citation.resourceId },
        data: { citationSnippet: citation.citationSnippet },
      });
    }

    return json({ success: true, generated: citations.length });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

function GeoScoreCard({ title, score }) {
  const tone = score >= 70 ? "success" : score >= 40 ? "warning" : "critical";
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingSm" as="h3">{title}</Text>
        <InlineStack align="space-between">
          <Text variant="heading2xl" as="p">{score}</Text>
          <Badge tone={tone}>{score >= 70 ? "Optimized" : score >= 40 ? "Needs Work" : "Not Ready"}</Badge>
        </InlineStack>
        <ProgressBar progress={score} size="small" />
      </BlockStack>
    </Card>
  );
}

export default function GeoPage() {
  const { locked, access, geoData, stats } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isRunning = navigation.state === "submitting";
  const [selectedTab, setSelectedTab] = useState(0);

  if (locked) {
    return (
      <Page title="GEO Optimizer">
        <EmptyState
          heading="Generative Engine Optimization"
          action={{ content: "Upgrade to Enterprise", url: "/app/billing" }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            GEO optimization helps your products appear in AI-generated search results from
            Google AI Overviews, Perplexity, ChatGPT, and more. This feature is available on the Enterprise plan.
          </p>
        </EmptyState>
      </Page>
    );
  }

  const handleRunAudit = useCallback(() => {
    const fd = new FormData();
    fd.set("intent", "run_geo_audit");
    submit(fd, { method: "POST" });
  }, [submit]);

  const handleGenerateCitations = useCallback(() => {
    const fd = new FormData();
    fd.set("intent", "generate_citations");
    submit(fd, { method: "POST" });
  }, [submit]);

  if (geoData.length === 0) {
    return (
      <Page
        title="GEO Optimizer"
        primaryAction={{ content: "Run GEO Analysis", onAction: handleRunAudit, loading: isRunning }}
      >
        <BlockStack gap="500">
          <Banner tone="info">
            <p>
              <strong>GEO (Generative Engine Optimization)</strong> optimizes your store for AI-generated
              search results — Google AI Overviews, Perplexity answers, ChatGPT web search, and more.
              AI-referred traffic to retail sites has grown 4,700% year-over-year.
            </p>
          </Banner>
          <EmptyState
            heading="Analyze your GEO readiness"
            action={{ content: "Run GEO Analysis", onAction: handleRunAudit, loading: isRunning }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              We'll analyze your products for citability, authority signals, surface coverage,
              content freshness, and query alignment — the 5 key factors for AI search visibility.
            </p>
          </EmptyState>
        </BlockStack>
      </Page>
    );
  }

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "products", content: "Product Scores" },
    { id: "citations", content: "Citation Snippets" },
  ];

  const productRows = geoData.map((g) => {
    const title = (g.resourceId || "").split("/").pop() || "Product";
    return [
      title,
      g.geoReadiness,
      g.authorityScore,
      g.citationSnippet ? "Yes" : "No",
    ];
  });

  const citationRows = geoData
    .filter((g) => g.citationSnippet)
    .map((g) => [
      (g.resourceId || "").split("/").pop() || "Product",
      g.citationSnippet?.substring(0, 120) + (g.citationSnippet?.length > 120 ? "..." : ""),
    ]);

  return (
    <Page
      title="GEO Optimizer"
      primaryAction={{ content: "Re-run Analysis", onAction: handleRunAudit, loading: isRunning }}
      secondaryActions={[
        { content: "Generate Citations", onAction: handleGenerateCitations, loading: isRunning },
      ]}
      subtitle="Generative Engine Optimization"
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section variant="oneHalf">
            <GeoScoreCard title="Overall GEO Score" score={stats.avgScore} />
          </Layout.Section>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Products Analyzed</Text>
                <Text variant="heading2xl" as="p">{stats.totalProducts}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">GEO Readiness Summary</Text>
                  <Text variant="bodyMd">
                    Your store's average GEO readiness is <strong>{stats.avgScore}/100</strong>.
                    {stats.avgScore < 40 && " Your products need significant optimization for AI search visibility."}
                    {stats.avgScore >= 40 && stats.avgScore < 70 && " There are good opportunities to improve AI search visibility."}
                    {stats.avgScore >= 70 && " Your products are well-optimized for AI search."}
                  </Text>
                  <Banner tone="info">
                    <p>
                      <strong>Tip:</strong> Generate citation snippets to give AI models pre-formatted,
                      cite-ready content about your products. This significantly improves how AI represents your products.
                    </p>
                  </Banner>
                </BlockStack>
              )}

              {selectedTab === 1 && (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "text"]}
                  headings={["Product ID", "GEO Score", "Authority", "Has Citation"]}
                  rows={productRows}
                  sortable={[false, true, true, false]}
                />
              )}

              {selectedTab === 2 && (
                citationRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Product", "Citation Snippet"]}
                    rows={citationRows}
                  />
                ) : (
                  <Banner tone="warning">
                    <p>No citation snippets generated yet. Click "Generate Citations" to create them.</p>
                  </Banner>
                )
              )}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}
