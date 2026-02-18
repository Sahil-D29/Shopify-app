import { Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  return (
    <PolarisAppProvider i18n={{}}>
      <ui-nav-menu>
        <a href="/app" rel="home">AI Readiness Score</a>
        <a href="/app/llms-txt">llms.txt</a>
        <a href="/app/structured-data">Structured Data</a>
        <a href="/app/faqs">Conversational FAQs</a>
        <a href="/app/keywords">Keywords & Synonyms</a>
        <a href="/app/robots-txt">robots.txt</a>
        <a href="/app/mcp-status">MCP Status</a>
      </ui-nav-menu>
      <Outlet />
    </PolarisAppProvider>
  );
}

export function ErrorBoundary() {
  return (
    <PolarisAppProvider i18n={{}}>
      <div style={{ padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <p>Please try refreshing the page.</p>
      </div>
    </PolarisAppProvider>
  );
}
