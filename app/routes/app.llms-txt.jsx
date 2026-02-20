import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, Box,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");

  const { session } = await authenticate.admin(request);
  const existing = await prisma.llmsTxt.findUnique({
    where: { shop: session.shop },
  });
  return json({ existing });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { fetchStoreData, generateLlmsTxt, generateLlmsFullTxt } = await import("../lib/ai-discovery/llms-txt-generator.server");

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const storeData = await fetchStoreData(admin);
  const content = generateLlmsTxt(storeData);
  const fullContent = generateLlmsFullTxt(storeData);

  await prisma.llmsTxt.upsert({
    where: { shop },
    create: { shop, content, fullContent, lastSyncAt: new Date() },
    update: { content, fullContent, lastSyncAt: new Date() },
  });

  return json({
    success: true,
    content,
    fullContent,
    productCount: storeData.products.length,
    collectionCount: storeData.collections.length,
  });
};

export default function LlmsTxtPage() {
  const { existing } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const content = actionData?.content || existing?.content;
  const fullContent = actionData?.fullContent || existing?.fullContent;

  return (
    <Page title="llms.txt Generator" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            <strong>llms.txt</strong> and <strong>llms-full.txt</strong> are
            standardized Markdown files that help AI agents (ChatGPT, Perplexity,
            Claude) discover and understand your store. Think of them as
            robots.txt for AI — but for content, not crawling.
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Generate llms.txt Files
                </Text>
                <Text>
                  We scan your products, collections, and pages to create
                  optimized files. These go at your store root:
                  <code> yourstore.com/llms.txt</code> and
                  <code> yourstore.com/llms-full.txt</code>
                </Text>
                <Button
                  variant="primary"
                  onClick={() => submit({}, { method: "POST" })}
                  loading={isGenerating}
                >
                  {content ? "Regenerate" : "Generate"} llms.txt
                </Button>
                {actionData?.success && (
                  <Banner tone="success">
                    Generated from {actionData.productCount} products and{" "}
                    {actionData.collectionCount} collections.
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {content && (
            <>
              <Layout.Section>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      llms.txt (Index)
                    </Text>
                    <Text tone="subdued">
                      Concise index with links — AI agents follow links for details.
                    </Text>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>
                        {content}
                      </pre>
                    </Box>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      llms-full.txt (Complete)
                    </Text>
                    <Text tone="subdued">
                      Full content in a single document — for complete AI ingestion.
                    </Text>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5, maxHeight: 500, overflow: "auto" }}>
                        {fullContent}
                      </pre>
                    </Box>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}
