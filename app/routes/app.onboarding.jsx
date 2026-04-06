import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  ProgressBar,
  Badge,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";

const STEPS = [
  { key: "welcome", label: "Welcome", description: "Learn what AI Discovery Optimizer does for your store." },
  { key: "scan", label: "AI Readiness Scan", description: "Scan your store to see how AI-ready it is." },
  { key: "llms", label: "Generate llms.txt", description: "Create an AI-readable index of your store." },
  { key: "structured", label: "Structured Data", description: "Enable JSON-LD schemas for rich results." },
  { key: "robots", label: "robots.txt", description: "Allow AI crawlers to discover your products." },
];

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const state = await prisma.onboardingState.findUnique({ where: { shop } });
  const completedSteps = state?.completedSteps ? state.completedSteps.split(",").filter(Boolean) : [];

  if (state?.completedAt) {
    return redirect("/app");
  }

  return json({ completedSteps, shop });
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  const { default: prisma } = await import("../db.server");
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  const state = await prisma.onboardingState.upsert({
    where: { shop },
    create: { shop, completedSteps: "" },
    update: {},
  });

  const completedSteps = state.completedSteps ? state.completedSteps.split(",").filter(Boolean) : [];

  if (intent === "complete_step") {
    const step = formData.get("step");
    if (step && !completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    // Handle step-specific actions
    if (step === "scan") {
      // Trigger readiness score calculation
      const { calculateReadinessScore } = await import("../lib/ai-discovery/readiness-score.server");
      try {
        const llmsTxt = await prisma.llmsTxt.findUnique({ where: { shop } });
        const sdConfig = await prisma.structuredDataConfig.findUnique({ where: { shop } });
        const robotsConfig = await prisma.robotsTxtConfig.findUnique({ where: { shop } });
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
        await prisma.aiReadinessScore.upsert({
          where: { shop },
          create: { shop, overallScore: results.overallScore, llmsTxtScore: results.llmsTxtScore, structuredDataScore: results.structuredDataScore, robotsTxtScore: results.robotsTxtScore, faqScore: results.faqScore, contentScore: results.contentScore, metadataScore: results.metadataScore, lastScanAt: new Date() },
          update: { overallScore: results.overallScore, llmsTxtScore: results.llmsTxtScore, structuredDataScore: results.structuredDataScore, robotsTxtScore: results.robotsTxtScore, faqScore: results.faqScore, contentScore: results.contentScore, metadataScore: results.metadataScore, lastScanAt: new Date() },
        });
      } catch (e) {
        // Non-blocking: score will be 0 if scan fails
      }
    }

    if (step === "llms") {
      // Generate llms.txt
      const { fetchStoreData, generateLlmsTxt, generateLlmsFullTxt } = await import("../lib/ai-discovery/llms-txt-generator.server");
      try {
        const storeData = await fetchStoreData(admin);
        const content = generateLlmsTxt(storeData);
        const fullContent = generateLlmsFullTxt(storeData);
        await prisma.llmsTxt.upsert({
          where: { shop },
          create: { shop, content, fullContent },
          update: { content, fullContent, lastSyncAt: new Date() },
        });
      } catch (e) {
        // Non-blocking
      }
    }

    if (step === "structured") {
      // Enable default structured data config
      await prisma.structuredDataConfig.upsert({
        where: { shop },
        create: { shop },
        update: {},
      });
    }

    if (step === "robots") {
      // Enable default robots.txt config (allow all AI crawlers)
      await prisma.robotsTxtConfig.upsert({
        where: { shop },
        create: { shop },
        update: {},
      });
    }

    const isComplete = completedSteps.length >= STEPS.length;

    await prisma.onboardingState.upsert({
      where: { shop },
      create: {
        shop,
        completedSteps: completedSteps.join(","),
        completedAt: isComplete ? new Date() : null,
      },
      update: {
        completedSteps: completedSteps.join(","),
        completedAt: isComplete ? new Date() : null,
      },
    });

    if (isComplete) {
      return redirect("/app");
    }
  }

  if (intent === "skip") {
    // Mark onboarding as complete and go to dashboard
    await prisma.onboardingState.upsert({
      where: { shop },
      create: { shop, completedSteps: completedSteps.join(","), completedAt: new Date() },
      update: { completedAt: new Date() },
    });
    return redirect("/app");
  }

  return json({ completedSteps });
};

export default function OnboardingPage() {
  const { completedSteps } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const currentStepIndex = completedSteps.length;
  const progress = (completedSteps.length / STEPS.length) * 100;
  const currentStep = STEPS[currentStepIndex] || STEPS[STEPS.length - 1];

  function handleCompleteStep(stepKey) {
    const formData = new FormData();
    formData.set("intent", "complete_step");
    formData.set("step", stepKey);
    submit(formData, { method: "POST" });
  }

  function handleSkip() {
    const formData = new FormData();
    formData.set("intent", "skip");
    submit(formData, { method: "POST" });
  }

  return (
    <Page title="Welcome to AI Discovery Optimizer">
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Setup Progress ({completedSteps.length} of {STEPS.length})
            </Text>
            <ProgressBar progress={progress} tone="primary" size="small" />
          </BlockStack>
        </Card>

        <Banner tone="info">
          <p>
            Let's get your store optimized for AI shopping agents. This takes about 2 minutes.
            Each step helps AI assistants like ChatGPT, Perplexity, and Google AI find and recommend your products.
          </p>
        </Banner>

        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = index === currentStepIndex;

          return (
            <Card key={step.key}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      Step {index + 1}: {step.label}
                    </Text>
                    {isCompleted && <Badge tone="success">Done</Badge>}
                    {isCurrent && <Badge tone="attention">Current</Badge>}
                  </InlineStack>
                </InlineStack>

                <Text variant="bodyMd" tone="subdued">{step.description}</Text>

                {isCurrent && (
                  <Box paddingBlockStart="200">
                    <Button
                      variant="primary"
                      loading={isSubmitting}
                      onClick={() => handleCompleteStep(step.key)}
                    >
                      {step.key === "welcome" ? "Get Started" : `Complete: ${step.label}`}
                    </Button>
                  </Box>
                )}
              </BlockStack>
            </Card>
          );
        })}

        <InlineStack align="end">
          <Button variant="plain" onClick={handleSkip}>
            Skip setup and go to dashboard
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
