import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { getOrCreateShop } from "../services/shopService.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  // 1. Total conversations
  const totalConversations = await prisma.conversation.count({
    where: { shopId: shop.id }
  });

  // 2. Total messages
  const totalMessages = await prisma.message.count({
    where: { conversation: { shopId: shop.id } }
  });

  // 3. Analytics events counts
  const addToCartEvents = await prisma.analytics.count({
    where: { shopId: shop.id, eventType: "add_to_cart_clicked" }
  });

  const productClicks = await prisma.analytics.count({
    where: { shopId: shop.id, eventType: "product_clicked" }
  });

  // 4. Recent user messages / inquiries
  const recentInquiries = await prisma.message.findMany({
    where: {
      conversation: { shopId: shop.id },
      role: "user"
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      content: true,
      createdAt: true
    }
  });

  return {
    shopDomain: session.shop,
    metrics: {
      totalConversations,
      totalMessages,
      addToCartEvents,
      productClicks
    },
    recentInquiries
  };
};

export default function AnalyticsPage() {
  const { metrics, recentInquiries = [] } = useLoaderData();

  const convRate = metrics.totalConversations > 0
    ? ((metrics.addToCartEvents / metrics.totalConversations) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="muasa-admin-container">
      {/* Header */}
      <div className="muasa-admin-header">
        <div>
          <h1 className="muasa-admin-title">Chatbot Conversion & Analytics</h1>
          <p className="muasa-admin-subtitle">
            Track customer conversations, shopping questions, and AI-assisted add-to-cart conversions.
          </p>
        </div>
        <div className="muasa-admin-actions">
          <a href="/app" className="muasa-btn-secondary">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="muasa-kpi-grid">
        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Total Shopper Chats</span>
            <span>💬</span>
          </div>
          <div className="muasa-kpi-value">{metrics.totalConversations}</div>
          <div className="muasa-kpi-footer">Unique customer sessions</div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Total AI Messages</span>
            <span>⚡</span>
          </div>
          <div className="muasa-kpi-value">{metrics.totalMessages}</div>
          <div className="muasa-kpi-footer">Exchanged with shoppers</div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Add-to-Cart Conversions</span>
            <span>🛒</span>
          </div>
          <div className="muasa-kpi-value" style={{ color: "#108043" }}>{metrics.addToCartEvents}</div>
          <div className="muasa-kpi-footer">Conversion Rate: <strong>{convRate}%</strong></div>
        </div>

        <div className="muasa-kpi-card">
          <div className="muasa-kpi-label">
            <span>Product Views from AI</span>
            <span>👀</span>
          </div>
          <div className="muasa-kpi-value">{metrics.productClicks}</div>
          <div className="muasa-kpi-footer">Catalog items clicked</div>
        </div>
      </div>

      {/* Customer Inquiries Feed Table */}
      <div className="muasa-card">
        <div className="muasa-card-header">
          <h3>Recent Shopper Inquiries ({recentInquiries.length})</h3>
          <span className="muasa-badge">Live Store Stream</span>
        </div>
        <div className="muasa-table-wrap">
          {recentInquiries.length > 0 ? (
            <table className="muasa-table">
              <thead>
                <tr>
                  <th>Customer Query</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td>
                      <strong style={{ color: "#202223" }}>&ldquo;{inq.content}&rdquo;</strong>
                    </td>
                    <td style={{ color: "#6d7175", whiteSpace: "nowrap" }}>
                      {new Date(inq.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td>
                      <span className="muasa-badge">✓ AI Answered</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#6d7175" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📊</div>
              <div style={{ fontWeight: 600, color: "#202223" }}>No customer queries recorded yet</div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                As shoppers ask questions on your storefront, real customer inquiries will be logged here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
