/**
 * ============================================================================
 * Production-Grade Intelligent AI Shopping Assistant & Customer Care Concierge
 * Inspired by barebeautypk.com — Grounded Semantic Intelligence, Multi-Turn Memory
 * ============================================================================
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { evaluateMessageScope } from "./intentGuard.js";
import { searchCatalogProducts } from "../services/catalogService.js";
import { hydrateProductCards } from "./tools.js";

const DEFAULT_MODEL_CHAIN = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash"
].filter(Boolean);

let aiHealthStatus = {
  isHealthy: true,
  lastError: null,
  lastErrorTime: null,
  activeModel: DEFAULT_MODEL_CHAIN[0]
};

export function getAiHealthStatus() {
  return aiHealthStatus;
}

export function recordAiSuccess(modelName) {
  aiHealthStatus = {
    isHealthy: true,
    lastError: null,
    lastErrorTime: null,
    activeModel: modelName
  };
}

export function recordAiFailure(errorMsg) {
  aiHealthStatus = {
    isHealthy: false,
    lastError: errorMsg,
    lastErrorTime: new Date().toISOString(),
    activeModel: null
  };
}

/**
 * Builds customer support system prompt with full catalog awareness and multi-turn memory
 */
export function buildCustomerSupportPrompt(storeContext, catalog = [], conversationHistory = []) {
  const shopName = storeContext.brandName || storeContext.shopName || "Our Store";
  const currencySymbol = storeContext.currencySymbol || "Rs.";
  const currency = storeContext.currency || "PKR";
  const policies = storeContext.policies || {};

  // Build structured catalog representation for up to 50 active products
  const productSnippets = (catalog || []).slice(0, 50).map((p, idx) => {
    const varText = (p.variants || [])
      .map(v => `${v.title}: ${currencySymbol} ${v.price}`)
      .join(", ");
    const tags = Array.isArray(p.tags) ? p.tags.join(", ") : "";
    return `${idx + 1}. [${p.title}] (Handle: "${p.handle}")
   - Category: ${p.productType || "General"} | Tags: ${tags || "none"}
   - Price: ${currencySymbol} ${p.price} | Status: ${p.inStock ? "In Stock" : "Out of Stock"}
   - Details & Benefits: ${p.description || "Premium high-grade formulation."}
   - Variants: ${varText || "Default"}`;
  }).join("\n\n");

  // Format previous conversation history for multi-turn awareness
  let historySection = "";
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const formattedHistory = conversationHistory
      .slice(-6)
      .map(m => `${m.role === "user" ? "Shopper" : "Assistant"}: ${m.content}`)
      .join("\n");
    historySection = `\nRECENT CONVERSATION HISTORY:\n${formattedHistory}\n`;
  }

  return `You are the expert, courteous Customer Support & Shopping Concierge for "${shopName}".
Your mission is to assist shoppers, answer product and store policy questions, recommend the right items from the store catalog, and provide clear, helpful advice tailored strictly to the products this store sells.

CRITICAL OPERATING RULES:
1. IDENTITY & STORE DOMAIN ADAPTATION:
   - Act as dedicated store customer care. Polite, knowledgeable, consultative, and concise.
   - Ground all product knowledge strictly in the actual store products, categories, and descriptions provided below.
   - NEVER assume the store only sells skincare or beauty. If the store sells autoparts, apparel, sports/outdoor gear (e.g. ski wax), electronics, or accessories, tailor your terminology, tone, and guidance strictly to that product category.
   - Use bold markdown (**bold**) for key product titles, specifications, materials, and core benefits.

2. LANGUAGE:
   - Match the shopper's language fluently.
   - If English: Respond in polished, warm English.
   - If Roman Urdu / Hindi (e.g. "kya hai", "kitne ka hai", "deliver kab hoga", "kuch batao"): Respond in natural, polite Roman Urdu.

3. CATALOG ACCURACY:
   - Recommend products ONLY from the store catalog below.
   - Use the EXACT product handles provided in the catalog.
   - Recommend 1 to 5 most relevant products per answer.
   - Never invent or hallucinate products, prices, or fake discounts.

4. STORE POLICIES:
   - Shipping: ${policies.shipping || "Nationwide delivery across Pakistan in 2-4 business days. Cash on delivery (COD) available."}
   - Returns/Exchange: ${policies.refund || "7-day return and exchange policy for undamaged items."}
   - Currency: ${currencySymbol} (${currency}).

5. DIRECT, TO-THE-POINT REPLIES (NO REPETITIVE GREETINGS):
   - Get straight to the point! Be direct, helpful, and consultative without unnecessary filler.
   - If there is RECENT CONVERSATION HISTORY above, STRICTLY DO NOT say "Hello", "Hi", "Hello again", "Assalam-o-Alaikum", "Aoa", or "Welcome".
   - Answer the question immediately.

6. DYNAMIC & RELEVANT PRODUCT DETAILS (MANDATORY):
   - Whenever the shopper searches for or asks about ANY product or collection:
     1. ALWAYS provide relevant product details FIRST in your reply text before the product cards:
        - Accurately describe the product based on its ACTUAL CATEGORY and catalog details:
          * For Skincare/Cosmetics: Mention skin type suitability, active ingredients, and skin benefits.
          * For Sports/Outdoor/Wax (e.g. Ski Wax): Mention gear type, snow/temperature conditions, glide performance, and base protection.
          * For Auto Parts/Hardware: Mention vehicle fitment, build material, performance, and durability.
          * For Apparel/Fashion: Mention fabric/material, fit, style, and occasions.
          * For General items: Mention core purpose, key specifications, and main benefits.
        - NEVER label a non-skincare product as "Best for skin" or "dermatological"!
     2. Keep it structured, informative, and engaging.

AVAILABLE STORE PRODUCTS:
${productSnippets || "Catalog currently updating."}
${historySection}
REQUIRED JSON OUTPUT:
You must return valid JSON matching this schema:
{
  "heading": "Descriptive topic heading (e.g. 'Hair Care & Shampoos', 'Dry Skin Hydration', 'Shipping & Delivery')",
  "reply": "Your helpful, formatted conversational response in the shopper's language (bold key details)",
  "recommendedHandles": ["exact-product-handle-1", "exact-product-handle-2"],
  "chips": ["3 to 4 quick action pills, e.g. 'Add to cart', 'Delivery Info', 'Shop Cleansers']
}`;
}

