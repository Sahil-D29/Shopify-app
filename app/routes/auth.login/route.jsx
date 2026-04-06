import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { login } = await import("../../shopify.server");
  const errors = login(request);

  return json({ errors, polarisTranslations: {} });
};

export const action = async ({ request }) => {
  const { login } = await import("../../shopify.server");
  const errors = await login(request);

  return json({ errors });
};

export default function Auth() {
  const { polarisTranslations } = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = ["", () => {}];

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="e.g. my-shop.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={actionData?.errors?.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
