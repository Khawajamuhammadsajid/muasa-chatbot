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

export default function App() {
  const { showForm } = useLoaderData();

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
            <Form className={styles.form} method="post" action="/auth/login">
              <div className={styles.inputGroup}>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  required
                />
                <button className={styles.button} type="submit">
                  Open in Shopify →
                </button>
              </div>
              <div className={styles.hint}>
                Enter your permanent Shopify store domain to access the Merchant Dashboard.
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
