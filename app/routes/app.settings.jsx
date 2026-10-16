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

import { useState } from "react";

export default function SettingsPage() {
  const { settings } = useLoaderData();
  const actionData = useActionData();

  const [botName, setBotName] = useState(settings?.botName || "Shopping Assistant");
  const [greeting, setGreeting] = useState(settings?.greeting || "Hello! How can I help you find what you are looking for today?");
  const [primaryColor, setPrimaryColor] = useState(settings?.primaryColor || "#111111");
  const [accentColor, setAccentColor] = useState(settings?.accentColor || "#6366f1");
  const [position, setPosition] = useState(settings?.position || "bottom-right");
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);

  return (
    <div className="muasa-admin-container">
      {/* Header */}
      <div className="muasa-admin-header">
        <div>
          <h1 className="muasa-admin-title">Assistant Settings & Customization</h1>
          <p className="muasa-admin-subtitle">
            Configure your AI shopping assistant personality, visual theme, and storefront behaviour.
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
              <div className="muasa-status-title" style={{ color: "#108043" }}>Settings Saved</div>
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
              <div className="muasa-status-title" style={{ color: "#d72c0d" }}>Validation Notice</div>
              <p className="muasa-status-desc">{actionData.error}</p>
            </div>
          </div>
        </div>
      )}

      <Form method="post">
        <div className="muasa-two-column">
          {/* Form Settings Cards */}
          <div>
            {/* Card 1: Bot Personality */}
            <div className="muasa-card">
              <div className="muasa-card-header">
                <h3>Assistant Identity & Brand Voice</h3>
                <span className="muasa-badge">Gemini Grounded</span>
              </div>
              <div className="muasa-card-body">
                <div className="muasa-form-group">
                  <label className="muasa-form-label" htmlFor="botName">
                    Assistant Name *
                  </label>
                  <input
                    type="text"
                    id="botName"
                    name="botName"
                    className="muasa-input-text"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    required
                  />
                  <div className="muasa-form-help">
                    Displayed in the chat header and launcher on the storefront.
                  </div>
                </div>

                <div className="muasa-form-group">
                  <label className="muasa-form-label" htmlFor="greeting">
                    Welcome Greeting *
                  </label>
                  <textarea
                    id="greeting"
                    name="greeting"
                    rows={3}
                    className="muasa-textarea"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    required
                  />
                  <div className="muasa-form-help">
                    The initial welcome message shown when a customer opens the chat window.
                  </div>
                </div>

                <div className="muasa-form-group" style={{ marginBottom: 0 }}>
                  <label className="muasa-form-label" htmlFor="brandTone">
                    Brand Tone & Instructions
                  </label>
                  <input
                    type="text"
                    id="brandTone"
                    name="brandTone"
                    className="muasa-input-text"
                    defaultValue={settings?.brandTone || "Friendly, helpful luxury shopping assistant"}
                    required
                  />
                  <div className="muasa-form-help">
                    Guides the AI demeanor (e.g. &ldquo;Polite, concise, consultative luxury advisor&rdquo;).
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Widget Appearance */}
            <div className="muasa-card">
              <div className="muasa-card-header">
                <h3>Widget Theme & Screen Placement</h3>
              </div>
              <div className="muasa-card-body">
                <div className="muasa-form-group">
                  <label className="muasa-form-label">
                    Primary Header Color
                  </label>
                  <div className="muasa-color-row">
                    <div className="muasa-color-swatch" style={{ background: primaryColor }} />
                    <input
                      type="text"
                      name="primaryColor"
                      className="muasa-input-text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#111111"
                      required
                    />
                    <input
                      type="color"
                      value={primaryColor.startsWith("#") && primaryColor.length === 7 ? primaryColor : "#111111"}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ cursor: "pointer", height: "38px", width: "42px", border: "none", background: "none" }}
                    />
                  </div>
                </div>

                <div className="muasa-form-group">
                  <label className="muasa-form-label">
                    Accent Action Color
                  </label>
                  <div className="muasa-color-row">
                    <div className="muasa-color-swatch" style={{ background: accentColor }} />
                    <input
                      type="text"
                      name="accentColor"
                      className="muasa-input-text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#6366f1"
                      required
                    />
                    <input
                      type="color"
                      value={accentColor.startsWith("#") && accentColor.length === 7 ? accentColor : "#6366f1"}
                      onChange={(e) => setAccentColor(e.target.value)}
                      style={{ cursor: "pointer", height: "38px", width: "42px", border: "none", background: "none" }}
                    />
                  </div>
                </div>

                <div className="muasa-form-group" style={{ marginBottom: 0 }}>
                  <label className="muasa-form-label" htmlFor="position">
                    Screen Position
                  </label>
                  <select
                    id="position"
                    name="position"
                    className="muasa-select"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <option value="bottom-right">Bottom Right (Recommended)</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Operational Controls */}
            <div className="muasa-card">
              <div className="muasa-card-header">
                <h3>Storefront Operational Status</h3>
              </div>
              <div className="muasa-card-body">
                <div className="muasa-form-group">
                  <label className="muasa-toggle-wrap">
                    <div>
                      <strong style={{ display: "block", fontSize: "14px", color: "#202223" }}>
                        Enable Assistant on Storefront
                      </strong>
                      <span style={{ fontSize: "12.5px", color: "#6d7175" }}>
                        When disabled, the widget will not be visible to visiting shoppers.
                      </span>
                    </div>
                    <div className="muasa-switch">
                      <input
                        type="checkbox"
                        name="enabled"
                        value="true"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                      />
                      <span className="muasa-slider" />
                    </div>
                  </label>
                </div>

                <div className="muasa-form-group">
                  <label className="muasa-form-label" htmlFor="supportEmail">
                    Human Support Escalation Email (Optional)
                  </label>
                  <input
                    type="email"
                    id="supportEmail"
                    name="supportEmail"
                    className="muasa-input-text"
                    defaultValue={settings?.supportEmail || ""}
                    placeholder="support@yourstore.com"
                  />
                  <div className="muasa-form-help">
                    Shoppers who request human escalation can directly email your team.
                  </div>
                </div>

                <div className="muasa-form-group" style={{ marginBottom: 0 }}>
                  <label className="muasa-form-label" htmlFor="retentionDays">
                    Chat Memory Retention (Days)
                  </label>
                  <input
                    type="number"
                    id="retentionDays"
                    name="retentionDays"
                    className="muasa-input-text"
                    min={7}
                    max={365}
                    defaultValue={settings?.retentionDays || 30}
                    required
                  />
                  <div className="muasa-form-help">
                    Conversations older than this threshold are purged in compliance with GDPR.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <button type="submit" className="muasa-btn-primary" style={{ padding: "12px 28px", fontSize: "15px" }}>
                💾 Save Changes
              </button>
            </div>
          </div>

          {/* Right Column: Live Storefront Simulator */}
          <div>
            <div className="muasa-simulator-frame">
              <div className="muasa-sim-topbar">
                <span>9:41</span>
                <div className="muasa-sim-notch" />
                <span>5G 100%</span>
              </div>

              <div className="muasa-sim-header" style={{ background: primaryColor }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#111", fontWeight: 700 }}>
                    ✦
                  </div>
                  <strong style={{ fontSize: "13px" }}>{botName}</strong>
                </div>
                <span style={{ fontSize: "14px", color: "#a1a1aa" }}>✕</span>
              </div>

              <div className="muasa-sim-body">
                <div className="muasa-sim-bubble ai">
                  {greeting}
                </div>

                <div className="muasa-sim-product-card">
                  <div className="muasa-sim-product-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                    📦
                  </div>
                  <div className="muasa-sim-product-info">
                    <div className="muasa-sim-product-title">Featured Store Item</div>
                    <div className="muasa-sim-product-price">In Stock • Ready to Ship</div>
                    <div style={{ marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", background: accentColor, color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                        + Add to cart
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="muasa-sim-input">
                <div className="muasa-sim-input-box">
                  Message {botName}...
                </div>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: accentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px" }}>
                  ➤
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#6d7175" }}>
              📱 Live Interactive Storefront Preview
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}

export const ErrorBoundary = boundary.error;
export const headers = boundary.headers;
