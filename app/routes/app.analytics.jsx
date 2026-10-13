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
  const { metrics, recentInquiries } = useLoaderData();

  return (
    <s-page heading="Chatbot Conversion & Analytics">
      {/* Metric Cards Overview */}
      <s-section heading="Key Performance Indicators">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Total Shopper Chats</div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px" }}>{metrics.totalConversations}</div>
          </div>

          <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Total AI Exchanges</div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px" }}>{metrics.totalMessages}</div>
          </div>

          <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Add-to-Cart Conversions</div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px", color: "#10b981" }}>{metrics.addToCartEvents}</div>
          </div>

          <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Product Views from AI</div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px" }}>{metrics.productClicks}</div>
          </div>
        </div>
      </s-section>

      {/* Customer Inquiries Feed */}
      <s-section heading="Recent Customer Shopping Questions">
        {recentInquiries.length > 0 ? (
          <s-list>
            {recentInquiries.map((inq) => (
              <s-list-item key={inq.id}>
                <strong>&ldquo;{inq.content}&rdquo;</strong> — <span style={{ color: "#6b7280", fontSize: "12px" }}>{new Date(inq.createdAt).toLocaleDateString()}</span>
              </s-list-item>
            ))}
          </s-list>
        ) : (
          <s-paragraph>
            No shopper queries recorded yet. As shoppers interact with the assistant on your storefront, their queries will appear here in real time.
          </s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
