import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, Checkbox, Box,
  FormLayout, TextField, InlineStack,
} from "@shopify/polaris";
import { useState } from "react";

function InlineButtonRow({ installed, onInstall, onUninstall, loading }) {
  return (
    <InlineStack gap="300">
      <Button variant="primary" onClick={onInstall} loading={loading}>
        {installed ? "Reinstall in theme" : "Install in theme"}
      </Button>
      {installed && (
        <Button tone="critical" onClick={onUninstall} loading={loading}>
          Remove from theme
        </Button>
      )}
    </InlineStack>
  );
}

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { generateHomepageSchemas, generateProductSchema } = await import("../lib/ai-discovery/structured-data-generator.server");
  const { isInstalledInTheme } = await import("../lib/theme-injection.server");

  const { admin, session } = await authenticate.admin(request);
  const config = await prisma.structuredDataConfig.findUnique({
    where: { shop: session.shop },
  });

  const themeStatus = await isInstalledInTheme(admin).catch(() => ({
    installed: false,
    themeName: null,
  }));

  // Fetch a sample product for preview
  const shopRes = await admin.graphql(`{
    shop {
      name
      myshopifyDomain
      primaryDomain { url host }
      description
      contactEmail
      currencyCode
    }
    products(first: 1, query: "status:active") {
      edges {
        node {
          title description handle vendor productType tags
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
          variants(first: 3) {
            edges { node { title price sku availableForSale } }
          }
        }
      }
    }
  }`);
  const { data } = await shopRes.json();
  const sampleProduct = data.products.edges[0]?.node;

  // Generate preview schemas
  const homepageSchemas = generateHomepageSchemas(data.shop, config || {});
  const productSchema = sampleProduct
    ? generateProductSchema(sampleProduct, data.shop)
    : null;

  return json({
    config,
    homepageSchemasPreview: JSON.stringify(homepageSchemas, null, 2),
    productSchemaPreview: productSchema
      ? JSON.stringify(productSchema, null, 2)
      : null,
    sampleProductTitle: sampleProduct?.title,
    themeStatus,
  });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { installInTheme, uninstallFromTheme } = await import("../lib/theme-injection.server");

  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const shop = session.shop;
  const intent = formData.get("intent");

  if (intent === "install_theme") {
    try {
      const result = await installInTheme(admin);
      return json({ themeInstalled: true, themeName: result.themeName, alreadyInstalled: result.alreadyInstalled });
    } catch (e) {
      return json({ themeError: e.message }, { status: 500 });
    }
  }

  if (intent === "uninstall_theme") {
    try {
      const result = await uninstallFromTheme(admin);
      return json({ themeUninstalled: true, themeName: result.themeName });
    } catch (e) {
      return json({ themeError: e.message }, { status: 500 });
    }
  }

  const config = {
    enableProduct: formData.get("enableProduct") === "true",
    enableFaq: formData.get("enableFaq") === "true",
    enableOrganization: formData.get("enableOrganization") === "true",
    enableBreadcrumb: formData.get("enableBreadcrumb") === "true",
    enableReviews: formData.get("enableReviews") === "true",
    enableSitelinks: formData.get("enableSitelinks") === "true",
    customOrgName: formData.get("customOrgName") || null,
    customOrgDescription: formData.get("customOrgDescription") || null,
    customOrgLogo: formData.get("customOrgLogo") || null,
  };

  await prisma.structuredDataConfig.upsert({
    where: { shop },
    create: { shop, ...config },
    update: config,
  });

  return json({ success: true });
};

