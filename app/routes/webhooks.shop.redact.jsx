import { authenticate } from "../shopify.server.js";
import { purgeShop } from "../services/shopService.js";

/**
 * Mandatory GDPR Webhook: shop/redact
 * Triggered 48 hours after an app is uninstalled. All records relating to the shop must be purged.
 */
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} request for shop ${shop}. Purging all shop records...`);

  try {
    await purgeShop(shop);
    console.log(`[GDPR] Successfully purged data for shop ${shop}`);
  } catch (err) {
    console.error(`[GDPR] Error purging shop ${shop}:`, err.message);
  }

  return new Response(JSON.stringify({ status: "success", message: "Shop records purged" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
