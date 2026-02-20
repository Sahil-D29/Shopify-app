import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);

  // Check MCP server configurations
  const mcpServers = [
    {
      name: "Shopify Dev MCP",
      description:
        "Official Shopify Dev MCP server — search docs, explore API schemas, and get development guidance.",
      command: "npx -y @shopify/dev-mcp@latest",
      type: "official",
      tools: [
        "search_dev_docs",
        "introspect_admin_schema",
        "shopify_admin_graphql",
      ],
    },
    {
      name: "Custom Store MCP",
      description:
        "Custom MCP server for store-specific operations — manage products, orders, and customers.",
      command: "node mcp-server/index.js",
      type: "custom",
      tools: [
        "list_products",
        "get_product",
        "create_product",
        "list_orders",
        "get_order",
        "list_customers",
        "get_customer",
        "run_graphql",
      ],
    },
  ];

  return json({ mcpServers });
};

export default function McpStatus() {
  const { mcpServers } = useLoaderData();

  return (
    <Page title="MCP Server Status" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Layout>
          {mcpServers.map((server) => (
            <Layout.Section key={server.name}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      {server.name}
                    </Text>
                    <Badge tone={server.type === "official" ? "info" : "success"}>
                      {server.type}
                    </Badge>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    {server.description}
                  </Text>
                  <Divider />
                  <Text as="h3" variant="headingSm">
                    Command
                  </Text>
                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text as="p" fontFamily="mono">
                      {server.command}
                    </Text>
                  </Box>
                  <Text as="h3" variant="headingSm">
                    Available Tools
                  </Text>
                  <InlineStack gap="200" wrap>
                    {server.tools.map((tool) => (
                      <Badge key={tool}>{tool}</Badge>
                    ))}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>
      </BlockStack>
    </Page>
  );
}
