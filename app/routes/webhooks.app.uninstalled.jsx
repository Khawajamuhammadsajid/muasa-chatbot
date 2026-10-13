import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] Received ${topic} for ${shop}`);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Update shop record
  try {
    await db.shop.updateMany({
      where: { domain: shop },
      data: { uninstalledAt: new Date() }
    });
  } catch (err) {
    console.error(`[Webhook] Error updating uninstalled shop ${shop}:`, err.message);
  }

  return new Response(null, { status: 200 });
};
