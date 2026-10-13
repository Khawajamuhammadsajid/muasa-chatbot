/**
 * Direct Storefront Chat Route - Deprecated for Security
 * In production Shopify architecture, all storefront widget interactions
 * MUST go through the Shopify App Proxy (/apps/muasa-bot/chat)
 * to ensure cryptographic HMAC signature verification and prevent direct unauthorized scraping.
 */

export const loader = async () => {
  return new Response(JSON.stringify({
    error: "Direct access disabled. Please use Shopify App Proxy (/apps/muasa-bot)."
  }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
};

export const action = async () => {
  return new Response(JSON.stringify({
    error: "Forbidden: Direct API calls bypass Shopify HMAC validation. Use the App Proxy route."
  }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
};