export default function StructuredDataPage() {
  const { config, homepageSchemasPreview, productSchemaPreview, sampleProductTitle, themeStatus } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [state, setState] = useState({
    enableProduct: config?.enableProduct ?? true,
    enableFaq: config?.enableFaq ?? true,
    enableOrganization: config?.enableOrganization ?? true,
    enableBreadcrumb: config?.enableBreadcrumb ?? true,
    enableReviews: config?.enableReviews ?? true,
    enableSitelinks: config?.enableSitelinks ?? true,
    customOrgName: config?.customOrgName || "",
    customOrgDescription: config?.customOrgDescription || "",
    customOrgLogo: config?.customOrgLogo || "",
  });

  const handleSave = () => {
    const formData = new FormData();
    Object.entries(state).forEach(([key, value]) => {
      formData.set(key, String(value));
    });
    submit(formData, { method: "POST" });
  };

  return (
    <Page title="Structured Data (JSON-LD)" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            JSON-LD structured data helps AI agents understand your products,
            brand, and FAQs. Stores with proper Schema.org markup see 30-40%
            higher AI visibility.
          </p>
        </Banner>

        {actionData?.success && (
          <Banner tone="success" title="Saved">
            Structured data configuration updated.
          </Banner>
        )}

        {actionData?.themeInstalled && (
          <Banner tone="success" title={actionData.alreadyInstalled ? "Already installed" : "Installed in theme"}>
            Schemas {actionData.alreadyInstalled ? "are already" : "have been"} added to <strong>{actionData.themeName}</strong>.
          </Banner>
        )}
        {actionData?.themeUninstalled && (
          <Banner tone="info" title="Removed from theme">
            Removed from <strong>{actionData.themeName}</strong>.
          </Banner>
        )}
        {actionData?.themeError && (
          <Banner tone="critical" title="Theme update failed">
            <p>{actionData.themeError}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Auto-insert into theme</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {themeStatus.installed
                ? `Currently installed in ${themeStatus.themeName}. The snippet renders schemas on every page automatically.`
                : "One click adds a Liquid snippet to your published theme that emits Organization, WebSite, Product, Collection, and Article schemas on the right pages."}
            </Text>
            <InlineButtonRow
              installed={themeStatus.installed}
              onInstall={() => {
                const fd = new FormData();
                fd.set("intent", "install_theme");
                submit(fd, { method: "POST" });
              }}
              onUninstall={() => {
                if (confirm("Remove the AI Discovery snippet from your published theme?")) {
                  const fd = new FormData();
                  fd.set("intent", "uninstall_theme");
                  submit(fd, { method: "POST" });
                }
              }}
              loading={isSaving}
            />
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Schema Types</Text>
                <FormLayout>
                  <Checkbox label="Product schema (name, price, availability, brand)" checked={state.enableProduct} onChange={(v) => setState({ ...state, enableProduct: v })} />
                  <Checkbox label="FAQ schema (conversational Q&A pairs)" checked={state.enableFaq} onChange={(v) => setState({ ...state, enableFaq: v })} />
                  <Checkbox label="Organization schema (store name, description, contact)" checked={state.enableOrganization} onChange={(v) => setState({ ...state, enableOrganization: v })} />
                  <Checkbox label="Breadcrumb schema (navigation path)" checked={state.enableBreadcrumb} onChange={(v) => setState({ ...state, enableBreadcrumb: v })} />
                  <Checkbox label="Review/Rating schema (aggregate ratings)" checked={state.enableReviews} onChange={(v) => setState({ ...state, enableReviews: v })} />
                  <Checkbox label="Website + Sitelinks search schema" checked={state.enableSitelinks} onChange={(v) => setState({ ...state, enableSitelinks: v })} />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Organization Override</Text>
                <FormLayout>
                  <TextField label="Custom Org Name" value={state.customOrgName} onChange={(v) => setState({ ...state, customOrgName: v })} placeholder="Leave blank to use shop name" autoComplete="off" />
                  <TextField label="Custom Description" value={state.customOrgDescription} onChange={(v) => setState({ ...state, customOrgDescription: v })} placeholder="Leave blank to use shop description" multiline={3} autoComplete="off" />
                  <TextField label="Logo URL" value={state.customOrgLogo} onChange={(v) => setState({ ...state, customOrgLogo: v })} placeholder="https://..." autoComplete="off" />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              Save Configuration
            </Button>
          </Layout.Section>

          {/* Preview */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Homepage Schema Preview</Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 300, overflow: "auto" }}>
                    {homepageSchemasPreview}
                  </pre>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {productSchemaPreview && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Product Schema Preview ({sampleProductTitle})
                  </Text>
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 300, overflow: "auto" }}>
                      {productSchemaPreview}
                    </pre>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}
