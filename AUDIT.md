# Muasa Bot - Comprehensive Architectural & Security Audit

**Target Store:** `muasa-chatbot.myshopify.com` (Development Store)  
**Production Store Safety:** `wearaffair-1770` is untouched and safe.  
**Audit Date:** October 2026  
**Auditor:** Senior Shopify App Engineer  

---

## 1. Executive Summary

Muasa Bot is currently a functional rapid prototype ("vibe coded") built on the official Shopify React Router v7 template, featuring a theme app extension (`extensions/shop-with-ai`) and Google Gemini integration. While the storefront widget renders cleanly and captures inputs, the current codebase contains critical security vulnerabilities, architectural anti-patterns, non-compliant access scopes, missing GDPR endpoints, and ungrounded LLM design that prevent Shopify App Store review approval.

This audit details all findings ranked by severity, followed by the planned implementation roadmap to bring the app to commercial, enterprise-grade production quality.

---

## 2. Issues Ranked by Severity

### 🚨 Critical Severity: Security & Shopify Compliance Breaches

| ID | Category | Component | Description |
|---|---|---|---|
| **SEC-01** | Security / Auth | `app/routes/api.chat.jsx` | **Unauthenticated Chat API Endpoint:** `/api/chat` does not verify Shopify App Proxy HMAC signatures (`authenticate.public.appProxy`). Anyone on the public internet can POST to this endpoint and drain Gemini API tokens. |
| **SEC-02** | Security / Key Leak | `app/routes/api.chat.jsx` & `server.js` | **Client-Supplied API Key Vector:** Endpoint accepts an `apiKey` in the JSON request body. Exposes keys to client manipulation and potential token exhaustion attacks. |
| **SEC-03** | Security / Storage | `app/routes/app._index.jsx` | **Plaintext Key Input in UI:** Admin dashboard prompted merchants to paste Gemini API keys into an unencrypted form field that modified in-memory `process.env`. Violates Shopify guidelines: API keys must reside in server environment variables only. |
| **SEC-04** | Abuse / DoS | `app/routes/api.chat.jsx` | **No Rate Limiting or Payload Bounds:** No IP-based or per-shop rate limiting; no maximum message length enforcement. Vulnerable to prompt flooding and token-exhaustion denial of service. |
| **SEC-05** | Mandatory Compliance | `shopify.app.toml` | **Missing Mandatory GDPR Webhooks:** App lacks handlers and subscriptions for `customers/data_request`, `customers/redact`, and `shop/redact`. Immediate rejection criterion during Shopify App Store review. |

---

### ⚠️ High Severity: Architecture & LLM Reliability

| ID | Category | Component | Description |
|---|---|---|---|
| **ARCH-01** | Architecture | `extensions/shop-with-ai/blocks/muasa_bot_embed.liquid` | **Bypassing Shopify App Proxy:** Widget directly calls hardcoded `http://localhost:4000/api/chat` or app URL instead of Shopify's native App Proxy (`https://{shop}/apps/muasa-bot/chat`). Causes mixed-content warnings on HTTPS storefronts and circumvents Shopify identity validation. |
| **ARCH-02** | Compliance | `shopify.app.toml` | **Excessive Access Scopes:** App requests `write_products`, `read_themes`, `write_metaobjects`, `write_metaobject_definitions`. A shopping assistant only needs `read_products` (and `read_inventory` for stock checks). Shopify App Store review requires minimal scopes with stated justification. |
| **ARCH-03** | LLM Architecture | `app/services/storeAnalyzer.cjs` & `geminiEngine.cjs` | **Prompt Stuffing vs. Tool-Based Retrieval:** Relies on an external Cheerio scraper hitting unauthenticated `/products.json`, slicing the top 40 products, and stuffing them into the prompt. Completely fails on stores with >40 items (500+ products) and password-protected storefronts. Must be replaced with tool-based retrieval (`search_products`, `get_product`, `check_stock`, `get_policies`) via Admin GraphQL. |
| **ARCH-04** | AI Scope & Hallucination | `app/services/geminiEngine.cjs` | **Missing Intent Guardrails & Tool Grounding:** Model is asked in prose not to talk about off-topic subjects, but lacks a cheap pre-model scope classifier, prompt-injection defenses, and grounded tool calling. If catalog is omitted, model can invent hallucinated prices, discounts, or inventory. |
| **ARCH-05** | Multi-Tenancy / DB | `prisma/schema.prisma` | **Missing Database Models & Multi-Tenant Isolation:** Prisma schema only contains `Session`. Missing `Shop`, `Settings`, `Conversation`, `Message`, and `Analytics` models. Global in-memory variables cause state leakage across multiple stores. |
| **ARCH-06** | Monetization | `app/` | **Missing Billing API Integration:** No subscription gating, free trial tracking, or message quota enforcement. |

