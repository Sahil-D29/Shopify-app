import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  List,
  Link,
  Banner,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Fetch shop info to verify connection
  const response = await admin.graphql(`
    {
      shop {
        name
        myshopifyDomain
        plan {
          displayName
        }
      }
    }
  `);

  const { data } = await response.json();

  return json({
    shop: data.shop,
  });
};

export default function Index() {
  const { shop } = useLoaderData();

  return (
    <Page title="Shopify CLI + MCP Integration">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Banner title="Connected" tone="success">
              <p>
                Your app is connected to <strong>{shop.name}</strong> (
                {shop.myshopifyDomain}).
              </p>
            </Banner>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  MCP Server Integration
                </Text>
                <Text as="p">
                  This app integrates with the Shopify Dev MCP server,
                  enabling AI assistants to interact with your Shopify store
                  through the Model Context Protocol.
                </Text>
                <Text as="h3" variant="headingSm">
                  Available MCP Tools:
                </Text>
                <List>
                  <List.Item>
                    <strong>search_dev_docs</strong> — Search Shopify developer
                    documentation
                  </List.Item>
                  <List.Item>
                    <strong>introspect_admin_schema</strong> — Explore GraphQL
                    Admin API schema
                  </List.Item>
                  <List.Item>
                    <strong>manage_products</strong> — Create, update, and query
                    products
                  </List.Item>
                  <List.Item>
                    <strong>manage_orders</strong> — Read and manage orders
                  </List.Item>
                  <List.Item>
                    <strong>manage_customers</strong> — Access customer data
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick Start
                </Text>
                <Text as="p">
                  Run <code>npm run mcp:start</code> to launch the Shopify Dev
                  MCP server, or <code>npm run mcp:dev</code> for the custom
                  MCP server with store-specific tools.
                </Text>
                <Text as="p">
                  See the{" "}
                  <Link url="https://shopify.dev/docs/apps/build/devmcp" external>
                    Shopify Dev MCP docs
                  </Link>{" "}
                  for more information.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
