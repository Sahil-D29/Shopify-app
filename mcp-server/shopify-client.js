/**
 * Shopify Admin API client for MCP server tools.
 *
 * Reads credentials from environment variables and provides
 * a thin wrapper around the GraphQL and REST Admin APIs.
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2025-01";

function getBaseUrl() {
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error(
      "SHOPIFY_STORE_DOMAIN is not set. Add it to your .env file."
    );
  }
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}`;
}

function getHeaders() {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error(
      "SHOPIFY_ACCESS_TOKEN is not set. Add it to your .env file."
    );
  }
  return {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
  };
}

/**
 * Execute a GraphQL query against the Shopify Admin API.
 */
export async function graphqlQuery(query, variables = {}) {
  const url = `${getBaseUrl()}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify GraphQL error (${response.status}): ${text}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      `Shopify GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`
    );
  }

  return json.data;
}

/**
 * Execute a REST API request against the Shopify Admin API.
 */
export async function restRequest(method, endpoint, body = null) {
  const url = `${getBaseUrl()}/${endpoint}`;

  const options = {
    method,
    headers: getHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify REST error (${response.status}): ${text}`);
  }

  return response.json();
}

/**
 * Check whether the client is properly configured.
 */
export function isConfigured() {
  return Boolean(SHOPIFY_STORE_DOMAIN && SHOPIFY_ACCESS_TOKEN);
}
