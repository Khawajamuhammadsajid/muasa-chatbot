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
    sampleProducts = [],
    recentOrders = [],
    quota,
    settings,
    themeEditorUrl,
    aiHealth
  } = useLoaderData();

  const handleOpenThemeEditor = () => {
    window.open(themeEditorUrl, "_blank");
  };

  const totalAssistedRevenue = recentOrders.reduce((sum, ord) => {
    const val = parseFloat(String(ord.totalPrice).replace(/[^0-9.]/g, "")) || 0;
    return sum + val;
  }, 0);

  const usagePercent = Math.min(100, Math.round((quota.usage / (quota.limit || 1)) * 100));

  return (
    <div className="muasa-admin-container">
      {/* Top Header */}
      <div className="muasa-admin-header">
        <div>
          <h1 className="muasa-admin-title">Muasa AI Concierge — {shopName}</h1>
          <p className="muasa-admin-subtitle">
            Autonomous 24/7 Customer Care & Shopping Intelligence for high-converting stores.
          </p>
        </div>
        <div className="muasa-admin-actions">
          <button className="muasa-btn-secondary" onClick={() => window.open("/app/settings", "_self")}>
            ⚙️ Bot Settings
          </button>
          <button className="muasa-btn-primary" onClick={handleOpenThemeEditor}>
            ✨ Open Theme Editor (App Embeds)
          </button>
        </div>
      </div>

      {/* Autonomous AI Engine Operational Status Banner */}
      <div className={`muasa-status-banner ${aiHealth.isHealthy ? "" : "warning"}`}>
        <div className="muasa-status-left">
          <div className="muasa-status-pulse" />
          <div>
            <div className="muasa-status-title">
              {aiHealth.isHealthy
                ? "Autonomous AI Engine Active & Running 24/7"
                : "AI Engine Recovering (Auto-Retries Active)"}
            </div>
            <p className="muasa-status-desc">
              Connected to <strong>Google Gemini ({aiHealth.activeModel || "gemini-2.5-flash"})</strong>. Catalog grounded with real-time stock awareness. No manual intervention required.
            </p>
          </div>
        </div>
        <div>
          <span className="muasa-badge">✓ 100% Operational</span>
        </div>
      </div>

      {/* Key Performance Indicators (KPIs) */}
      <div className="muasa-kpi-grid">
        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>In-Chat Orders</span>
            <span style={{ fontSize: "16px" }}>🛒</span>
          </div>
          <div className="muasa-kpi-value">{recentOrders.length}</div>
          <div className="muasa-kpi-footer">
            Assisted: <strong>{currency} {totalAssistedRevenue.toLocaleString()}</strong>
          </div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Catalog Grounded</span>
            <span style={{ fontSize: "16px" }}>📦</span>
          </div>
          <div className="muasa-kpi-value">{productCount}</div>
          <div className="muasa-kpi-footer">
            <span>Live in memory & synced</span>
          </div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Monthly AI Quota</span>
            <span style={{ fontSize: "16px" }}>⚡</span>
          </div>
          <div className="muasa-kpi-value">{quota.usage} <span style={{ fontSize: "16px", color: "#6d7175", fontWeight: 400 }}>/ {quota.limit}</span></div>
          <div className="muasa-kpi-footer">
            <div style={{ background: "#e1e3e5", height: "6px", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
              <div style={{ width: `${usagePercent}%`, background: usagePercent > 90 ? "#d72c0d" : "#005bd3", height: "100%" }} />
            </div>
          </div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Storefront Status</span>
            <span style={{ fontSize: "16px" }}>🟢</span>
          </div>
          <div className="muasa-kpi-value" style={{ fontSize: "22px", color: settings?.enabled ? "#108043" : "#d72c0d" }}>
            {settings?.enabled ? "Online & Ready" : "Disabled"}
          </div>
          <div className="muasa-kpi-footer">
            Position: <strong>{settings?.position || "bottom-right"}</strong>
          </div>
        </div>
      </div>

      {/* Split Content: Main Activity + Quick Setup */}
      <div className="muasa-two-column">
        {/* Left Column: Recent Orders & Catalog Feed */}
        <div>
          {/* In-Chat Direct Orders Card */}
          <div className="muasa-card">
            <div className="muasa-card-header">
              <h3>Recent In-Chat Orders ({recentOrders.length})</h3>
              <span className="muasa-badge info">Direct Store Orders</span>
            </div>
            <div className="muasa-table-wrap">
              {recentOrders.length > 0 ? (
                <table className="muasa-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td><strong>{ord.orderNumber}</strong></td>
                        <td>
                          <div>{ord.customerName}</div>
                          <div style={{ fontSize: "12px", color: "#6d7175" }}>{ord.phone}</div>
                        </td>
                        <td>
                          <span className="muasa-badge neutral">{ord.paymentMethod}</span>
                        </td>
                        <td><strong>{currency} {ord.totalPrice}</strong></td>
                        <td>
                          <span className="muasa-badge">
                            {ord.isOfficialOrder ? "Shopify Admin" : "In-Chat Direct"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "36px", textAlign: "center", color: "#6d7175" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛍️</div>
                  <div style={{ fontWeight: 600, color: "#202223" }}>No orders placed through AI chat yet</div>
                  <div style={{ fontSize: "13px", marginTop: "4px" }}>
                    When customers complete In-Chat Checkout, official Shopify orders appear here automatically.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Catalog Sync Status Card */}
          <div className="muasa-card">
            <div className="muasa-card-header">
              <h3>Grounded Product Catalog ({productCount} Synced)</h3>
              <span className="muasa-badge">Live GraphQL Sync</span>
            </div>
            <div className="muasa-table-wrap">
              {sampleProducts.length > 0 ? (
                <table className="muasa-table">
                  <thead>
                    <tr>
                      <th>Product Title</th>
                      <th>Price</th>
                      <th>Inventory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleProducts.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.title}</strong></td>
                        <td>{currency} {p.price}</td>
                        <td>
                          <span className={`muasa-badge ${p.inStock ? "" : "neutral"}`}>
                            {p.inStock ? "In Stock" : "Out of Stock"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: "#6d7175" }}>
                  No products detected. Products added to Shopify sync here automatically.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Setup Checklist & Specs */}
        <div>
          {/* Onboarding Checklist Card */}
          <div className="muasa-card">
            <div className="muasa-card-header">
              <h3>Storefront Launch Checklist</h3>
            </div>
            <div className="muasa-card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ color: "#108043", fontSize: "18px" }}>✓</span>
                  <div>
                    <strong style={{ fontSize: "13.5px" }}>1. Enable Theme App Embed</strong>
                    <p style={{ margin: "3px 0 6px 0", fontSize: "12.5px", color: "#6d7175" }}>
                      Activate Muasa AI in the Shopify Theme Editor.
                    </p>
                    <button className="muasa-btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleOpenThemeEditor}>
                      Open Theme Editor →
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ color: productCount > 0 ? "#108043" : "#b95000", fontSize: "18px" }}>
                    {productCount > 0 ? "✓" : "○"}
                  </span>
                  <div>
                    <strong style={{ fontSize: "13.5px" }}>2. Product Catalog Synced</strong>
                    <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "#6d7175" }}>
                      {productCount} products loaded into tool retrieval memory with stock tracking.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ color: "#108043", fontSize: "18px" }}>✓</span>
                  <div>
                    <strong style={{ fontSize: "13.5px" }}>3. Brand Personality & Colors</strong>
                    <p style={{ margin: "3px 0 6px 0", fontSize: "12.5px", color: "#6d7175" }}>
                      Named <em>&ldquo;{settings?.botName || "Shopping Assistant"}&rdquo;</em>.
                    </p>
                    <a href="/app/settings" style={{ fontSize: "12px", color: "#005bd3", textDecoration: "none", fontWeight: 600 }}>
                      Customize in Settings →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Autonomous Operations Specs Card */}
          <div className="muasa-card">
            <div className="muasa-card-header">
              <h3>Enterprise Autonomy Specs</h3>
            </div>
            <div className="muasa-card-body" style={{ fontSize: "13px", lineHeight: "1.6", color: "#6d7175" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>AI Intelligence:</span>
                <strong style={{ color: "#202223" }}>Gemini 2.5 Flash</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>Uptime Autonomy:</span>
                <strong style={{ color: "#108043" }}>24/7 Self-Healing</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>Memory Cache:</span>
                <strong style={{ color: "#202223" }}>Sub-second In-Memory</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Order Placement:</span>
                <strong style={{ color: "#202223" }}>Direct Admin GraphQL</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
