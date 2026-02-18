import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, Checkbox,
  FormLayout, TextField, Box,
} from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  generateRobotsTxt,
  AI_CRAWLERS,
} from "../lib/ai-discovery/robots-txt-generator.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await prisma.robotsTxtConfig.findUnique({
    where: { shop: session.shop },
  });

  const preview = generateRobotsTxt(config || {});

  return json({ config, preview });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const config = {
    allowGPTBot: formData.get("allowGPTBot") === "true",
    allowClaudeBot: formData.get("allowClaudeBot") === "true",
    allowPerplexityBot: formData.get("allowPerplexityBot") === "true",
    allowGoogleExtended: formData.get("allowGoogleExtended") === "true",
    allowCohereBot: formData.get("allowCohereBot") === "true",
    allowMetaBot: formData.get("allowMetaBot") === "true",
    customRules: formData.get("customRules") || null,
  };

  await prisma.robotsTxtConfig.upsert({
    where: { shop },
    create: { shop, ...config },
    update: config,
  });

  return json({ success: true, robotsTxt: generateRobotsTxt(config) });
};

export default function RobotsTxtPage() {
  const { config, preview } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [state, setState] = useState({
    allowGPTBot: config?.allowGPTBot ?? true,
    allowClaudeBot: config?.allowClaudeBot ?? true,
    allowPerplexityBot: config?.allowPerplexityBot ?? true,
    allowGoogleExtended: config?.allowGoogleExtended ?? true,
    allowCohereBot: config?.allowCohereBot ?? true,
    allowMetaBot: config?.allowMetaBot ?? true,
    customRules: config?.customRules || "",
  });

  const handleSave = () => {
    const fd = new FormData();
    Object.entries(state).forEach(([k, v]) => fd.set(k, String(v)));
    submit(fd, { method: "POST" });
  };

  const currentPreview = actionData?.robotsTxt || preview;

  return (
    <Page title="robots.txt Optimizer" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Control which AI crawlers can access your store. By default, Shopify
            stores don't explicitly allow AI agents — you need to configure this
            so ChatGPT, Perplexity, and Google AI can discover your products.
          </p>
        </Banner>

        {actionData?.success && (
          <Banner tone="success">robots.txt configuration saved.</Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  AI Crawler Access
                </Text>
                <Text tone="subdued">
                  Choose which AI shopping agents can crawl your product pages.
                  Allowing access means these AI tools can recommend your products.
                </Text>
                <FormLayout>
                  {AI_CRAWLERS.map((crawler) => (
                    <Checkbox
                      key={crawler.key}
                      label={`${crawler.userAgent} — ${crawler.description}`}
                      checked={state[crawler.key]}
                      onChange={(v) =>
                        setState({ ...state, [crawler.key]: v })
                      }
                    />
                  ))}
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Custom Rules
                </Text>
                <TextField
                  label="Additional robots.txt rules"
                  value={state.customRules}
                  onChange={(v) => setState({ ...state, customRules: v })}
                  multiline={4}
                  placeholder="User-agent: SomeBot\nAllow: /products/"
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              Save robots.txt Config
            </Button>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Generated robots.txt Preview
                </Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>
                    {currentPreview}
                  </pre>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
