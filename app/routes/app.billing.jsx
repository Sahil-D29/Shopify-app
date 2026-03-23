import { json, redirect } from "@remix-run/node";
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
  Box,
  Divider,
  Icon,
  List,
} from "@shopify/polaris";
export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { PLANS, getShopPlan, ensureShopPlan } = await import("../lib/billing.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  await ensureShopPlan(prisma, shop);
  const currentPlan = await getShopPlan(prisma, shop);

  const url = new URL(request.url);
  const requiredPlan = url.searchParams.get("required");

  return json({ currentPlan, requiredPlan, shop, plans: PLANS });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { PLANS } = await import("../lib/billing.server");
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const selectedPlan = formData.get("plan");

  if (intent === "subscribe" && selectedPlan) {
    if (selectedPlan === "Free") {
      // Downgrade to free - cancel active subscription
      await prisma.shopPlan.upsert({
        where: { shop },
        create: { shop, plan: "Free" },
        update: { plan: "Free", chargeId: null },
      });
      return redirect("/app");
    }

    const planConfig = PLANS[selectedPlan];
    if (!planConfig || planConfig.amount === 0) {
      return json({ error: "Invalid plan" }, { status: 400 });
    }

    // Create Shopify billing charge
    await billing.require({
      plans: [selectedPlan],
      isTest: true, // Set to false for production
      onFailure: async () => {
        // User declined - stay on billing page
        return redirect("/app/billing");
      },
    });

    // If we get here, the charge was accepted
    await prisma.shopPlan.upsert({
      where: { shop },
      create: { shop, plan: selectedPlan, activatedAt: new Date() },
      update: { plan: selectedPlan, activatedAt: new Date() },
    });

    return redirect("/app");
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

const planFeatures = {
  Free: [
    "AI Readiness Score",
    "Basic llms.txt generation",
    "Product & Organization schemas",
    "Up to 10 FAQs",
    "Keywords for 5 products",
    "robots.txt configuration",
    "SEO audit (5 products)",
  ],
  Pro: [
    "Everything in Free, plus:",
    "All 6 structured data types",
    "Unlimited FAQs",
    "Unlimited keyword products",
    "Full SEO audit",
    "Meta title/description optimizer",
    "Image alt text audit & editor",
    "Content quality analysis",
  ],
  Enterprise: [
    "Everything in Pro, plus:",
    "GEO Optimizer (AI search visibility)",
    "AI Search Preview simulator",
    "Citation snippet generator",
    "MCP Server for AI assistants",
    "Priority support",
  ],
};

export default function BillingPage() {
  const { currentPlan, requiredPlan, plans } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  function handleSelectPlan(plan) {
    const formData = new FormData();
    formData.set("intent", "subscribe");
    formData.set("plan", plan);
    submit(formData, { method: "POST" });
  }

  return (
    <Page title="Plans & Billing" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {requiredPlan && (
          <Banner tone="warning">
            <p>
              This feature requires the <strong>{requiredPlan}</strong> plan or higher.
              Upgrade to unlock it.
            </p>
          </Banner>
        )}

        <Layout>
          {Object.entries(plans).map(([key, plan]) => (
            <Layout.Section key={key} variant="oneThird">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingLg" as="h2">{plan.name}</Text>
                    {currentPlan === key && (
                      <Badge tone="success">Current</Badge>
                    )}
                  </InlineStack>

                  <Text variant="heading2xl" as="p">
                    {plan.amount === 0 ? "Free" : `$${plan.amount}`}
                    {plan.amount > 0 && (
                      <Text variant="bodyMd" as="span" tone="subdued"> /month</Text>
                    )}
                  </Text>

                  <Divider />

                  <List>
                    {planFeatures[key].map((feature, i) => (
                      <List.Item key={i}>{feature}</List.Item>
                    ))}
                  </List>

                  <Box paddingBlockStart="200">
                    {currentPlan === key ? (
                      <Button disabled fullWidth>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        variant={key === "Pro" ? "primary" : undefined}
                        fullWidth
                        loading={isSubmitting}
                        onClick={() => handleSelectPlan(key)}
                      >
                        {plans[key].amount > plans[currentPlan]?.amount
                          ? `Upgrade to ${key}`
                          : `Switch to ${key}`}
                      </Button>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>
      </BlockStack>
    </Page>
  );
}
