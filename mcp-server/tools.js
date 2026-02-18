/**
 * MCP Tool definitions and handlers for Shopify store operations
 * + AI Discovery Optimization tools.
 */

import { graphqlQuery, isConfigured } from "./shopify-client.js";

export const shopifyTools = [
  // === Store Management Tools ===
  {
    name: "list_products",
    description: "List products in the Shopify store.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max products (default 10, max 50)." },
        query: { type: "string", description: "Search query (e.g. 'title:boots')." },
      },
    },
  },
  {
    name: "get_product",
    description: "Get detailed product info by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Product ID (numeric or GID)." } },
      required: ["id"],
    },
  },
  {
    name: "create_product",
    description: "Create a new product.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" }, description: { type: "string" },
        vendor: { type: "string" }, product_type: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
    },
  },
  {
    name: "list_orders",
    description: "List recent orders.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        status: { type: "string", enum: ["any", "open", "closed", "cancelled"] },
      },
    },
  },
  {
    name: "get_order",
    description: "Get order details by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_customers",
    description: "List customers.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, query: { type: "string" } } },
  },
  {
    name: "get_customer",
    description: "Get customer details by ID.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "run_graphql",
    description: "Execute arbitrary GraphQL against Shopify Admin API.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, variables: { type: "object" } },
      required: ["query"],
    },
  },

  // === AI Discovery Optimization Tools ===
  {
    name: "generate_llms_txt",
    description: "Generate llms.txt and llms-full.txt content so AI agents (ChatGPT, Perplexity, Google AI) can discover and index the store.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_product_faq",
    description: "Generate conversational FAQ entries for a product. AI agents prioritize stores with Q&A content.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string", description: "Product ID." } },
      required: ["product_id"],
    },
  },
  {
    name: "generate_product_schema",
    description: "Generate JSON-LD Schema.org structured data for a product. Boosts AI visibility 30-40%.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string", description: "Product ID." } },
      required: ["product_id"],
    },
  },
  {
    name: "generate_robots_txt",
    description: "Generate optimized robots.txt allowing AI crawlers (GPTBot, ClaudeBot, PerplexityBot) to index products.",
    inputSchema: {
      type: "object",
      properties: {
        allow_gptbot: { type: "boolean", description: "Allow ChatGPT (default true)." },
        allow_claudebot: { type: "boolean", description: "Allow Claude (default true)." },
        allow_perplexitybot: { type: "boolean", description: "Allow Perplexity (default true)." },
      },
    },
  },
  {
    name: "generate_keywords",
    description: "Generate keyword synonyms and conversational search phrases for a product.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string", description: "Product ID." } },
      required: ["product_id"],
    },
  },
  {
    name: "ai_readiness_audit",
    description: "Run AI readiness audit — returns issues and recommendations for improving AI discovery.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureGid(id, resource) {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/${resource}/${id}`;
}

async function fetchShopInfo() {
  return graphqlQuery(`{
    shop {
      name description myshopifyDomain currencyCode contactEmail
      primaryDomain { url host }
      brand { shortDescription slogan }
      shipsToCountries
    }
  }`);
}

// ---------------------------------------------------------------------------
// Store handlers
// ---------------------------------------------------------------------------
async function listProducts({ limit = 10, query = "" }) {
  const q = query ? `, query: "${query}"` : "";
  const data = await graphqlQuery(`{ products(first: ${Math.min(limit, 50)}${q}) { edges { node { id title status totalInventory priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } } featuredImage { url altText } } } } }`);
  return data.products.edges.map((e) => e.node);
}

async function getProduct({ id }) {
  const gid = ensureGid(id, "Product");
  const data = await graphqlQuery(`{ product(id: "${gid}") { id title descriptionHtml description status vendor productType tags totalInventory handle priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } } featuredImage { url altText } variants(first: 10) { edges { node { id title price sku inventoryQuantity availableForSale } } } images(first: 5) { edges { node { url altText } } } } }`);
  return data.product;
}

async function createProduct({ title, description, vendor, product_type, tags }) {
  const input = { title };
  if (description) input.descriptionHtml = description;
  if (vendor) input.vendor = vendor;
  if (product_type) input.productType = product_type;
  if (tags) input.tags = tags;
  const data = await graphqlQuery(`mutation productCreate($input: ProductInput!) { productCreate(input: $input) { product { id title status } userErrors { field message } } }`, { input });
  if (data.productCreate.userErrors.length > 0) throw new Error(JSON.stringify(data.productCreate.userErrors));
  return data.productCreate.product;
}

