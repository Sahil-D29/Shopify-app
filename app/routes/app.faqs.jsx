import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, DataTable, Badge,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");

  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const faqs = await prisma.faqEntry.findMany({
    where: { shop },
    orderBy: [{ resourceType: "asc" }, { sortOrder: "asc" }],
    take: 100,
  });

  const counts = {
    store: faqs.filter((f) => f.resourceType === "store").length,
    product: faqs.filter((f) => f.resourceType === "product").length,
    collection: faqs.filter((f) => f.resourceType === "collection").length,
  };

  return json({ faqs, counts, total: faqs.length });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { generateProductFaqs, generateStoreFaqs, generateCollectionFaqs } = await import("../lib/ai-discovery/faq-generator.server");
  const { fetchStoreData } = await import("../lib/ai-discovery/llms-txt-generator.server");

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate") {
    const storeData = await fetchStoreData(admin);

    // Delete existing generated FAQs
    await prisma.faqEntry.deleteMany({ where: { shop } });

    const allFaqs = [];

    // Store-level FAQs
    const storeFaqs = generateStoreFaqs(
      storeData.shop,
      storeData.products.length,
      storeData.collections.length
    );
    for (let i = 0; i < storeFaqs.length; i++) {
      allFaqs.push({
        shop,
        resourceType: "store",
        resourceId: null,
        question: storeFaqs[i].question,
        answer: storeFaqs[i].answer,
        keywords: storeFaqs[i].keywords,
        sortOrder: i,
        published: true,
      });
    }

    // Collection FAQs
    for (const col of storeData.collections) {
      const colFaqs = generateCollectionFaqs(col, storeData.shop);
      for (let i = 0; i < colFaqs.length; i++) {
        allFaqs.push({
          shop,
          resourceType: "collection",
          resourceId: col.id,
          question: colFaqs[i].question,
          answer: colFaqs[i].answer,
          keywords: colFaqs[i].keywords,
          sortOrder: i,
          published: true,
        });
      }
    }

    // Product FAQs
    for (const product of storeData.products) {
      const prodFaqs = generateProductFaqs(product, storeData.shop);
      for (let i = 0; i < prodFaqs.length; i++) {
        allFaqs.push({
          shop,
          resourceType: "product",
          resourceId: product.id,
          question: prodFaqs[i].question,
          answer: prodFaqs[i].answer,
          keywords: prodFaqs[i].keywords,
          sortOrder: i,
          published: true,
        });
      }
    }

    // Batch insert
    await prisma.faqEntry.createMany({ data: allFaqs });

    return json({
      success: true,
      generated: allFaqs.length,
      products: storeData.products.length,
      collections: storeData.collections.length,
    });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function FaqsPage() {
  const { faqs, counts, total } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const rows = faqs.slice(0, 50).map((f) => [
    <Badge key={f.id} tone={f.resourceType === "store" ? "info" : f.resourceType === "product" ? "success" : "attention"}>
      {f.resourceType}
    </Badge>,
    f.question,
    f.answer.slice(0, 100) + (f.answer.length > 100 ? "..." : ""),
    f.keywords.split(",").slice(0, 3).join(", "),
  ]);

  return (
    <Page title="Conversational FAQs" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Conversational FAQs match how people ask AI shopping agents questions.
            AI agents like ChatGPT and Perplexity prioritize stores with rich Q&A
            content — it makes your products 3x more likely to be recommended.
          </p>
        </Banner>

        {actionData?.success && (
          <Banner tone="success" title="FAQs Generated">
            Created {actionData.generated} FAQ entries from {actionData.products}{" "}
            products and {actionData.collections} collections.
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  FAQ Generation
                </Text>
                <Text>
                  Auto-generate conversational FAQ pairs for every product,
                  collection, and your store overall. Each FAQ includes keyword
                  synonyms for maximum AI discovery.
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Current: {counts.store} store FAQs, {counts.product} product FAQs,{" "}
                  {counts.collection} collection FAQs ({total} total)
                </Text>
                <Button
                  variant="primary"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("intent", "generate");
                    submit(fd, { method: "POST" });
                  }}
                  loading={isGenerating}
                >
                  {total > 0 ? "Regenerate All FAQs" : "Generate FAQs"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          {total > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    FAQ Entries ({total})
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Type", "Question", "Answer", "Keywords"]}
                    rows={rows}
                  />
                  {total > 50 && (
                    <Text tone="subdued">
                      Showing 50 of {total} entries.
                    </Text>
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
