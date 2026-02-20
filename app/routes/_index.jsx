import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

export const loader = async ({ request }) => {
  const { login } = await import("../shopify.server");
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData();

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Shopify CLI + MCP App</h1>
      <p>Log in to your Shopify store to get started.</p>
      {showForm && (
        <Form method="post" action="/auth/login">
          <label>
            <span>Shop domain: </span>
            <input type="text" name="shop" placeholder="your-shop.myshopify.com" />
          </label>
          <button type="submit">Log in</button>
        </Form>
      )}
    </div>
  );
}
