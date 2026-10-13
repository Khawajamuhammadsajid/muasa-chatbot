import { useLoaderData, useActionData, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { z } from "zod";
import { authenticate } from "../shopify.server.js";
import { getShopSettings, updateShopSettings } from "../services/shopService.js";

const SettingsSchema = z.object({
  botName: z.string().trim().min(1, "Bot name is required").max(60),
  greeting: z.string().trim().min(5, "Greeting must be at least 5 characters").max(300),
  brandTone: z.string().trim().min(3).max(120),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Valid hex color required (e.g. #111111)"),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Valid hex color required (e.g. #6366f1)"),
  position: z.enum(["bottom-right", "bottom-left"]),
  enabled: z.boolean(),
  supportEmail: z.string().email("Valid email required").or(z.literal("")),
  retentionDays: z.coerce.number().int().min(7, "Retention must be at least 7 days").max(365)
});

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return { settings, shop: session.shop };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const raw = {
    botName: formData.get("botName"),
    greeting: formData.get("greeting"),
    brandTone: formData.get("brandTone"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    position: formData.get("position"),
    enabled: formData.get("enabled") === "true",
    supportEmail: formData.get("supportEmail") || "",
    retentionDays: formData.get("retentionDays")
  };

  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || "Validation error";
    return { error: errorMsg };
  }

  try {
    await updateShopSettings(session.shop, parsed.data);
    return { success: true, message: "Settings saved successfully!" };
  } catch (err) {
    return { error: `Failed to save settings: ${err.message}` };
  }
};

export default function SettingsPage() {
  const { settings } = useLoaderData();
  const actionData = useActionData();

  return (
    <s-page heading="Assistant Settings & Customization">
      {actionData?.success && (
        <s-section heading="Saved">
          <s-paragraph>{actionData.message}</s-paragraph>
        </s-section>
      )}

      {actionData?.error && (
        <s-section heading="Notice">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-section>
      )}

      <Form method="post">
        <s-section heading="Bot Personality and Voice">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px" }}>
            <label>
              <strong>Assistant Name:</strong>
              <input
                type="text"
                name="botName"
                defaultValue={settings?.botName || "Shopping Assistant"}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>

            <label>
              <strong>Welcome Greeting:</strong>
              <textarea
                name="greeting"
                rows={3}
                defaultValue={settings?.greeting || "Hello! How can I help you find what you are looking for today?"}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>

            <label>
              <strong>Brand Tone & Demeanor:</strong>
              <input
                type="text"
                name="brandTone"
                defaultValue={settings?.brandTone || "Friendly, helpful luxury shopping assistant"}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>
          </div>
        </s-section>

        <s-section heading="Widget Design and Position">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px" }}>
            <label>
              <strong>Primary Header Color:</strong>
              <input
                type="text"
                name="primaryColor"
                defaultValue={settings?.primaryColor || "#111111"}
                placeholder="#111111"
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>

            <label>
              <strong>Accent Button Color:</strong>
              <input
                type="text"
                name="accentColor"
                defaultValue={settings?.accentColor || "#6366f1"}
                placeholder="#6366f1"
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>

            <label>
              <strong>Screen Position:</strong>
              <select
                name="position"
                defaultValue={settings?.position || "bottom-right"}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </label>
          </div>
        </s-section>

        <s-section heading="Operational Controls and Privacy">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                name="enabled"
                value="true"
                defaultChecked={settings?.enabled ?? true}
              />
              <strong>Assistant Active on Storefront</strong>
            </label>

            <label>
              <strong>Human Support Fallback Email (Optional):</strong>
              <input
                type="email"
                name="supportEmail"
                defaultValue={settings?.supportEmail || ""}
                placeholder="support@yourstore.com"
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
              />
            </label>

            <label>
              <strong>Chat History Auto-Deletion (Retention Days):</strong>
              <input
                type="number"
                name="retentionDays"
                min={7}
                max={365}
                defaultValue={settings?.retentionDays || 30}
                style={{ width: "100%", padding: "8px 12px", marginTop: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                required
              />
            </label>

            <button
              type="submit"
              style={{
                alignSelf: "flex-start",
                marginTop: "16px",
                background: "#111111",
                color: "#ffffff",
                padding: "10px 24px",
                borderRadius: "6px",
                border: "none",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Save Settings
            </button>
          </div>
        </s-section>
      </Form>
    </s-page>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
