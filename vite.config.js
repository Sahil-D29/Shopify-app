import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the host of any dynamically generated URLs with localhost.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL.includes("localhost"))
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
}

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    ...(isDev
      ? {
          hmr: {
            protocol: "ws",
            host: "localhost",
            port: 64999,
            clientPort: 64999,
          },
        }
      : {}),
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
      },
    }),
  ],
});
