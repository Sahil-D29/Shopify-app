/**
 * MCP Prompt definitions for Shopify development guidance.
 *
 * These prompts provide AI assistants with context about how
 * to work with Shopify APIs effectively.
 */

export const prompts = [
  {
    name: "shopify_admin_graphql",
    description:
      "Get guidance on writing GraphQL queries and mutations for the Shopify Admin API.",
    arguments: [
      {
        name: "operation",
        description:
          "The type of operation you want to perform (e.g. 'query products', 'create order', 'update inventory').",
        required: true,
      },
    ],
  },
  {
    name: "shopify_app_development",
    description:
      "Get guidance on Shopify app development best practices, including authentication, webhooks, and API usage.",
    arguments: [
      {
        name: "topic",
        description:
          "The development topic (e.g. 'authentication', 'webhooks', 'billing', 'extensions').",
        required: true,
      },
    ],
  },
  {
    name: "shopify_cli_commands",
    description:
      "Get a reference of common Shopify CLI commands for app development.",
    arguments: [],
  },
];

export function handlePromptRequest(name, args = {}) {
  switch (name) {
    case "shopify_admin_graphql":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a Shopify Admin API expert. Help me write a GraphQL operation to: ${args.operation}

Key guidelines:
- Use the Shopify Admin GraphQL API (version 2025-01)
- Always handle pagination with cursor-based connections
- Use proper GID format for resource IDs (gid://shopify/Product/123)
- Include userErrors in mutations for error handling
- Use variables for dynamic values instead of string interpolation
- Follow Shopify's rate limiting best practices (cost-based throttling)

Provide the complete GraphQL query/mutation with variable definitions and an example variables object.`,
            },
          },
        ],
      };

    case "shopify_app_development":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a Shopify app development expert. Help me with: ${args.topic}

Context:
- This is a Shopify Remix app using @shopify/shopify-app-remix
- Authentication is handled via the shopify.server.js module
- The app uses Prisma for session storage
- Shopify CLI is used for development (shopify app dev)
- The app follows embedded app patterns

Provide practical guidance with code examples where appropriate.`,
            },
          },
        ],
      };

    case "shopify_cli_commands":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Common Shopify CLI commands reference:

## App Development
- shopify app dev          — Start local development server
- shopify app build        — Build the app for production
- shopify app deploy       — Deploy the app to Shopify
- shopify app info         — Show current app configuration
- shopify app env show     — Display environment variables
- shopify app env pull     — Pull env vars from Partners dashboard

## Extensions
- shopify app generate extension  — Create a new app extension
- shopify app dev --theme-app-extension-port <port>

## Authentication & Config
- shopify auth logout      — Log out of Shopify Partners
- shopify app config link  — Link to an existing app in Partners

## Theme Development
- shopify theme dev        — Start theme development server
- shopify theme push       — Push theme to store
- shopify theme pull       — Pull theme from store

## Hydrogen
- shopify hydrogen dev     — Start Hydrogen dev server
- shopify hydrogen deploy  — Deploy Hydrogen storefront`,
            },
          },
        ],
      };

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
