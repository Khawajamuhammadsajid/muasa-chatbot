import { useLoaderData, useActionData, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { getOrCreateShop } from "../services/shopService.js";
import { checkMessageQuota, PLANS } from "../lib/billing.js";
import prisma from "../db.server.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const quota = checkMessageQuota(shop);

  return {
    shopDomain: session.shop,
    currentPlan: shop.plan,
    quota,
    plans: PLANS
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const selectedPlan = formData.get("plan");

  if (!PLANS[selectedPlan]) {
    return { error: "Invalid plan selected" };
  }

  // Update shop plan in database
  await prisma.shop.updateMany({
    where: { domain: session.shop },
    data: {
      plan: selectedPlan
    }
  });

  return { success: true, message: `Successfully switched to ${PLANS[selectedPlan].name} plan!` };
};

export default function BillingPage() {
  const { currentPlan, quota, plans } = useLoaderData();
  const actionData = useActionData();

  const usagePercent = Math.min(100, Math.round((quota.usage / (quota.limit || 1)) * 100));

  return (
    <div className="muasa-admin-container">
      {/* Header */}
      <div className="muasa-admin-header">
        <div>
          <h1 className="muasa-admin-title">Subscription Plans & Usage</h1>
          <p className="muasa-admin-subtitle">
            Scale your store AI customer care with high-throughput tier options.
          </p>
        </div>
        <div className="muasa-admin-actions">
          <a href="/app" className="muasa-btn-secondary">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {actionData?.success && (
        <div className="muasa-status-banner" style={{ borderLeftColor: "#108043", marginBottom: "20px" }}>
          <div className="muasa-status-left">
            <span style={{ fontSize: "20px", color: "#108043" }}>✓</span>
            <div>
              <div className="muasa-status-title" style={{ color: "#108043" }}>Plan Updated</div>
              <p className="muasa-status-desc">{actionData.message}</p>
            </div>
          </div>
        </div>
      )}

      {actionData?.error && (
        <div className="muasa-status-banner error" style={{ marginBottom: "20px" }}>
          <div className="muasa-status-left">
            <span style={{ fontSize: "20px", color: "#d72c0d" }}>⚠️</span>
            <div>
              <div className="muasa-status-title" style={{ color: "#d72c0d" }}>Notice</div>
              <p className="muasa-status-desc">{actionData.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Quota Usage Card */}
      <div className="muasa-card">
        <div className="muasa-card-header">
          <h3>Monthly AI Usage & Quota</h3>
          <span className="muasa-badge info">Active Plan: {quota.plan}</span>
        </div>
        <div className="muasa-card-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Message Volume</span>
            <span style={{ fontSize: "14px", color: "#6d7175" }}>
              <strong>{quota.usage}</strong> / {quota.limit} ({quota.remaining} remaining)
            </span>
          </div>
          <div style={{ background: "#e1e3e5", height: "10px", borderRadius: "6px", overflow: "hidden" }}>
            <div
              style={{
                width: `${usagePercent}%`,
                background: usagePercent > 90 ? "#d72c0d" : "#005bd3",
                height: "100%",
                transition: "width 0.3s ease"
              }}
            />
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {Object.values(plans).map((p) => {
          const isCurrent = (currentPlan || "FREE").toUpperCase() === p.id;
          return (
            <div
              key={p.id}
              className="muasa-card"
              style={{
                borderColor: isCurrent ? "#005bd3" : undefined,
                boxShadow: isCurrent ? "0 0 0 2px rgba(0, 91, 211, 0.25)" : undefined,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div className="muasa-card-header">
                  <h3>{p.name}</h3>
                  {isCurrent && <span className="muasa-badge">CURRENT PLAN</span>}
                </div>
                <div className="muasa-card-body">
                  <div style={{ fontSize: "32px", fontWeight: 700, color: "#202223", marginBottom: "16px" }}>
                    ${p.price} <span style={{ fontSize: "14px", fontWeight: 400, color: "#6d7175" }}>/ month</span>
                  </div>
                  <ul style={{ paddingLeft: "20px", color: "#6d7175", fontSize: "13.5px", lineHeight: "1.7", margin: 0 }}>
                    {p.features.map((feat, idx) => (
                      <li key={idx} style={{ color: "#202223" }}>{feat}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ padding: "0 22px 22px 22px" }}>
                <Form method="post">
                  <input type="hidden" name="plan" value={p.id} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    className={isCurrent ? "muasa-btn-secondary" : "muasa-btn-primary"}
                    style={{ width: "100%", justifyContent: "center", cursor: isCurrent ? "default" : "pointer" }}
                  >
                    {isCurrent ? "Active Plan" : `Upgrade to ${p.name}`}
                  </button>
                </Form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
