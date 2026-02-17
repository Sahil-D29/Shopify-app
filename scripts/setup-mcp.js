#!/usr/bin/env node

/**
 * Setup script for Shopify CLI + MCP integration.
 *
 * Generates MCP client configuration for popular AI tools:
 *   - Claude Code / Claude Desktop
 *   - Cursor
 *   - VS Code (Copilot)
 *
 * Usage:
 *   node scripts/setup-mcp.js
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

// MCP server definitions shared across all tools
const mcpServers = {
  "shopify-dev-mcp": {
    command: "npx",
    args: ["-y", "@shopify/dev-mcp@latest"],
  },
  "shopify-store-mcp": {
    command: "node",
    args: [join(PROJECT_ROOT, "mcp-server", "index.js")],
    env: {
      SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN || "",
      SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN || "",
    },
  },
};

function setupClaudeDesktop() {
  const configDir =
    process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support", "Claude")
      : process.platform === "win32"
        ? join(homedir(), "AppData", "Roaming", "Claude")
        : join(homedir(), ".config", "claude");

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const configPath = join(configDir, "claude_desktop_config.json");
  let existing = {};

  try {
    const raw = await import("fs").then((fs) =>
      fs.readFileSync(configPath, "utf-8")
    );
    existing = JSON.parse(raw);
  } catch {
    // File doesn't exist yet
  }

  const config = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers || {}),
      ...mcpServers,
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Claude Desktop config written to: ${configPath}`);
}

function setupCursor() {
  const cursorDir = join(PROJECT_ROOT, ".cursor");
  if (!existsSync(cursorDir)) {
    mkdirSync(cursorDir, { recursive: true });
  }

  const config = { mcpServers };
  const configPath = join(cursorDir, "mcp.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Cursor MCP config written to: ${configPath}`);
}

function setupVSCode() {
  const vscodeDir = join(PROJECT_ROOT, ".vscode");
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  const config = {
    "mcp.servers": mcpServers,
  };

  const configPath = join(vscodeDir, "mcp.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`VS Code MCP config written to: ${configPath}`);
}

function printSummary() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║        Shopify CLI + MCP Setup Complete              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  MCP Servers configured:                             ║
║                                                      ║
║  1. shopify-dev-mcp (Official)                       ║
║     Search docs, explore API schemas,                ║
║     get development guidance.                        ║
║                                                      ║
║  2. shopify-store-mcp (Custom)                       ║
║     Manage products, orders, customers               ║
║     via your store's Admin API.                      ║
║                                                      ║
║  Next steps:                                         ║
║  • Set SHOPIFY_STORE_DOMAIN in .env                  ║
║  • Set SHOPIFY_ACCESS_TOKEN in .env                  ║
║  • Run: shopify app dev                              ║
║  • In your AI tool, try asking about                 ║
║    Shopify APIs or managing products.                ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
}

console.log("Setting up Shopify CLI + MCP integration...\n");

// Write project-level .mcp.json (already exists, but regenerate with absolute paths)
const projectConfig = { mcpServers };
writeFileSync(
  join(PROJECT_ROOT, ".mcp.json"),
  JSON.stringify(projectConfig, null, 2)
);
console.log(`Project MCP config written to: ${join(PROJECT_ROOT, ".mcp.json")}`);

setupCursor();
setupVSCode();

try {
  setupClaudeDesktop();
} catch (err) {
  console.log(
    `Note: Could not write Claude Desktop config (${err.message}). You can configure it manually.`
  );
}

printSummary();
