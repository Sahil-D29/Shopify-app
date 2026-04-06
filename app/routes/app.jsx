import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { json } from "@remix-run/node";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/seo">SEO Audit</a>
        <a href="/app/ai-discovery">AI Discovery</a>
        <a href="/app/structured-data">Structured Data</a>
        <a href="/app/faqs">FAQs & Content</a>
        <a href="/app/geo">GEO Optimizer</a>
        <a href="/app/settings">Settings</a>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  // Let Shopify's embedded auth handle 410 responses (token exchange bounce)
  if (isRouteErrorResponse(error) && error.status === 410) {
    return (
      <AppProvider isEmbeddedApp>
        <div />
      </AppProvider>
    );
  }

  return (
    <AppProvider isEmbeddedApp>
      <div style={{ padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <p>Please try refreshing the page.</p>
        {process.env.NODE_ENV === "development" && (
          <pre style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
            {error?.message || error?.data || String(error)}
          </pre>
        )}
      </div>
    </AppProvider>
  );
}
