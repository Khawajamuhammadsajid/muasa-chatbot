import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { getOrCreateShop } from "../services/shopService.js";
import { getStoreCatalog } from "../services/catalogService.js";
import { getAiHealthStatus } from "../lib/aiEngine.js";
import { checkMessageQuota } from "../lib/billing.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await getOrCreateShop(shopDomain);
  const quota = checkMessageQuota(shop);
  const catalogData = await getStoreCatalog(shopDomain, admin);
  const aiHealth = getAiHealthStatus();

  const cleanShop = shopDomain.replace(".myshopify.com", "");
  const themeEditorUrl = `https://admin.shopify.com/store/${cleanShop}/themes/current/editor?context=apps`;

  const recentOrdersRaw = await prisma.analytics.findMany({
    where: {
      shopId: shop.id,
      eventType: "order_placed"
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const recentOrders = recentOrdersRaw.map((o) => {
    let meta = {};
    try { meta = JSON.parse(o.metadata || "{}"); } catch (_) {}
    return {
      id: o.id,
      createdAt: o.createdAt,
      orderNumber: meta.orderNumber || "#MB-Order",
      customerName: meta.customerName || "Customer",
      phone: meta.phone || "—",
      address: meta.address || "—",
      totalPrice: meta.totalPrice || "0.00",
      paymentMethod: meta.paymentMethod || "COD",
      isOfficialOrder: meta.isOfficialOrder
    };
  });

  return {
    shopName: catalogData.shopInfo?.name || shopDomain,
    currency: catalogData.shopInfo?.currency || "PKR",
    productCount: catalogData.products?.length || 0,
    sampleProducts: (catalogData.products || []).slice(0, 5),
    recentOrders,
    quota,
    settings: shop.settings,
    themeEditorUrl,
    aiHealth
  };
};

export default function Dashboard() {
  const {
    shopName,
    currency,
    productCount,
    sampleProducts,
    recentOrders = [],
    quota,
    settings,
    themeEditorUrl,
    aiHealth
  } = useLoaderData();

  const handleOpenThemeEditor = () => {
    window.open(themeEditorUrl, "_blank");
  };

  return (
    <s-page heading={`Muasa Bot — ${shopName}`}>
      <s-button slot="primary-action" onClick={handleOpenThemeEditor}>
        Open Theme Editor (App Embeds)
      </s-button>

      {/* AI Engine Status Alert Banner */}
      {!aiHealth.isHealthy ? (
        <s-section heading="AI Service Notice">
          <s-paragraph>
            The AI engine encountered an issue: <code>{aiHealth.lastError}</code>. Automatic retries and fallback models are engaged.
          </s-paragraph>
        </s-section>
      ) : (
        <s-section heading="AI Engine Operational">
          <s-paragraph>
            Autonomous customer care engine is active with Google Gemini model <strong>{aiHealth.activeModel}</strong>.
            Grounding and tool-based retrieval are verified.
          </s-paragraph>
        </s-section>
      )}

      {/* Setup & Onboarding Checklist */}
      <s-section heading="Onboarding Checklist">
        <s-list>
          <s-list-item>
            <strong>1. Enable Theme App Embed:</strong> Open the Shopify Theme Editor and toggle <strong>Muasa AI Assistant</strong> to ON.
          </s-list-item>
          <s-list-item>
            <strong>2. Catalog Synchronization:</strong> {productCount > 0 ? (
              <span><strong>{productCount} products</strong> loaded into live tool retrieval memory.</span>
            ) : (
              <span>No products detected yet. Add products to your store to enable recommendations.</span>
            )}
          </s-list-item>
          <s-list-item>
            <strong>3. Assistant Personality & Brand Voice:</strong> Bot is currently named <em>&ldquo;{settings?.botName || "Customer Care"}&rdquo;</em> ({settings?.enabled ? "Enabled" : "Disabled"}). Customize on the <strong>Settings</strong> page.
          </s-list-item>
        </s-list>
      </s-section>

      {/* Usage & Plan Summary */}
      <s-section heading="Plan and Message Usage">
        <s-paragraph>
          Current Plan: <strong>{quota.plan}</strong> | Messages used this cycle: <strong>{quota.usage} / {quota.limit}</strong> ({quota.remaining} remaining).
        </s-paragraph>
      </s-section>

      {/* In-Chat Received Orders */}
      <s-section heading={`In-Chat Orders (${recentOrders?.length || 0} Recent)`}>
        {recentOrders && recentOrders.length > 0 ? (
          <s-list>
            {recentOrders.map((ord) => (
              <s-list-item key={ord.id}>
                <strong>{ord.orderNumber}</strong> — {ord.customerName} ({ord.phone}) | <strong>{ord.paymentMethod}</strong> | Total: {currency} {ord.totalPrice} | Address: {ord.address} | Status: {ord.isOfficialOrder ? "Shopify Admin Order" : "In-Chat Received"}
              </s-list-item>
            ))}
          </s-list>
        ) : (
          <s-paragraph>
            No in-chat orders placed yet. When a shopper completes checkout via Muasa Chatbot, their order details will appear right here!
          </s-paragraph>
        )}
      </s-section>

      {/* Live Catalog Preview */}
      <s-section heading={`Grounded Products Preview (${productCount} Total)`}>
        {sampleProducts.length > 0 ? (
          <s-list>
            {sampleProducts.map((p) => (
              <s-list-item key={p.id}>
                <strong>{p.title}</strong> — {currency} {p.price} | Stock: {p.inStock ? "In Stock" : "Out of Stock"}
              </s-list-item>
            ))}
          </s-list>
        ) : (
          <s-paragraph>
            No products found in store catalog.
          </s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
