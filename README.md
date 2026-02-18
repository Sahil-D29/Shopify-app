# AI Discovery Optimizer for Shopify

Make your Shopify store visible to AI shopping agents — ChatGPT, Perplexity, Google AI Overviews, Claude, and more. AI-referred traffic to retail sites grew **4,700% YoY**. This is SEO for the AI era.

## What It Does

```
┌──────────────────────────────────────────────────────────┐
│              AI Shopping Agents                          │
│  ChatGPT · Perplexity · Google AI · Claude · Cohere     │
└──────┬───────┬───────┬────────┬───────┬─────────────────┘
       │       │       │        │       │
  llms.txt  JSON-LD  robots  FAQs  Keywords
       │       │       │        │       │
┌──────▼───────▼───────▼────────▼───────▼─────────────────┐
│         AI Discovery Optimizer (this app)                │
│                                                          │
│  1. AI Readiness Score (0-100)                           │
│  2. llms.txt / llms-full.txt generator                   │
│  3. Structured Data (JSON-LD Schema.org)                 │
│  4. robots.txt optimizer for AI crawlers                 │
│  5. Conversational FAQ generator                         │
│  6. Keyword & synonym expansion                          │
│  7. Theme extension (auto-injects schemas + FAQs)        │
│  8. MCP server (14 tools for AI assistants)              │
└──────────────────────────────────────────────────────────┘
```

## Features

### AI Readiness Score
Scans your store and produces a 0-100 score across 6 categories: llms.txt, structured data, robots.txt, FAQ coverage, content quality, and metadata quality. Share your score — viral growth built in.

### llms.txt / llms-full.txt Generator
Auto-generates standardized Markdown files (per [llmstxt.org](https://llmstxt.org/)) from your products, collections, and pages. These files let AI agents index your entire catalog in seconds.

### Structured Data (JSON-LD)
Generates Schema.org markup for Product, FAQ, Organization, Breadcrumb, and WebSite/Sitelinks. Stores with proper schema see **30-40% higher AI visibility**.

### robots.txt Optimizer
Configures explicit rules for AI crawlers: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Cohere, and Meta/FacebookBot. Most Shopify stores don't explicitly allow these — you need to.

### Conversational FAQ Generator
Auto-generates natural-language Q&A pairs for every product, collection, and your store. Matches how people ask AI assistants: "What is the best running shoe under $100?" — not "running shoe price".

### Keywords & Synonyms
Expands product terms into synonym sets and conversational search phrases. "Leather wallet" becomes "genuine leather wallet, men's wallet, affordable wallet online, best wallet for everyday use".

### Theme App Extension
Drop-in blocks that inject JSON-LD structured data and FAQ schema into your live storefront. No theme code editing needed.

### MCP Server (14 Tools)
Full Model Context Protocol server so AI assistants (Claude, Cursor, Copilot) can interact with your store:

| Tool | Description |
|------|-------------|
| `list_products` / `get_product` / `create_product` | Product CRUD |
| `list_orders` / `get_order` | Order management |
| `list_customers` / `get_customer` | Customer data |
| `run_graphql` | Arbitrary Admin API queries |
| `generate_llms_txt` | Generate llms.txt + llms-full.txt |
| `generate_product_faq` | Generate conversational FAQs |
| `generate_product_schema` | Generate JSON-LD schema |
| `generate_robots_txt` | Generate AI-optimized robots.txt |
| `generate_keywords` | Generate synonyms + phrases |
| `ai_readiness_audit` | Full store audit with score |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN
```

### 3. Set up database
```bash
npx prisma generate && npx prisma db push
```

### 4. Start development
```bash
shopify app dev
```

### 5. Configure MCP (optional)
```bash
npm run setup
# Or manually:
claude mcp add shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
claude mcp add shopify-store-mcp -- node mcp-server/index.js
```

## Deploy to Shopify Partner Dashboard

1. Create an app in your [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Update `shopify.app.toml` with your `client_id`
3. Run `shopify app deploy` to deploy the app + theme extension
4. Install on any development or production store

## Project Structure

```
├── app/
│   ├── lib/ai-discovery/           # Core AI discovery engine
│   │   ├── llms-txt-generator.server.js
│   │   ├── structured-data-generator.server.js
│   │   ├── robots-txt-generator.server.js
│   │   ├── faq-generator.server.js
│   │   ├── keyword-generator.server.js
│   │   └── readiness-score.server.js
│   ├── routes/
│   │   ├── app._index.jsx          # AI Readiness Score dashboard
│   │   ├── app.llms-txt.jsx        # llms.txt generator page
│   │   ├── app.structured-data.jsx # Structured data config
│   │   ├── app.faqs.jsx            # FAQ generator page
│   │   ├── app.keywords.jsx        # Keywords & synonyms page
│   │   ├── app.robots-txt.jsx      # robots.txt config page
│   │   ├── app.mcp-status.jsx      # MCP server status
│   │   ├── api.llms-txt.js         # Public llms.txt API
│   │   ├── api.structured-data.js  # Public schema API
│   │   └── api.faqs.js             # Public FAQ API
├── extensions/
│   └── ai-discovery-theme/         # Theme app extension
│       ├── blocks/
│       │   ├── structured-data.liquid
│       │   └── conversational-faq.liquid
│       └── shopify.extension.toml
├── mcp-server/                     # MCP server (14 tools)
│   ├── index.js
│   ├── tools.js
│   ├── prompts.js
│   └── shopify-client.js
├── prisma/schema.prisma            # DB schema (7 models)
├── .mcp.json                       # MCP config
├── shopify.app.toml                # Shopify CLI config
└── package.json
```

## Monetization

- **Free tier:** AI Readiness Score (viral sharing)
- **Pro ($79/mo):** llms.txt, structured data, robots.txt, FAQs
- **Enterprise ($149/mo):** Everything + keyword expansion, MCP server, priority support

## Resources

- [llms.txt spec](https://llmstxt.org/)
- [Shopify Dev MCP](https://shopify.dev/docs/apps/build/devmcp)
- [Schema.org Product](https://schema.org/Product)
- [GEO (Generative Engine Optimization)](https://backlinko.com/generative-engine-optimization-geo)