async function listOrders({ limit = 10, status = "any" }) {
  const filter = status !== "any" ? `, query: "status:${status}"` : "";
  const data = await graphqlQuery(`{ orders(first: ${Math.min(limit, 50)}${filter}) { edges { node { id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } customer { displayName email } } } } }`);
  return data.orders.edges.map((e) => e.node);
}

async function getOrder({ id }) {
  const gid = ensureGid(id, "Order");
  const data = await graphqlQuery(`{ order(id: "${gid}") { id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } customer { displayName email } lineItems(first: 20) { edges { node { title quantity originalTotalSet { shopMoney { amount currencyCode } } } } } shippingAddress { formatted } } }`);
  return data.order;
}

async function listCustomers({ limit = 10, query = "" }) {
  const q = query ? `, query: "${query}"` : "";
  const data = await graphqlQuery(`{ customers(first: ${Math.min(limit, 50)}${q}) { edges { node { id displayName email phone ordersCount totalSpentV2 { amount currencyCode } } } } }`);
  return data.customers.edges.map((e) => e.node);
}

async function getCustomer({ id }) {
  const gid = ensureGid(id, "Customer");
  const data = await graphqlQuery(`{ customer(id: "${gid}") { id displayName email phone ordersCount totalSpentV2 { amount currencyCode } addresses { formatted } tags } }`);
  return data.customer;
}

async function runGraphql({ query, variables = {} }) {
  return graphqlQuery(query, variables);
}

// ---------------------------------------------------------------------------
// AI Discovery handlers
// ---------------------------------------------------------------------------
async function generateLlmsTxtTool() {
  const shopData = await fetchShopInfo();
  const shop = shopData.shop;
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;

  const productsData = await graphqlQuery(`{ products(first: 100, query: "status:active") { edges { node { title handle description productType vendor tags priceRangeV2 { minVariantPrice { amount currencyCode } } totalInventory variants(first: 5) { edges { node { title price availableForSale } } } } } } }`);
  const products = productsData.products.edges.map((e) => e.node);

  const colData = await graphqlQuery(`{ collections(first: 50) { edges { node { title handle description productsCount { count } } } } }`);
  const collections = colData.collections.edges.map((e) => e.node);

  // llms.txt (index)
  let llmsTxt = `# ${shop.name}\n\n`;
  llmsTxt += `> ${shop.description || shop.name}. ${products.length} products, ${collections.length} collections. Currency: ${shop.currencyCode}.\n\n`;

  if (collections.length > 0) {
    llmsTxt += `## Collections\n\n`;
    for (const c of collections) llmsTxt += `- [${c.title}](${domain}/collections/${c.handle})\n`;
    llmsTxt += "\n";
  }

  llmsTxt += `## Products\n\n`;
  for (const p of products.slice(0, 50)) {
    const pr = p.priceRangeV2?.minVariantPrice;
    llmsTxt += `- [${p.title}](${domain}/products/${p.handle})${pr ? ` — ${pr.currencyCode} ${pr.amount}` : ""}\n`;
  }
  if (products.length > 50) llmsTxt += `- ... and ${products.length - 50} more\n`;

  // llms-full.txt (complete)
  let full = `# ${shop.name}\n\n> ${shop.description || shop.name}\n\n## About\n\n${shop.name} at ${domain}. ${products.length} products in ${collections.length} collections. Currency: ${shop.currencyCode}.\n\n`;

  full += `## Products\n\n`;
  for (const p of products) {
    const desc = p.description?.replace(/<[^>]*>/g, "").trim() || "";
    const pr = p.priceRangeV2?.minVariantPrice;
    full += `### ${p.title}\n\n${desc ? desc + "\n\n" : ""}`;
    full += `- URL: ${domain}/products/${p.handle}\n`;
    if (p.vendor) full += `- Brand: ${p.vendor}\n`;
    if (p.productType) full += `- Category: ${p.productType}\n`;
    if (pr) full += `- Price: ${pr.currencyCode} ${pr.amount}\n`;
    if (p.tags?.length) full += `- Tags: ${p.tags.join(", ")}\n`;
    full += `- In Stock: ${p.totalInventory > 0 ? "Yes" : "No"}\n\n`;
  }

  return { llms_txt: llmsTxt, llms_full_txt: full, product_count: products.length, collection_count: collections.length };
}

