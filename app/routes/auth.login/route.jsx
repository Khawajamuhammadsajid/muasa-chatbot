import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export function sanitizeShopDomain(input) {
  if (!input) return "";
  let clean = String(input).trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, ""); // strip protocol
  clean = clean.replace(/\/.*$/, ""); // strip path
  
  if (!clean) return "";

  if (clean.endsWith(".myshopify.com")) {
    return clean;
  }

  // If user entered e.g. "jwcaraffair" or "jwcaraffair.store"
  const subdomain = clean.split(".")[0];
  return `${subdomain}.myshopify.com`;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const rawShop = url.searchParams.get("shop");

  if (rawShop) {
    const cleanShop = sanitizeShopDomain(rawShop);
    if (cleanShop && cleanShop !== rawShop) {
      url.searchParams.set("shop", cleanShop);
      const newRequest = new Request(url.toString(), {
        method: request.method,
        headers: request.headers
      });
      const errors = loginErrorMessage(await login(newRequest));
      return { errors, shop: cleanShop };
    }
  }

  const errors = loginErrorMessage(await login(request));
  return { errors, shop: rawShop || "" };
};

export const action = async ({ request }) => {
  const cloned = request.clone();
  let formData;
  try {
    formData = await cloned.formData();
  } catch (_) {
    formData = new FormData();
  }

  const rawShop = formData.get("shop");
  if (rawShop) {
    const cleanShop = sanitizeShopDomain(rawShop);
    formData.set("shop", cleanShop);

    const newRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new URLSearchParams(formData)
    });

    const loginResult = await login(newRequest);
    const errors = loginErrorMessage(loginResult);
    return { errors, shop: cleanShop };
  }

  const errors = loginErrorMessage(await login(request));
  return { errors, shop: "" };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const initialShop = actionData?.shop || loaderData?.shop || "";
  const [shop, setShop] = useState(initialShop);
  const { errors } = actionData || loaderData || {};

  const cleanPreview = sanitizeShopDomain(shop);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at top, #1c1c20 0%, #0d0d11 100%)",
      color: "#f4f4f5",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      padding: "24px",
      boxSizing: "border-box"
    }}>
      <div style={{
        maxWidth: "460px",
        width: "100%",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "16px",
        padding: "32px 28px",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        textAlign: "left"
      }}>
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#ffffff",
            color: "#09090b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "14px"
          }}>
            ✦
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
              Muasa AI Shopping Assistant
            </h2>
            <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
              Shopify OAuth Authentication
            </span>
          </div>
        </div>

        <p style={{ fontSize: "13.5px", color: "#a1a1aa", margin: "0 0 20px 0", lineHeight: "1.5" }}>
          Connect your store to install Muasa Bot and open the Merchant Dashboard.
        </p>

        {errors?.shop && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            lineHeight: "1.4",
            marginBottom: "18px"
          }}>
            ⚠️ {errors.shop}
          </div>
        )}

        <Form method="post">
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
              Shopify Store Domain *
            </label>
            <input
              type="text"
              name="shop"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="e.g. your-store.myshopify.com"
              autoComplete="on"
              required
              style={{
                width: "100%",
                background: "#09090b",
                border: "1px solid #3f3f46",
                color: "#ffffff",
                padding: "11px 14px",
                borderRadius: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            {shop && cleanPreview && (
              <div style={{ fontSize: "12px", color: "#10b981", marginTop: "6px" }}>
                ✓ Will connect to: <strong>{cleanPreview}</strong>
              </div>
            )}
            <div style={{ fontSize: "11.5px", color: "#71717a", marginTop: "6px", lineHeight: "1.4" }}>
              Please enter your permanent <code>.myshopify.com</code> store handle (e.g. <code>jwcaraffair.myshopify.com</code>).
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              background: "#ffffff",
              color: "#09090b",
              border: "none",
              fontWeight: 700,
              fontSize: "14px",
              padding: "12px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "transform 0.1s ease"
            }}
          >
            Authenticate & Open in Shopify →
          </button>
        </Form>
      </div>
    </div>
  );
}
