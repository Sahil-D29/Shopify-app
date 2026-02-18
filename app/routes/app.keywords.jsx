import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, DataTable,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateKeywordMapping } from "../lib/ai-discovery/keyword-generator.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const mappings = await prisma.keywordMapping.findMany({
    where: { shop: session.shop },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return json({ mappings, total: mappings.length });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch all active products
  const res = await admin.graphql(`{
    products(first: 250, query: "status:active") {
      edges {
        node {
          id title productType vendor tags
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        }
      }
    }
  }`);
  const { data } = await res.json();
  const products = data.products.edges.map((e) => e.node);

  // Clear existing
  await prisma.keywordMapping.deleteMany({ where: { shop } });

  // Generate keyword mappings
  const mappings = products.map((p) => {
    const km = generateKeywordMapping(p);
    return {
      shop,
      resourceId: p.id,
      primaryTerm: km.primaryTerm,
      synonyms: km.synonyms,
      conversationalPhrases: km.conversationalPhrases,
    };
  });

  await prisma.keywordMapping.createMany({ data: mappings });

  return json({ success: true, generated: mappings.length });
};

export default function KeywordsPage() {
  const { mappings, total } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const rows = mappings.slice(0, 50).map((m) => [
    m.primaryTerm,
    m.synonyms?.split(",").slice(0, 5).join(", ") || "—",
    (m.conversationalPhrases || "")
      .split("|")
      .slice(0, 3)
      .map((p) => p.trim())
      .join(" ; ") || "—",
  ]);

  return (
    <Page title="Keywords & Synonyms" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            AI agents search using natural language — not exact product names.
            Keyword synonyms and conversational phrases ensure your products
            match queries like "best running shoes for beginners" or
            "affordable leather wallet for men".
          </p>
        </Banner>

        {actionData?.success && (
          <Banner tone="success">
            Generated keyword mappings for {actionData.generated} products.
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Generate Keywords & Synonyms
                </Text>
                <Text>
                  Auto-generate synonym expansions and conversational search
                  phrases for every product. These are used in FAQ generation,
                  llms.txt content, and structured data.
                </Text>
                <Button
                  variant="primary"
                  onClick={() => submit({}, { method: "POST" })}
                  loading={isGenerating}
                >
                  {total > 0 ? "Regenerate Keywords" : "Generate Keywords"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          {total > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Keyword Mappings ({total})
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Product", "Synonyms", "Conversational Phrases"]}
                    rows={rows}
                  />
                  {total > 50 && (
                    <Text tone="subdued">Showing 50 of {total}.</Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}
