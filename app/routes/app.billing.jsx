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

  return (
    <s-page heading="Subscription Plans & Usage">
      {actionData?.success && (
        <s-section heading="Plan Updated">
          <s-paragraph>{actionData.message}</s-paragraph>
        </s-section>
      )}

      {actionData?.error && (
        <s-section heading="Notice">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-section>
      )}

      {/* Current Quota Usage */}
      <s-section heading="Current Monthly Usage">
        <s-paragraph>
          You are currently on the <strong>{quota.plan}</strong>.
        </s-paragraph>
        <div style={{ marginTop: "12px", background: "#f3f4f6", borderRadius: "8px", overflow: "hidden", height: "16px", maxWidth: "480px" }}>
          <div
            style={{
              width: `${Math.min(100, (quota.usage / (quota.limit || 1)) * 100)}%`,
              background: quota.usage > quota.limit * 0.9 ? "#ef4444" : "#6366f1",
              height: "100%"
            }}
          />
        </div>
        <s-paragraph style={{ marginTop: "8px" }}>
          <strong>{quota.usage}</strong> used of <strong>{quota.limit}</strong> included AI messages ({quota.remaining} remaining).
        </s-paragraph>
      </s-section>

      {/* Available Plans */}
      <s-section heading="Available Plans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "12px" }}>
          {Object.values(plans).map((p) => {
            const isCurrent = (currentPlan || "FREE").toUpperCase() === p.id;
            return (
              <div
                key={p.id}
                style={{
                  padding: "20px",
                  borderRadius: "8px",
                  border: isCurrent ? "2px solid #6366f1" : "1px solid #e5e7eb",
                  background: isCurrent ? "#fbfbfe" : "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "18px" }}>{p.name}</h3>
                    {isCurrent && (
                      <span style={{ fontSize: "11px", fontWeight: 700, background: "#6366f1", color: "#fff", padding: "2px 8px", borderRadius: "12px" }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, margin: "12px 0" }}>
                    ${p.price} <span style={{ fontSize: "13px", fontWeight: 400, color: "#6b7280" }}>/ month</span>
                  </div>
                  <ul style={{ paddingLeft: "18px", color: "#374151", fontSize: "14px", lineHeight: "1.6" }}>
                    {p.features.map((feat, idx) => (
                      <li key={idx}>{feat}</li>
                    ))}
                  </ul>
                </div>

                <Form method="post" style={{ marginTop: "16px" }}>
                  <input type="hidden" name="plan" value={p.id} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "none",
                      fontWeight: 600,
                      cursor: isCurrent ? "default" : "pointer",
                      background: isCurrent ? "#e5e7eb" : "#111111",
                      color: isCurrent ? "#6b7280" : "#ffffff"
                    }}
                  >
                    {isCurrent ? "Current Plan" : `Select ${p.name}`}
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      </s-section>
    </s-page>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
