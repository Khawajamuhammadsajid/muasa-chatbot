# Muasa Bot — Autonomous Shopify AI Shopping Assistant

> **Production-Grade, App Store-Ready Shopify AI Shopping Concierge**  
> Built with **React Router v7**, **Shopify Polaris**, **Theme App Extension**, and **Google Gemini 2026** backend.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Shopper Storefront                     │
│   (Theme App Embed: HTML / Accessible JS / Frosted CSS)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /apps/muasa-bot/chat
                               │ (Cryptographic HMAC Verification)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Shopify App Proxy                      │
│             (/api/proxy via HMAC authentication)            │
│  - Per-IP & Per-Shop Sliding Window Rate Limiting (429)     │
│  - Input Validation via Zod (Max 500 chars)                 │
│  - Monthly Billing Quota & Usage Metering                   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Multi-Layer AI Grounding Engine             │
│                                                             │
│  [Layer A] Per-Shop Dynamic Grounded System Instructions    │
│  [Layer B] Pre-Flight Intent Guard (0-token off-topic check)│
│  [Layer C] Grounded Tool Calls:                             │
│            • search_products (with typo phonetic matching)  │
│            • get_product                                    │
│            • get_policies (shipping, returns, contact)      │
│            • check_stock (live variant availability)        │
│  [Layer D] Prompt Injection Defense (DAN, override, leaks)  │
│  [Layer E] Server-Side Verified Variant Card Hydration      │
│  [Layer F] Model Fallback Chain:                            │
│            gemini-3.7-flash -> gemini-3.5-flash ->          │
│            gemini-3.1-flash-lite -> gemini-flash-latest     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               SQLite / Prisma Multi-Tenant DB               │
│  - Models: Shop, Settings, Conversation, Message, Analytics │
│  - Auto-Prune Data Retention (30-day default)               │
│  - Mandatory GDPR Compliance: customers/data_request,       │
│    customers/redact, shop/redact, app/uninstalled           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Features

1. **Strictly Store-Only AI Intelligence**:
   - Polished multilingual support (English, Roman Urdu, Urdu, Hindi).
   - Zero hallucination: Never fabricates uncatalogued items, prices, or fake discounts.
   - Competitor queries (Daraz, Amazon, Temu, Shein) and general trivia (politics, coding, math) are politely refused without burning model tokens.

2. **Server-Hydrated Product Recommendations**:
   - Model returns only product handles/IDs.
   - Server verifies inventory in real time and attaches in-stock numeric variant IDs for direct `/cart/add.js` checkout.

3. **Shopify App Proxy & Enterprise Security**:
   - No direct unauthenticated storefront API endpoints.
   - Every storefront request is cryptographically signed and verified using Shopify HMAC.
   - Sliding-window rate limiting prevents abuse (30 req/min per IP, 180 req/min per shop).

4. **Merchant Control & Privacy (Polaris Admin)**:
   - **Dashboard**: Onboarding status, embed activation button, live catalog preview, and AI engine health alerts.
   - **Settings**: Bot personality, brand demeanor, widget colors, screen position, enabled toggle, and human email fallback.
   - **Analytics**: Conversions, total chats, add-to-cart clicks, and customer query trends.
   - **Billing**: Free Trial (100 messages/mo), Starter ($9.99/mo), and Pro ($29.99/mo).

5. **Theme App Extension Excellence**:
   - Zero external CDNs or Google Fonts (inherits theme typography for zero layout shift and Lighthouse performance).
   - Keyboard accessible: focus trap, `Escape` key close listener, and ARIA labels.
   - Sound is **OFF by default** with an accessible header mute toggle.
   - Respects `@media (prefers-reduced-motion: reduce)`.

---

## 🛠️ Environment Configuration

Create a `.env` file in the root directory:

```env
# Shopify Credentials (injected by Shopify CLI or Partner Dashboard)
SHOPIFY_API_KEY=your_shopify_client_id
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_APP_URL=https://your-tunnel-or-domain.com

# Server-Side Google Gemini API Key
GEMINI_API_KEY=your_gemini_key_from_google_ai_studio
GEMINI_MODEL=gemini-3.7-flash

# Minimum Scopes
SCOPES=read_products,read_inventory

# Server Options
PORT=3000
NODE_ENV=development
```

---

## 🚀 Quick Start & Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Sync Prisma Database**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Run Test Suites**:
   ```bash
   node test/ai_guard_test.js        # 43/43 tests passed
   node test/architecture_test.js    # 17/17 tests passed
   ```

4. **Start Shopify Development Server**:
   ```bash
   shopify app dev
   ```

5. **Activate Theme Extension**:
   - Open your development store: `muasa-chatbot.myshopify.com`.
   - Go to **Online Store > Themes > Customize**.
   - Select **App Embeds** (left sidebar).
   - Toggle **Muasa AI Assistant** to **ON** and click **Save**.

---

## 📦 Production Build & Deployment

```bash
# Production Build
npm run build

# Start Production Server
npm run start

# Deploy Extension & App Configuration to Shopify
shopify app deploy
```

---

## 📋 Shopify App Store Review Checklist

- [x] **Mandatory GDPR Webhooks**:
  - `customers/data_request` -> `app/routes/webhooks.customers.data_request.jsx` (200 OK)
  - `customers/redact` -> `app/routes/webhooks.customers.redact.jsx` (200 OK)
  - `shop/redact` -> `app/routes/webhooks.shop.redact.jsx` (200 OK, purges shop data)
  - `app/uninstalled` -> `app/routes/webhooks.app.uninstalled.jsx` (cleans session tokens)
- [x] **App Proxy Architecture**:
  - Subpath: `/apps/muasa-bot`
  - All calls verified with `authenticate.public.appProxy(request)`
- [x] **Minimum Access Scopes**:
  - `read_products`: To query store titles, prices, descriptions, and variants.
  - `read_inventory`: To verify real-time stock levels.
  - No extraneous scopes (`write_products`, `read_themes` removed).
- [x] **Zero Plaintext Credentials in Merchant UI**:
  - `GEMINI_API_KEY` lives strictly in server environment variables.
- [x] **Storefront Performance & Accessibility**:
  - No external CDN stylesheets/fonts.
  - Mute sound toggle (sound default OFF).
  - Reduced motion CSS media queries.
  - Focus trap and Escape key listener.
- [x] **Automated Test Coverage**:
  - 60 comprehensive automated tests passing with zero failures.
