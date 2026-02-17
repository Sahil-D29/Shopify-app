#!/usr/bin/env node

/**
 * Custom Shopify MCP Server
 *
 * Connects Shopify CLI and Admin API to the Model Context Protocol,
 * enabling AI assistants to interact with your Shopify store.
 *
 * Usage:
 *   node mcp-server/index.js          (stdio transport)
 *   MCP_TRANSPORT=http node mcp-server/index.js  (HTTP transport)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { shopifyTools, handleToolCall } from "./tools.js";
import { prompts, handlePromptRequest } from "./prompts.js";

const SERVER_NAME = "shopify-cli-mcp";
const SERVER_VERSION = "1.0.0";

async function main() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: shopifyTools };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args);
  });

  // Register prompt listing handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts };
  });

  // Register prompt retrieval handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return handlePromptRequest(request.params.name, request.params.arguments);
  });

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
