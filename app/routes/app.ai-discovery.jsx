import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, Link } from "@remix-run/react";
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
  Tabs,
  Box,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [llmsTxt, robotsTxt, keywordCount] = await Promise.all([
    prisma.llmsTxt.findUnique({ where: { shop } }).catch((e) => { console.error("[ai-discovery] llmsTxt failed:", e); return null; }),
    prisma.robotsTxtConfig.findUnique({ where: { shop } }).catch((e) => { console.error("[ai-discovery] robotsTxtConfig failed:", e); return null; }),
    prisma.keywordMapping.count({ where: { shop } }).catch((e) => { console.error("[ai-discovery] keywordMapping failed:", e); return 0; }),
  ]);

  return json({
    shop,
    hasLlmsTxt: !!llmsTxt,
    llmsTxtUpdated: llmsTxt?.updatedAt || null,
    hasRobotsTxt: !!robotsTxt,
    robotsTxtConfig: robotsTxt,
    keywordCount,
  });
};

export default function AiDiscoveryPage() {
  const { shop, hasLlmsTxt, llmsTxtUpdated, hasRobotsTxt, robotsTxtConfig, keywordCount } = useLoaderData();
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "llms", content: "llms.txt" },
    { id: "robots", content: "robots.txt" },
    { id: "keywords", content: "Keywords" },
    { id: "mcp", content: "MCP Server" },
  ];

  const crawlerStatus = robotsTxtConfig
    ? [
        { name: "GPTBot (ChatGPT)", allowed: robotsTxtConfig.allowGPTBot },
        { name: "ClaudeBot", allowed: robotsTxtConfig.allowClaudeBot },
        { name: "PerplexityBot", allowed: robotsTxtConfig.allowPerplexityBot },
        { name: "Google-Extended", allowed: robotsTxtConfig.allowGoogleExtended },
        { name: "Cohere AI", allowed: robotsTxtConfig.allowCohereBot },
        { name: "Meta/Llama", allowed: robotsTxtConfig.allowMetaBot },
      ]
    : [];

  return (
    <Page title="AI Discovery" subtitle="Make your store visible to AI shopping agents">
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            AI Discovery tools help AI assistants like ChatGPT, Perplexity, and Google AI
            find and recommend your products. Configure llms.txt, robots.txt, and keywords
            to maximize your AI visibility.
          </p>
        </Banner>

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">llms.txt</Text>
                  <Badge tone={hasLlmsTxt ? "success" : "warning"}>
                    {hasLlmsTxt ? "Generated" : "Not Set"}
                  </Badge>
                </InlineStack>
                <Text variant="bodyMd" tone="subdued">
                  AI-readable index of your store's products and content.
                </Text>
                <Button url="/app/llms-txt" fullWidth>
                  {hasLlmsTxt ? "View & Regenerate" : "Generate llms.txt"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">robots.txt</Text>
                  <Badge tone={hasRobotsTxt ? "success" : "warning"}>
                    {hasRobotsTxt ? "Configured" : "Not Set"}
                  </Badge>
                </InlineStack>
                <Text variant="bodyMd" tone="subdued">
                  Control which AI crawlers can access your store.
                </Text>
                <Button url="/app/robots-txt" fullWidth>
                  {hasRobotsTxt ? "Edit Configuration" : "Configure robots.txt"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingSm" as="h3">Keywords</Text>
                  <Badge tone={keywordCount > 0 ? "success" : "warning"}>
                    {keywordCount > 0 ? `${keywordCount} mappings` : "Not Set"}
                  </Badge>
                </InlineStack>
                <Text variant="bodyMd" tone="subdued">
                  Synonyms and conversational phrases for AI search.
                </Text>
                <Button url="/app/keywords" fullWidth>
                  {keywordCount > 0 ? "View Keywords" : "Generate Keywords"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {hasRobotsTxt && crawlerStatus.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">AI Crawler Access</Text>
              <InlineStack gap="400" wrap>
                {crawlerStatus.map((crawler) => (
                  <InlineStack key={crawler.name} gap="200" blockAlign="center">
                    <Badge tone={crawler.allowed ? "success" : "critical"}>
                      {crawler.allowed ? "Allowed" : "Blocked"}
                    </Badge>
                    <Text variant="bodyMd">{crawler.name}</Text>
                  </InlineStack>
                ))}
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">MCP Server</Text>
            <Text variant="bodyMd" tone="subdued">
              The Model Context Protocol (MCP) server provides 14 tools for AI assistants to
              interact with your store data directly — generating llms.txt, FAQs, schemas, and more.
            </Text>
            <Button url="/app/mcp-status">View MCP Status</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
