/**
 * Helpers to install/uninstall the AI Discovery Optimizer structured-data
 * snippet into the merchant's published (main) theme using the Shopify
 * Admin GraphQL `themeFiles` APIs.
 */

export const SNIPPET_FILENAME = "snippets/ai-discovery-schemas.liquid";
const LAYOUT_FILENAME = "layout/theme.liquid";
const INJECT_TAG = "{% render 'ai-discovery-schemas' %}";
const INJECT_MARKER_START = "<!-- AI Discovery Optimizer: structured data -->";
const INJECT_MARKER_END = "<!-- /AI Discovery Optimizer -->";

const SNIPPET_CONTENT = `{%- comment -%}
  AI Discovery Optimizer — JSON-LD structured data
  Managed by the AI Discovery Optimizer app. Do not edit manually.
{%- endcomment -%}

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": {{ shop.name | json }},
  "url": {{ shop.url | json }}
  {%- if shop.email %},"email": {{ shop.email | json }}{% endif -%}
  {%- if shop.brand.logo %},"logo": {{ shop.brand.logo | image_url: width: 600 | prepend: 'https:' | json }}{% endif -%}
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": {{ shop.name | json }},
  "url": {{ shop.url | json }},
  "potentialAction": {
    "@type": "SearchAction",
    "target": "{{ shop.url }}/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>

{%- if template contains 'product' and product -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | truncatewords: 50 | json }},
  {%- if product.selected_or_first_available_variant.sku != blank %}
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  {%- endif %}
  "brand": { "@type": "Brand", "name": {{ product.vendor | json }} },
  {%- if product.featured_image %}
  "image": {{ product.featured_image | image_url: width: 1200 | prepend: 'https:' | json }},
  {%- endif %}
  "offers": {
    "@type": "Offer",
    "price": {{ product.price | divided_by: 100.0 | json }},
    "priceCurrency": {{ shop.currency | json }},
    "availability": "{% if product.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}",
    "url": "{{ shop.url }}{{ product.url }}"
  }
}
</script>
{%- endif -%}

{%- if template contains 'collection' and collection -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": {{ collection.title | json }},
  "description": {{ collection.description | strip_html | truncatewords: 50 | json }},
  "url": "{{ shop.url }}{{ collection.url }}"
}
</script>
{%- endif -%}

{%- if template contains 'article' and article -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": {{ article.title | json }},
  "datePublished": {{ article.published_at | date: '%Y-%m-%dT%H:%M:%S%z' | json }},
  "author": { "@type": "Person", "name": {{ article.author | json }} }
  {%- if article.image %},"image": {{ article.image | image_url: width: 1200 | prepend: 'https:' | json }}{% endif -%}
}
</script>
{%- endif -%}
`;

async function getMainTheme(admin) {
  const res = await admin.graphql(`{
    themes(first: 5, roles: [MAIN]) {
      nodes { id name role }
    }
  }`);
  const { data } = await res.json();
  return data?.themes?.nodes?.[0] || null;
}

async function getThemeFileContent(admin, themeId, filename) {
  const res = await admin.graphql(
    `query GetFile($id: ID!, $filenames: [String!]!) {
      theme(id: $id) {
        files(filenames: $filenames, first: 1) {
          nodes {
            filename
            body {
              ... on OnlineStoreThemeFileBodyText { content }
            }
          }
        }
      }
    }`,
    { variables: { id: themeId, filenames: [filename] } }
  );
  const { data } = await res.json();
  return data?.theme?.files?.nodes?.[0]?.body?.content || null;
}

async function upsertThemeFile(admin, themeId, filename, value) {
  const res = await admin.graphql(
    `mutation Upsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles { filename }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        themeId,
        files: [{ filename, body: { type: "TEXT", value } }],
      },
    }
  );
  const { data } = await res.json();
  const errs = data?.themeFilesUpsert?.userErrors;
  if (errs?.length) throw new Error(errs.map((e) => e.message).join("; "));
}

async function deleteThemeFile(admin, themeId, filename) {
  await admin
    .graphql(
      `mutation Del($themeId: ID!, $files: [String!]!) {
        themeFilesDelete(themeId: $themeId, files: $files) {
          deletedThemeFiles { filename }
          userErrors { field message }
        }
      }`,
      { variables: { themeId, files: [filename] } }
    )
    .catch(() => {});
}

export async function isInstalledInTheme(admin) {
  const theme = await getMainTheme(admin);
  if (!theme) return { installed: false, themeName: null };
  const layout = await getThemeFileContent(admin, theme.id, LAYOUT_FILENAME);
  return {
    installed: !!(layout && layout.includes(INJECT_MARKER_START)),
    themeName: theme.name,
  };
}

export async function installInTheme(admin) {
  const theme = await getMainTheme(admin);
  if (!theme) throw new Error("No published theme found.");

  // 1. Upsert the snippet
  await upsertThemeFile(admin, theme.id, SNIPPET_FILENAME, SNIPPET_CONTENT);

  // 2. Inject the render tag into theme.liquid before </head>
  const layout = await getThemeFileContent(admin, theme.id, LAYOUT_FILENAME);
  if (!layout) throw new Error("layout/theme.liquid not found in this theme.");

  if (layout.includes(INJECT_MARKER_START)) {
    return { themeName: theme.name, alreadyInstalled: true };
  }

  const injection = `${INJECT_MARKER_START}\n  ${INJECT_TAG}\n  ${INJECT_MARKER_END}\n`;
  const newLayout = layout.replace(/<\/head>/i, `${injection}</head>`);
  if (newLayout === layout) {
    throw new Error("Could not find </head> in theme.liquid — install aborted.");
  }
  await upsertThemeFile(admin, theme.id, LAYOUT_FILENAME, newLayout);

  return { themeName: theme.name, alreadyInstalled: false };
}

export async function uninstallFromTheme(admin) {
  const theme = await getMainTheme(admin);
  if (!theme) throw new Error("No published theme found.");

  const layout = await getThemeFileContent(admin, theme.id, LAYOUT_FILENAME);
  if (layout) {
    const re = new RegExp(
      `\\s*${INJECT_MARKER_START}[\\s\\S]*?${INJECT_MARKER_END}\\n?`,
      "g"
    );
    const newLayout = layout.replace(re, "");
    if (newLayout !== layout) {
      await upsertThemeFile(admin, theme.id, LAYOUT_FILENAME, newLayout);
    }
  }

  await deleteThemeFile(admin, theme.id, SNIPPET_FILENAME);
  return { themeName: theme.name };
}