async function generateProductFaqTool({ product_id }) {
  const product = await getProduct({ id: product_id });
  const shopData = await fetchShopInfo();
  const shop = shopData.shop;
  const title = product.title;
  const vendor = product.vendor;
  const type = product.productType;
  const minPrice = product.priceRangeV2?.minVariantPrice;
  const desc = product.description?.replace(/<[^>]*>/g, "").trim() || "";
  const inStock = product.totalInventory > 0;

  return {
    product: title,
    faqs: [
      { q: `What is the ${title}?`, a: `${title}${vendor ? ` by ${vendor}` : ""} is ${type ? `a ${type}` : "a product"} at ${shop.name}. ${desc.slice(0, 300)}`, keywords: `${title}, ${vendor || ""}, ${type || ""}`.replace(/, $/,"") },
      { q: `How much does the ${title} cost?`, a: minPrice ? `${minPrice.currencyCode} ${minPrice.amount}.` : "Contact us for pricing.", keywords: `${title} price, ${title} cost` },
      { q: `Is the ${title} in stock?`, a: inStock ? `Yes, in stock at ${shop.name}.` : `Currently out of stock.`, keywords: `${title} availability, buy ${title}` },
      { q: `Who makes the ${title}?`, a: vendor ? `Made by ${vendor}.` : "See product page for details.", keywords: `${title} brand, ${vendor || ""} products` },
      { q: `Is the ${title} a good ${type || "product"}?`, a: `${title} is a popular choice at ${shop.name}. ${desc.slice(0, 200)}`, keywords: `best ${type || "product"}, ${title} review, recommended` },
      { q: `Does ${shop.name} ship the ${title}?`, a: `Yes, we ship${shop.shipsToCountries?.length ? ` to ${shop.shipsToCountries.length} countries` : ""}.`, keywords: `${title} shipping, ${title} delivery` },
    ],
  };
}

