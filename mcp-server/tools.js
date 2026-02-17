/**
 * MCP Tool definitions and handlers for Shopify store operations.
 *
 * Each tool maps to a Shopify Admin API operation and is exposed
 * to AI assistants via the Model Context Protocol.
 */

import { graphqlQuery, restRequest, isConfigured } from "./shopify-client.js";

// ---------------------------------------------------------------------------
// Tool definitions (schema)
// ---------------------------------------------------------------------------

export const shopifyTools = [
  {
    name: "list_products",
    description:
      "List products in the Shopify store. Returns title, ID, status, and variant pricing.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of products to return (default 10, max 50).",
        },
        query: {
          type: "string",
          description:
            "Optional search query to filter products (e.g. 'title:boots' or 'tag:sale').",
        },
      },
    },
  },
  {
    name: "get_product",
    description:
      "Get detailed information about a single product by its numeric or GID ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Product ID — numeric (e.g. '123456') or GID (e.g. 'gid://shopify/Product/123456').",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_product",
    description: "Create a new product in the Shopify store.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Product title." },
        description: { type: "string", description: "Product description (HTML allowed)." },
        vendor: { type: "string", description: "Product vendor." },
        product_type: { type: "string", description: "Product type." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "List of tags for the product.",
        },
        price: { type: "string", description: "Price for the default variant." },
      },
      required: ["title"],
    },
  },
  {
    name: "list_orders",
    description:
      "List recent orders in the Shopify store with financial and fulfillment status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of orders to return (default 10, max 50).",
        },
        status: {
          type: "string",
          enum: ["any", "open", "closed", "cancelled"],
          description: "Filter by order status (default 'any').",
        },
      },
    },
  },
  {
    name: "get_order",
    description: "Get detailed information about a single order.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Order ID — numeric or GID.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_customers",
    description: "List customers in the Shopify store.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of customers to return (default 10, max 50).",
        },
        query: {
          type: "string",
          description: "Optional search query to filter customers.",
        },
      },
    },
  },
  {
    name: "get_customer",
    description: "Get detailed information about a single customer.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Customer ID — numeric or GID.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "run_graphql",
    description:
      "Execute an arbitrary GraphQL query or mutation against the Shopify Admin API.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The GraphQL query or mutation string.",
        },
        variables: {
          type: "object",
          description: "Optional variables for the GraphQL operation.",
        },
      },
      required: ["query"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

function ensureGid(id, resource) {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/${resource}/${id}`;
}

async function listProducts({ limit = 10, query = "" }) {
  const q = query ? `, query: "${query}"` : "";
  const data = await graphqlQuery(`
    {
      products(first: ${Math.min(limit, 50)}${q}) {
        edges {
          node {
            id
            title
            status
            totalInventory
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            featuredImage { url altText }
          }
        }
      }
    }
  `);
  return data.products.edges.map((e) => e.node);
}

async function getProduct({ id }) {
  const gid = ensureGid(id, "Product");
  const data = await graphqlQuery(`
    {
      product(id: "${gid}") {
        id
        title
        descriptionHtml
        status
        vendor
        productType
        tags
        totalInventory
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryQuantity
            }
          }
        }
        images(first: 5) {
          edges {
            node { url altText }
          }
        }
      }
    }
  `);
  return data.product;
}

async function createProduct({ title, description, vendor, product_type, tags, price }) {
  const input = { title };
  if (description) input.descriptionHtml = description;
  if (vendor) input.vendor = vendor;
  if (product_type) input.productType = product_type;
  if (tags) input.tags = tags;

  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await graphqlQuery(mutation, { input });

  if (data.productCreate.userErrors.length > 0) {
    throw new Error(
      `Failed to create product: ${JSON.stringify(data.productCreate.userErrors)}`
    );
  }

  return data.productCreate.product;
}

async function listOrders({ limit = 10, status = "any" }) {
  const filter = status !== "any" ? `, query: "status:${status}"` : "";
  const data = await graphqlQuery(`
    {
      orders(first: ${Math.min(limit, 50)}${filter}) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
            customer {
              displayName
              email
            }
          }
        }
      }
    }
  `);
  return data.orders.edges.map((e) => e.node);
}

async function getOrder({ id }) {
  const gid = ensureGid(id, "Order");
  const data = await graphqlQuery(`
    {
      order(id: "${gid}") {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney { amount currencyCode }
        }
        customer {
          displayName
          email
        }
        lineItems(first: 20) {
          edges {
            node {
              title
              quantity
              originalTotalSet {
                shopMoney { amount currencyCode }
              }
            }
          }
        }
        shippingAddress {
          formatted
        }
      }
    }
  `);
  return data.order;
}

async function listCustomers({ limit = 10, query = "" }) {
  const q = query ? `, query: "${query}"` : "";
  const data = await graphqlQuery(`
    {
      customers(first: ${Math.min(limit, 50)}${q}) {
        edges {
          node {
            id
            displayName
            email
            phone
            ordersCount
            totalSpentV2 { amount currencyCode }
          }
        }
      }
    }
  `);
  return data.customers.edges.map((e) => e.node);
}

async function getCustomer({ id }) {
  const gid = ensureGid(id, "Customer");
  const data = await graphqlQuery(`
    {
      customer(id: "${gid}") {
        id
        displayName
        email
        phone
        ordersCount
        totalSpentV2 { amount currencyCode }
        addresses {
          formatted
        }
        tags
      }
    }
  `);
  return data.customer;
}

async function runGraphql({ query, variables = {} }) {
  return graphqlQuery(query, variables);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const handlers = {
  list_products: listProducts,
  get_product: getProduct,
  create_product: createProduct,
  list_orders: listOrders,
  get_order: getOrder,
  list_customers: listCustomers,
  get_customer: getCustomer,
  run_graphql: runGraphql,
};

export async function handleToolCall(name, args) {
  if (!isConfigured()) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Shopify credentials are not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in your .env file.",
        },
      ],
      isError: true,
    };
  }

  const handler = handlers[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
