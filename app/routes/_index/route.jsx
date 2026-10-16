import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

import { useState } from "react";

export default function App() {
  const { showForm } = useLoaderData();
  const [rawShop, setRawShop] = useState("");

  const cleanSubdomain = rawShop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  let normalizedShop = cleanSubdomain;
  if (cleanSubdomain) {
    if (!cleanSubdomain.endsWith(".myshopify.com")) {
      normalizedShop = `${cleanSubdomain.split(".")[0]}.myshopify.com`;
    }
  }

  const handleSubmit = (e) => {
    if (normalizedShop) {
      const inputEl = e.currentTarget.querySelector('input[name="shop"]');
      if (inputEl) inputEl.value = normalizedShop;
    }
  };

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <div className={styles.badge}>
          <span>✦</span>
          <span>Google Gemini 2.5 Flash • Autonomous 24/7 Concierge</span>
        </div>

        <h1 className={styles.heading}>
          Muasa AI Shopping Assistant
        </h1>

        <p className={styles.text}>
          Turn store traffic into high-converting orders with an intelligent, catalog-grounded shopping concierge and instant In-Chat Checkout.
        </p>

        {showForm && (
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Launch Assistant in Shopify Admin</div>
            <Form className={styles.form} method="post" action="/auth/login" onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  value={rawShop}
                  onChange={(e) => setRawShop(e.target.value)}
                  placeholder="e.g. your-store.myshopify.com"
                  required
                />
                <button className={styles.button} type="submit">
                  Open in Shopify →
                </button>
              </div>
              {rawShop && normalizedShop && (
                <div style={{ fontSize: "12px", color: "#10b981", textAlign: "left", marginTop: "6px" }}>
                  ✓ Will authenticate with: <strong>{normalizedShop}</strong>
                </div>
              )}
              <div className={styles.hint}>
                Enter your permanent Shopify store domain (e.g. <code>store-name.myshopify.com</code>).
              </div>
            </Form>
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.gridCard}>
            <div className={styles.gridIcon}>⚡</div>
            <div className={styles.gridTitle}>24/7 Autonomous Care</div>
            <div className={styles.gridDesc}>
              Deep catalog grounding with real-time inventory verification and instant policy answers.
            </div>
          </div>

          <div className={styles.gridCard}>
            <div className={styles.gridIcon}>🛒</div>
            <div className={styles.gridTitle}>In-Chat Direct Checkout</div>
            <div className={styles.gridDesc}>
              Shoppers complete orders directly inside the conversation with COD and online payment sync.
            </div>
          </div>

          <div className={styles.gridCard}>
            <div className={styles.gridIcon}>🛡️</div>
            <div className={styles.gridTitle}>Enterprise Guardrails</div>
            <div className={styles.gridDesc}>
              Zero hallucinations, prompt injection defenses, competitor filtering, and multi-currency adaptation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