async function generateProductSchemaTool({ product_id }) {
  const product = await getProduct({ id: product_id });
  const shopData = await fetchShopInfo();
  const shop = shopData.shop;
  const domain = shop.primaryDomain?.url || `https://${shop.myshopifyDomain}`;
  const variants = product.variants?.edges?.map((e) => e.node) || [];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description?.replace(/<[^>]*>/g, "").slice(0, 5000),
    url: `${domain}/products/${product.handle}`,
    brand: product.vendor ? { "@type": "Brand", name: product.vendor } : undefined,
    category: product.productType || undefined,
    image: product.featuredImage?.url || undefined,
    keywords: product.tags?.join(", ") || undefined,
    offers: variants.map((v) => ({
      "@type": "Offer",
      price: v.price,
      priceCurrency: product.priceRangeV2?.minVariantPrice?.currencyCode || shop.currencyCode,
      availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };
}

async function generateRobotsTxtTool({ allow_gptbot = true, allow_claudebot = true, allow_perplexitybot = true }) {
  const blocked = ["/admin", "/cart", "/checkout", "/account", "/orders"];
  const allowed = ["/products/*", "/collections/*", "/pages/*", "/blogs/*", "/policies/*", "/llms.txt", "/llms-full.txt"];

  const crawlers = [
    { ua: "GPTBot", allow: allow_gptbot },
    { ua: "ChatGPT-User", allow: allow_gptbot },
    { ua: "ClaudeBot", allow: allow_claudebot },
    { ua: "PerplexityBot", allow: allow_perplexitybot },
    { ua: "Google-Extended", allow: true },
    { ua: "cohere-ai", allow: true },
    { ua: "FacebookBot", allow: true },
  ];

  let txt = "# AI-Optimized robots.txt\n\nUser-agent: *\n";
  for (const p of allowed) txt += `Allow: ${p}\n`;
  for (const p of blocked) txt += `Disallow: ${p}\n`;
  txt += "\n";
  for (const c of crawlers) {
    txt += `User-agent: ${c.ua}\n`;
    if (c.allow) { for (const p of allowed) txt += `Allow: ${p}\n`; for (const p of blocked) txt += `Disallow: ${p}\n`; }
    else txt += "Disallow: /\n";
    txt += "\n";
  }
  return { robots_txt: txt };
}

async function generateKeywordsTool({ product_id }) {
  const product = await getProduct({ id: product_id });
  const type = product.productType?.toLowerCase() || "product";
  const tags = product.tags || [];
  const vendor = product.vendor || "";

  return {
    product: product.title,
    synonyms: [...new Set([...tags, type, vendor, `${vendor} ${type}`.trim()].filter(Boolean))],
    conversational_phrases: [
      `best ${type} for everyday use`, `where to buy ${product.title}`,
      `is ${product.title} worth it`, `affordable ${type} online`,
      `top rated ${type}`, `${product.title} vs alternatives`,
      `recommended ${type}`, `compare ${product.title}`, `${product.title} review`,
      `best ${type} for beginners`, `${type} under $${Math.ceil(parseFloat(product.priceRangeV2?.minVariantPrice?.amount || "100"))}`,
    ],
  };
}

async function aiReadinessAuditTool() {
  const shopData = await fetchShopInfo();
  const shop = shopData.shop;

  const pData = await graphqlQuery(`{ products(first: 50, query: "status:active") { edges { node { title description productType vendor tags seo { title description } featuredImage { url } } } } }`);
  const products = pData.products.edges.map((e) => e.node);

  const issues = [];
  const recs = [];
  let score = 0;

  // Store-level checks
  if (shop.description) score += 5; else { issues.push("No store description"); recs.push("Add a store description"); }
  if (shop.brand?.shortDescription) score += 5; else recs.push("Add brand short description");
  if (shop.contactEmail) score += 2;

  // Product-level checks
  let thinDesc = 0, noType = 0, noTags = 0, noSeo = 0, noImage = 0;
  for (const p of products) {
    if ((p.description?.replace(/<[^>]*>/g, "") || "").length < 50) thinDesc++;
    if (!p.productType) noType++;
    if (!p.tags?.length) noTags++;
    if (!p.seo?.title && !p.seo?.description) noSeo++;
    if (!p.featuredImage?.url) noImage++;
  }

  if (products.length > 0) {
    score += Math.round((1 - thinDesc / products.length) * 20);
    score += Math.round((1 - noType / products.length) * 10);
    score += Math.round((1 - noTags / products.length) * 10);
    score += Math.round((1 - noSeo / products.length) * 10);
    score += Math.round((1 - noImage / products.length) * 8);
  }

  if (thinDesc > 0) issues.push(`${thinDesc}/${products.length} products have thin descriptions`);
  if (noType > 0) recs.push(`Add product type to ${noType} products`);
  if (noTags > 0) recs.push(`Add tags to ${noTags} products`);
  if (noSeo > 0) recs.push(`Add SEO meta to ${noSeo} products`);
  if (noImage > 0) recs.push(`Add images to ${noImage} products`);

  recs.push("Generate llms.txt + llms-full.txt (use generate_llms_txt tool)");
  recs.push("Configure robots.txt for AI crawlers (use generate_robots_txt tool)");
  recs.push("Generate FAQs for products (use generate_product_faq tool)");
  recs.push("Add JSON-LD structured data (use generate_product_schema tool)");

  const grade = score >= 60 ? "B+" : score >= 40 ? "C" : score >= 20 ? "D" : "F";
  return { score, grade, total_products: products.length, issues, recommendations: recs };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
const handlers = {
  list_products: listProducts, get_product: getProduct, create_product: createProduct,
  list_orders: listOrders, get_order: getOrder,
  list_customers: listCustomers, get_customer: getCustomer,
  run_graphql: runGraphql,
  generate_llms_txt: generateLlmsTxtTool,
  generate_product_faq: generateProductFaqTool,
  generate_product_schema: generateProductSchemaTool,
  generate_robots_txt: generateRobotsTxtTool,
  generate_keywords: generateKeywordsTool,
  ai_readiness_audit: aiReadinessAuditTool,
};

export async function handleToolCall(name, args) {
  if (!isConfigured()) {
    return { content: [{ type: "text", text: "Error: Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env." }], isError: true };
  }
  const handler = handlers[name];
  if (!handler) return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  try {
    const result = await handler(args || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
