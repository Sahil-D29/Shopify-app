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

  let access = { maxSeoAuditProducts: 10 };
  try {
    await ensureShopPlan(prisma, shop);
    access = await getFeatureAccess(prisma, shop);
  } catch (e) {
    console.error("[seo] ensureShopPlan/getFeatureAccess failed:", e);
  }

  // Load existing audit results
  let audits = [];
  try {
    audits = await prisma.seoAudit.findMany({
      where: { shop },
      orderBy: { seoTitleScore: "asc" },
      take: access.maxSeoAuditProducts === -1 ? 250 : access.maxSeoAuditProducts,
    });
  } catch (e) {
    console.error("[seo] seoAudit.findMany failed:", e);
  }

  // Calculate overview stats
  const totalProducts = audits.length;
  const avgTitleScore = totalProducts > 0 ? Math.round(audits.reduce((s, a) => s + a.seoTitleScore, 0) / totalProducts) : 0;
  const avgDescScore = totalProducts > 0 ? Math.round(audits.reduce((s, a) => s + a.seoDescScore, 0) / totalProducts) : 0;
  const avgImageScore = totalProducts > 0 ? Math.round(audits.reduce((s, a) => s + a.imageAltScore, 0) / totalProducts) : 0;
  const avgContentScore = totalProducts > 0 ? Math.round(audits.reduce((s, a) => s + a.contentScore, 0) / totalProducts) : 0;
  const overallSeoScore = totalProducts > 0 ? Math.round((avgTitleScore + avgDescScore + avgImageScore + avgContentScore) / 4) : 0;

  return json({
    audits,
    access,
    stats: { totalProducts, avgTitleScore, avgDescScore, avgImageScore, avgContentScore, overallSeoScore },
  });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { getFeatureAccess } = await import("../lib/billing.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "run_audit") {
    const access = await getFeatureAccess(prisma, shop);
    const maxProducts = access.maxSeoAuditProducts === -1 ? 250 : access.maxSeoAuditProducts;

    const { runSeoAudit } = await import("../lib/seo/meta-analyzer.server");
    const results = await runSeoAudit(admin, maxProducts);

    // Save results to database
    for (const result of results) {
      await prisma.seoAudit.upsert({
        where: { shop_resourceId: { shop, resourceId: result.resourceId } },
        create: {
          shop,
          resourceType: "product",
          resourceId: result.resourceId,
          resourceTitle: result.resourceTitle,
          seoTitle: result.seoTitle,
          seoDescription: result.seoDescription,
          seoTitleScore: result.seoTitleScore,
          seoDescScore: result.seoDescScore,
          imageAltScore: result.imageAltScore,
          contentScore: result.contentScore,
          issues: JSON.stringify(result.issues),
          lastAuditAt: new Date(),
        },
        update: {
          resourceTitle: result.resourceTitle,
          seoTitle: result.seoTitle,
          seoDescription: result.seoDescription,
          seoTitleScore: result.seoTitleScore,
          seoDescScore: result.seoDescScore,
          imageAltScore: result.imageAltScore,
          contentScore: result.contentScore,
          issues: JSON.stringify(result.issues),
          lastAuditAt: new Date(),
        },
      });
    }

    // Record score history
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + (r.seoTitleScore + r.seoDescScore + r.imageAltScore + r.contentScore) / 4, 0) / results.length)
      : 0;

    await prisma.scoreHistory.create({
      data: { shop, scoreType: "seo", score: avgScore },
    });

    return json({ success: true, audited: results.length });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

function ScoreCard({ title, score, maxScore = 100 }) {
  const tone = score >= 80 ? "success" : score >= 50 ? "warning" : "critical";
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingSm" as="h3">{title}</Text>
        <InlineStack align="space-between">
          <Text variant="heading2xl" as="p">{score}</Text>
          <Badge tone={tone}>{score >= 80 ? "Good" : score >= 50 ? "Needs Work" : "Poor"}</Badge>
        </InlineStack>
        <ProgressBar progress={score} tone={tone === "success" ? "primary" : tone === "warning" ? "highlight" : "critical"} size="small" />
      </BlockStack>
    </Card>
  );
}

