import { z } from "zod";
import { authenticate, unauthenticated } from "../shopify.server.js";
import { checkRateLimit } from "../lib/rateLimiter.js";
import { processCustomerChat } from "../lib/aiEngine.js";
import { getStoreCatalog } from "../services/catalogService.js";
import { createChatOrder } from "../services/orderService.js";
import {
  getOrCreateShop,
  getShopSettings,
  verifyShopQuota,
  saveChatMessage,
  logAnalyticsEvent
} from "../services/shopService.js";

const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(500, "Message exceeds 500 characters limit"),
  sessionId: z.string().optional().default(() => "sess_" + Math.random().toString(36).substring(2, 10)),
  currency: z.string().optional().default("PKR"),
  offset: z.number().int().nonnegative().optional().default(0),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).optional().default([])
});

const TrackRequestSchema = z.object({
  action: z.literal("track"),
  eventType: z.enum(["chat_started", "product_clicked", "add_to_cart_clicked", "order_placed"]),
  productHandle: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

function getCurrencySymbol(code) {
  const c = (code || "").toUpperCase();
  if (c === "PKR") return "Rs.";
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "GBP") return "£";
  if (c === "INR") return "₹";
  return c || "Rs.";
}

/**
 * Handle GET requests to App Proxy
 * Returns public widget configuration, health check, and available collections for carousel
 */
export const loader = async ({ request }) => {
  let appProxyAuth;
  try {
    appProxyAuth = await authenticate.public.appProxy(request);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid App Proxy HMAC signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") || appProxyAuth.session?.shop;

  if (!shopDomain) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const settings = await getShopSettings(shopDomain);
  const catalogData = await getStoreCatalog(shopDomain, appProxyAuth.admin);
  const currency = catalogData.shopInfo?.currency || "PKR";
  const currencySymbol = getCurrencySymbol(currency);

  return new Response(JSON.stringify({
    ok: true,
    settings: {
      botName: settings.botName,
      greeting: settings.greeting,
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
      position: settings.position,
      enabled: settings.enabled,
      supportEmail: settings.supportEmail
    },
    currency,
    currencySymbol,
    collections: catalogData.collections || []
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

/**
 * Handle POST requests to App Proxy (Chat & Analytics)
 */
export const action = async ({ request }) => {
  let appProxyAuth;
  try {
    appProxyAuth = await authenticate.public.appProxy(request);
  } catch (err) {
    console.warn("[AppProxy] Signature verification failed:", err.message);
    return new Response(JSON.stringify({
      error: "Unauthorized: Invalid Shopify HMAC signature. Direct calls outside Shopify App Proxy are forbidden."
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") || appProxyAuth.session?.shop;

  if (!shopDomain) {
    return new Response(JSON.stringify({ error: "Missing shop domain in proxy query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Rate Limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   request.headers.get("x-real-ip") ||
                   "127.0.0.1";

  const rateCheck = checkRateLimit(clientIp, shopDomain);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({
      error: rateCheck.reason,
      retryAfter: rateCheck.retryAfter
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateCheck.retryAfter || 30)
      }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle analytics tracking action
  if (body.action === "track") {
    const trackValidation = TrackRequestSchema.safeParse(body);
    if (!trackValidation.success) {
      return new Response(JSON.stringify({ error: "Invalid tracking payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const shop = await getOrCreateShop(shopDomain);
    await logAnalyticsEvent(
      shop.id,
      trackValidation.data.eventType,
      trackValidation.data.productHandle,
      trackValidation.data.metadata
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle In-Chat Order Creation directly to Shopify Admin
  if (body.action === "create_order") {
    let admin = appProxyAuth.admin;
    if (!admin) {
      try {
        const authResult = await unauthenticated.admin(shopDomain);
        admin = authResult.admin;
      } catch (authErr) {
        console.warn("[AppProxy] Admin auth fallback error:", authErr.message);
      }
    }

    try {
      const orderResult = await createChatOrder(admin, body.customer || {}, body.items || []);
      
      const shop = await getOrCreateShop(shopDomain);
      await logAnalyticsEvent(shop.id, "order_placed", null, {
        orderNumber: orderResult.orderNumber,
        customerName: `${body.customer?.firstName || ''} ${body.customer?.lastName || ''}`.trim(),
        totalPrice: orderResult.totalPrice,
        isOfficialOrder: orderResult.isOfficialOrder
      });

      return new Response(JSON.stringify({
        ok: true,
        orderNumber: orderResult.orderNumber,
        isOfficialOrder: orderResult.isOfficialOrder,
        totalPrice: orderResult.totalPrice
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (orderErr) {
      console.error("[AppProxy] In-chat order creation failed:", orderErr);
      return new Response(JSON.stringify({
        error: orderErr.message || "Failed to register order in store"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle Chat action
  const chatValidation = ChatRequestSchema.safeParse(body);
  if (!chatValidation.success) {
    const errorMsg = chatValidation.error.issues?.[0]?.message || "Invalid input";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { message, sessionId, offset, conversationHistory } = chatValidation.data;

  // Quota & Billing Status
  const { shop, quota } = await verifyShopQuota(shopDomain);
  if (!quota.allowed) {
    return new Response(JSON.stringify({
      heading: "Customer Support",
      reply: "Our customer care assistant has temporarily reached its monthly conversation limit. Please reach out to store support via WhatsApp or email directly!",
      products: [],
      quotaExceeded: true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Settings Enabled Check
  const settings = await getShopSettings(shopDomain);
  if (settings && settings.enabled === false) {
    return new Response(JSON.stringify({
      heading: "Customer Support",
      reply: "Our customer care team is currently offline. Please explore our collections directly!",
      products: []
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Grounded Catalog & Policies
  const catalogData = await getStoreCatalog(shopDomain, appProxyAuth.admin);

  const currency = catalogData.shopInfo?.currency || "PKR";
  const currencySymbol = getCurrencySymbol(currency);

  const shopContext = {
    brandName: catalogData.shopInfo?.name || shopDomain,
    brandVoice: settings?.brandTone || "Friendly, helpful customer support concierge",
    currency,
    currencySymbol,
    policies: catalogData.policies || {}
  };

  const aiResult = await processCustomerChat({
    userMessage: message,
    catalog: catalogData.products || [],
    shopContext,
    conversationHistory,
    offset
  });

  // DB Logging
  try {
    await saveChatMessage({
      shopId: shop.id,
      customerSessionId: sessionId,
      userMessage: message,
      assistantReply: aiResult.reply,
      productsRecommended: (aiResult.products || []).map(p => p.handle || p.id)
    });

    await logAnalyticsEvent(shop.id, "message_sent", null, {
      modelUsed: aiResult.modelUsed || "intent_guard",
      productCount: (aiResult.products || []).length
    });
  } catch (dbErr) {
    console.error("[AppProxy] DB logging error:", dbErr.message);
  }

  return new Response(JSON.stringify({
    heading: aiResult.heading || "Customer Support",
    reply: aiResult.reply,
    products: aiResult.products || [],
    chips: aiResult.chips || [],
    hasMore: aiResult.hasMore || false,
    totalMatches: aiResult.totalMatches || 0,
    modelUsed: aiResult.modelUsed
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