/**
 * Production Multi-Turn Customer Support AI Generation
 */
export async function processCustomerChat({
  userMessage,
  message: rawMessage,
  storeContext = {},
  shopContext = {},
  catalog = [],
  customerContext = {},
  conversationHistory = [],
  offset = 0,
  apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY_API
}) {
  const message = userMessage || rawMessage;
  const mergedContext = {
    ...storeContext,
    ...shopContext,
    catalog: (catalog && catalog.length > 0) ? catalog : (storeContext.catalog || [])
  };

  const shopName = mergedContext.brandName || mergedContext.shopName || customerContext.shopName || "Our Store";

  // 1. Pre-Flight Intent Guard (Security & Injection Filter)
  const scopeCheck = evaluateMessageScope(message, shopName);
  if (!scopeCheck.allowed) {
    return {
      heading: "Customer Support",
      reply: scopeCheck.cannedReply,
      products: [],
      chips: ["Explore Best Sellers", "Delivery & COD Info", "Return Policy"],
      hasMore: false,
      modelUsed: "intent_guard"
    };
  }

  // 1.2 Repetitive Keystrokes or Gibberish Input Guidance (e.g. "fffff", "asdfasdf", "aaaa")
  const trimmed = (message || "").trim();
  const isGibberish = (str) => {
    if (!str) return false;
    const s = str.trim().toLowerCase();
    if (/^(.)\1{2,}$/.test(s)) return true;
    if (s.length >= 4 && !/[aeiouy]/i.test(s)) return true;
    return false;
  };

  if (isGibberish(trimmed)) {
    const isUrdu = /salam|aoa|kya|batao|karo/i.test(trimmed);
    return {
      heading: "Store Shopping Guide",
      reply: isUrdu
        ? `Main **${shopName}** ka dedicated shopping concierge hoon! Main aapko products dhoondhnay, prices, sizing, ya delivery aur return policy ke baaray mein guide kar sakta hoon. Aaj main aapki kya madad kar sakta hoon?`
        : `I'm your **${shopName}** shopping assistant! How can I guide you today? Feel free to ask about our products, check prices or sizing, or ask about delivery and returns.`,
      products: [],
      chips: ["Explore Best Sellers", "Delivery & COD Info", "Return Policy", "Contact Support"],
      modelUsed: "clarification_guide"
    };
  }

  // 1.5 Instant Greeting Response (Sub-50ms latency for basic greetings)
  const GREETING_REGEX = /^(hi|hello|hey|salam|aoa|assalam\s*o?\s*alaikum|kya\s*haal|good\s*(morning|afternoon|evening)|hola)[!.,? ]*$/i;
  if (GREETING_REGEX.test(trimmed)) {
    const isUrdu = /salam|aoa|kya|haal/i.test(trimmed);
    const hasPriorHistory = Array.isArray(conversationHistory) && conversationHistory.length > 0;

    if (hasPriorHistory) {
      return {
        heading: "Shopping Assistance",
        reply: isUrdu
          ? `Main aapki aur kya madad kar sakta hoon? Kisi khas product, price, delivery ya order ke baaray mein poochiye.`
          : `How else can I assist your shopping today? Feel free to ask about any product, sizing, or delivery!`,
        products: [],
        chips: ["Explore Best Sellers", "Delivery & COD Info", "Return Policy"],
        modelUsed: "instant_greeting_followup"
      };
    }

    const greetingProducts = hydrateProductCards(
      (mergedContext.catalog || []).slice(0, 5).map(p => p.handle),
      mergedContext.catalog,
      mergedContext.currencySymbol || "Rs."
    );
    return {
      heading: `Welcome to ${shopName}`,
      reply: isUrdu
        ? `Aoa! Welcome to **${shopName}**! Main aapka shopping assistant hoon. Aaj aapki kya madad kar sakta hoon? Hamaray products, delivery, ya sizing ke baaray mein kuch bhi poochiye!`
        : `Hello! Welcome to **${shopName}**! How can I assist your shopping today? Feel free to ask about our products, recommendations, sizing, or delivery!`,
      products: greetingProducts,
      totalMatches: (mergedContext.catalog || []).length,
      hasMore: (mergedContext.catalog || []).length > 5,
      chips: ["Explore Best Sellers", "Delivery & COD Info", "Return Policy"],
      modelUsed: "instant_greeting"
    };
  }

  // 1.8 Instant Pagination Handler (offset > 0)
  // When a shopper clicks "Load More Products", return the next 5 catalog items instantly without re-invoking Gemini
  if (offset > 0) {
    const paged = searchCatalogProducts(mergedContext.catalog, message, 5, offset);
    const hydrated = hydrateProductCards(
      paged.products.map(p => p.handle),
      mergedContext.catalog,
      mergedContext.currencySymbol || "Rs."
    );
    const pageNum = Math.floor(offset / 5) + 1;
    return {
      heading: paged.products.length > 0 ? `More Products (Page ${pageNum})` : "Catalog",
      reply: paged.products.length > 0
        ? `Here are more items from **${shopName}**:`
        : `You've viewed all matching items in our store! Would you like help with sizing, delivery, or checking out?`,
      products: hydrated,
      totalMatches: paged.total,
      hasMore: paged.hasMore,
      chips: ["Proceed to Checkout", "Delivery Info", "Contact Support"],
      modelUsed: "instant_pagination"
    };
  }

  // Pre-search catalog for exact/fuzzy keyword matches
  const catalogSearch = searchCatalogProducts(mergedContext.catalog, message, 5, 0);

  // 2. Fallback if API key missing
  if (!apiKey) {
    recordAiFailure("Server GEMINI_API_KEY is not configured.");
    const fallbackHydrated = hydrateProductCards(
      catalogSearch.products.map(p => p.handle),
      mergedContext.catalog,
      mergedContext.currencySymbol || "Rs."
    );
    const hasMore = fallbackHydrated.length >= 5 && catalogSearch.total > fallbackHydrated.length;
    return {
      heading: "Customer Support",
      reply: `Welcome to **${shopName}** customer care! Here are our recommended items. How can we assist you with sizing or placing your order?`,
      products: fallbackHydrated,
      totalMatches: catalogSearch.total,
      hasMore: hasMore,
      chips: ["Explore Best Sellers", "Delivery Info", "Return Policy"],
      modelUsed: "catalog_direct"
    };
  }

  // 3. Multi-turn AI Generation with Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildCustomerSupportPrompt(mergedContext, mergedContext.catalog, conversationHistory);

  let lastError = null;

  for (const modelName of DEFAULT_MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 1200
        }
      });

      const promptText = `Shopper: "${message}"\nPlease advise the shopper and return valid JSON.`;
      
      // Timeout: abort attempt if model hangs longer than 8000ms
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Model request timeout (8000ms exceeded)")), 8000)
      );
      const generatePromise = model.generateContent(promptText);

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = result.response.text();

      let parsed = null;
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (_) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch (e) { void e; }
        }
      }

      if (!parsed) {
        throw new Error("Unable to parse model JSON output");
      }

      // Strip repetitive greetings in multi-turn conversations
      if (Array.isArray(conversationHistory) && conversationHistory.length > 0 && parsed.reply) {
        parsed.reply = parsed.reply
          .replace(/^(hello(\s+again)?|hi(\s+there)?|hey|assalam\s*o?\s*alaikum|aoa|salam|greeting[s]?)[!.,:\s]*/i, "")
          .trim();
        if (parsed.reply.length > 0) {
          parsed.reply = parsed.reply.charAt(0).toUpperCase() + parsed.reply.slice(1);
        }
      }

      // 4. Server-Side Card Hydration
      const candidateHandles = (Array.isArray(parsed.recommendedHandles) && parsed.recommendedHandles.length > 0)
        ? parsed.recommendedHandles
        : catalogSearch.products.map(p => p.handle);

      const hydratedCards = hydrateProductCards(
        candidateHandles,
        mergedContext.catalog,
        mergedContext.currencySymbol || "Rs."
      );

      // ACCURATE hasMore: Must ONLY be true if at least 5 products are shown AND more matches actually exist!
      const totalMatches = Math.max(catalogSearch.total, hydratedCards.length);
      const hasMore = hydratedCards.length >= 5 && totalMatches > hydratedCards.length;

      recordAiSuccess(modelName);

      return {
        heading: parsed.heading || "Customer Support",
        reply: parsed.reply || `Welcome to **${shopName}**! How can we assist you today?`,
        products: hydratedCards.slice(0, 5),
        totalMatches: totalMatches,
        hasMore: hasMore,
        chips: parsed.chips || ["Add to cart", "Delivery Info", "Contact Support"],
        modelUsed: modelName
      };

    } catch (err) {
      lastError = err;
      console.warn(`[aiEngine] Error with model ${modelName}: ${err.message}`);
    }
  }

  // 5. Resilient Fallback on Total Failure or Slow Model
  recordAiFailure(lastError?.message || "All Gemini models unavailable");
  const fallbackCards = catalogSearch.products.length > 0 ? hydrateProductCards(
    catalogSearch.products.map(p => p.handle),
    mergedContext.catalog,
    mergedContext.currencySymbol || "Rs."
  ) : [];

  const fallbackHasMore = fallbackCards.length >= 5 && catalogSearch.total > fallbackCards.length;

  return {
    heading: fallbackCards.length > 0 ? "Recommended Products" : "Customer Support",
    reply: fallbackCards.length > 0
      ? `Here are our recommended products from **${shopName}**. How can we help you with sizing or your order?`
      : `I'm here to guide your shopping at **${shopName}**! You can ask about our products, check prices, get sizing advice, or ask about our delivery and return policies. What can I find for you?`,
    products: fallbackCards,
    totalMatches: catalogSearch.total,
    hasMore: fallbackHasMore,
    chips: ["Explore Best Sellers", "Delivery & COD Info", "Return Policy", "Contact Support"],
    modelUsed: "catalog_fallback"
  };
}
