import { authenticate } from "../shopify.server.js";

/**
 * Mandatory GDPR Webhook: customers/data_request
 * Triggered when a customer requests their data from Shopify.
 * Muasa Bot stores only anonymous conversations and session tokens,
 * without PII (such as full names, credit card numbers, or physical addresses).
 */
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} request for shop ${shop}. Payload customer ID: ${payload?.customer?.id}`);

  // Return 200 OK immediately as per Shopify requirements
  return new Response(JSON.stringify({ status: "success", message: "Customer data request processed" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