---

### 🟡 Medium Severity: Reliability, UX & Accessibility

| ID | Category | Component | Description |
|---|---|---|---|
| **REL-01** | Resilience | `app/services/geminiSynthesizer.cjs` & `geminiEngine.cjs` | **Hardcoded / Deprecated Fallback Chains:** Hardcoded model arrays containing retired models (`gemini-2.0-flash`, `gemini-1.5-flash`) caused cascading 404 errors during 503 high-demand events. Fallback models should be validated via `ListModels` at boot and configured through environment variables. |
| **UX-01** | Storefront Accessibility | `extensions/shop-with-ai/assets/muasa-bot.js` & `.css` | **Widget Accessibility Deficiencies:** Missing keyboard focus trapping, missing `Escape` key close listener, missing ARIA live regions for assistant replies, lacks `prefers-reduced-motion` compliance, sound chime plays unconditionally without a mute toggle. |
| **UX-02** | Theme Performance | `extensions/shop-with-ai/blocks/muasa_bot_embed.liquid` | **Remote Asset Warning:** External Google Fonts `<link>` tag triggers Shopify Theme Check `RemoteAsset` warning. Must use system fonts or Shopify theme typography to avoid Lighthouse penalties. |
| **UX-03** | Admin Experience | `app/routes/app._index.jsx` | **Non-Standard Polaris Layout:** Lacks onboarding checklist, settings tabs, analytics visualization, and billing status. |

---

### ⚪ Low Severity: Code Quality & Dead Code

| ID | Category | Component | Description |
|---|---|---|---|
| **CODE-01** | Code Standards | `app/services/*.cjs` | **Mixed Module Formats:** CommonJS `.cjs` files using `require()` inside an ES module (`"type": "module"`) React Router project. Should be structured cleanly under `app/services/`, `app/lib/` as ES modules. |
| **CODE-02** | Dead Code | `extensions/shop-with-ai/` & `shopify.app.toml` | **Leftover Template Artifacts:** Unused `thumbs-up.png`, unused `en.default.json` ratings strings, and unused metaobject configurations in `shopify.app.toml`. |
| **CODE-03** | Testing | Project root | **No Automated Test Coverage:** Zero unit or integration tests for scope enforcement, HMAC signature validation, webhooks, or prompt injection defense. |

---

## 3. Implementation Plan & Fix Order

1. **Step 1: Core Store-Only AI Engine**
   - Implement multi-layered guardrails:
     - Cheap deterministic/regex intent classifier to reject off-topic queries with zero Gemini token cost.
     - Per-shop dynamic system prompt grounding.
     - Gemini Function Calling / Tool Calling (`search_products`, `get_product_details`, `get_store_policies`, `check_inventory`).
     - Prompt injection defense & output JSON schema validation.
     - 40+ automated test suite covering injection, off-topic queries, Roman Urdu, typos, and normal shopping.
2. **Step 2: Shopify Architecture & Compliance**
   - Declare and configure Shopify App Proxy (`/apps/muasa-bot/chat`) with strict HMAC verification via `authenticate.public.appProxy(request)`.
   - Implement per-shop & per-IP rate limiting and payload validation with `zod`.
   - Update `shopify.app.toml` with minimal scopes (`read_products`, `read_inventory`).
   - Implement mandatory GDPR webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) and `app/uninstalled` cleanup.
   - Update Prisma schema with `Shop`, `Settings`, `Conversation`, `Message`, and `Analytics` models with auto-retention cleanup.
   - Implement Shopify Billing API with Free Trial and Tiered plans gated by message usage.
   - Configure dynamic Gemini model discovery and exponential backoff retries.
3. **Step 3: Design, UX & Accessibility**
   - Admin: Build Polaris dashboard with Onboarding Checklist, Settings (name, greeting, tone, colors), Analytics, and Billing tabs.
   - Storefront Widget: Accessible modal with focus trap, ESC close, mute toggle (sound off by default), `prefers-reduced-motion`, configurable CSS variables, and "Talk to human" fallback.
4. **Step 4: Code Quality & App Store Readiness**
   - Clean modular ES modules under `app/services/` and `app/lib/`.
   - Complete unit and integration test runner.
   - Build validation (`shopify app build`) and App Store submission checklist in README.