export default function SeoPage() {
  const { audits, access, stats } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isRunning = navigation.state === "submitting";
  const [selectedTab, setSelectedTab] = useState(0);

  const handleRunAudit = useCallback(() => {
    const fd = new FormData();
    fd.set("intent", "run_audit");
    submit(fd, { method: "POST" });
  }, [submit]);

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "issues", content: "Issues" },
    { id: "products", content: "Product Details" },
  ];

  if (audits.length === 0) {
    return (
      <Page
        title="SEO Audit"
        primaryAction={{ content: "Run SEO Audit", onAction: handleRunAudit, loading: isRunning }}
      >
        <EmptyState
          heading="Analyze your store's SEO health"
          action={{ content: "Run First Audit", onAction: handleRunAudit, loading: isRunning }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            We'll check your product titles, meta descriptions, image alt text, and content quality
            to find opportunities to improve your search rankings.
          </p>
        </EmptyState>
      </Page>
    );
  }

  // Collect all issues across audits
  const allIssues = audits.flatMap((a) => {
    const issues = typeof a.issues === "string" ? JSON.parse(a.issues) : (a.issues || []);
    return issues.map((issue) => [a.resourceTitle, issue]);
  });

  // Product detail rows
  const productRows = audits.map((a) => [
    a.resourceTitle.length > 35 ? a.resourceTitle.substring(0, 35) + "..." : a.resourceTitle,
    a.seoTitleScore,
    a.seoDescScore,
    a.imageAltScore,
    a.contentScore,
    Math.round((a.seoTitleScore + a.seoDescScore + a.imageAltScore + a.contentScore) / 4),
  ]);

  return (
    <Page
      title="SEO Audit"
      primaryAction={{ content: "Re-run Audit", onAction: handleRunAudit, loading: isRunning }}
      subtitle={`${stats.totalProducts} products analyzed`}
    >
      <BlockStack gap="500">
        {access.plan === "Free" && stats.totalProducts >= 5 && (
          <Banner tone="warning" action={{ content: "Upgrade to Pro", url: "/app/billing" }}>
            <p>Free plan audits up to 5 products. Upgrade to Pro for unlimited SEO auditing.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <ScoreCard title="Overall SEO" score={stats.overallSeoScore} />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <ScoreCard title="Meta Titles" score={stats.avgTitleScore} />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <ScoreCard title="Meta Descriptions" score={stats.avgDescScore} />
          </Layout.Section>
        </Layout>
        <Layout>
          <Layout.Section variant="oneHalf">
            <ScoreCard title="Image Alt Text" score={stats.avgImageScore} />
          </Layout.Section>
          <Layout.Section variant="oneHalf">
            <ScoreCard title="Content Quality" score={stats.avgContentScore} />
          </Layout.Section>
        </Layout>

        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">SEO Health Summary</Text>
                  <Text variant="bodyMd">
                    Analyzed {stats.totalProducts} products. Overall SEO score is{" "}
                    <strong>{stats.overallSeoScore}/100</strong>.
                    {stats.overallSeoScore < 50 && " There are significant opportunities to improve."}
                    {stats.overallSeoScore >= 80 && " Your store's SEO is in good shape!"}
                  </Text>
                </BlockStack>
              )}

              {selectedTab === 1 && (
                <DataTable
                  columnContentTypes={["text", "text"]}
                  headings={["Product", "Issue"]}
                  rows={allIssues.slice(0, 50)}
                />
              )}

              {selectedTab === 2 && (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric", "numeric"]}
                  headings={["Product", "Title", "Description", "Images", "Content", "Average"]}
                  rows={productRows}
                  sortable={[false, true, true, true, true, true]}
                />
              )}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}
