import { authenticate } from "../shopify.server.js";
import { redactCustomerConversations } from "../services/shopService.js";

/**
 * Mandatory GDPR Webhook: customers/redact
 * Triggered when a store owner requests deletion of customer data or a customer makes a right-to-be-forgotten request.
 */
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} request for shop ${shop}. Customer:`, payload?.customer?.id);

  try {
    const customerId = payload?.customer?.id ? String(payload.customer.id) : null;
    if (customerId) {
      await redactCustomerConversations(shop, customerId);
    }
  } catch (err) {
    console.error(`[GDPR] Error redacting customer data:`, err.message);
  }

  return new Response(JSON.stringify({ status: "success", message: "Customer data redacted" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
