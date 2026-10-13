import prisma from "../db.server.js";
import { checkMessageQuota } from "../lib/billing.js";

/**
 * Multi-tenant Shop & Conversation Management Service
 */

/**
 * Gets or creates a Shop and default Settings in Prisma
 * @param {string} domain - e.g. "muasa-chatbot.myshopify.com"
 */
export async function getOrCreateShop(domain) {
  if (!domain) throw new Error("Domain is required");

  let shop = await prisma.shop.findUnique({
    where: { domain },
    include: { settings: true }
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        domain,
        plan: "FREE",
        messagesUsedThisMonth: 0,
        billingCycleStart: new Date(),
        settings: {
          create: {
            botName: "Shopping Assistant",
            greeting: "Hello! How can I help you find what you are looking for today?",
            brandTone: "Friendly, helpful luxury shopping assistant",
            primaryColor: "#111111",
            accentColor: "#6366f1",
            position: "bottom-right",
            enabled: true,
            retentionDays: 30
          }
        }
      },
      include: { settings: true }
    });
  } else if (!shop.settings) {
    // If shop existed without settings
    const settings = await prisma.settings.create({
      data: {
        shopId: shop.id,
        botName: "Shopping Assistant",
        greeting: "Hello! How can I help you find what you are looking for today?",
        brandTone: "Friendly, helpful luxury shopping assistant",
        primaryColor: "#111111",
        accentColor: "#6366f1",
        position: "bottom-right",
        enabled: true,
        retentionDays: 30
      }
    });
    shop.settings = settings;
  }

  return shop;
}

/**
 * Retrieve shop settings
 */
export async function getShopSettings(domain) {
  const shop = await getOrCreateShop(domain);
  return shop.settings;
}

/**
 * Updates shop settings
 */
export async function updateShopSettings(domain, data) {
  const shop = await getOrCreateShop(domain);
  return await prisma.settings.update({
    where: { shopId: shop.id },
    data
  });
}

/**
 * Verifies if shop can send another message
 */
export async function verifyShopQuota(domain) {
  const shop = await getOrCreateShop(domain);
  const quota = checkMessageQuota(shop);

  if (quota.isNewCycle) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        messagesUsedThisMonth: 0,
        billingCycleStart: new Date()
      }
    });
  }

  return { shop, quota };
}

/**
 * Record conversation and messages
 */
export async function saveChatMessage({
  shopId,
  customerSessionId,
  userMessage,
  assistantReply,
  productsRecommended = []
}) {
  // Find or create conversation within past 24 hours for this session
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let conversation = await prisma.conversation.findFirst({
    where: {
      shopId,
      customerSessionId,
      createdAt: { gte: yesterday }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        shopId,
        customerSessionId
      }
    });
  }

  // Save user message
  if (userMessage) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userMessage
      }
    });
  }

  // Save assistant message
  if (assistantReply) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantReply,
        productsRecommended: productsRecommended.length > 0 ? JSON.stringify(productsRecommended) : null
      }
    });
  }

  // Increment shop message count
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      messagesUsedThisMonth: { increment: 1 }
    }
  });

  return conversation;
}

/**
 * Record an analytics event
 */
export async function logAnalyticsEvent(shopId, eventType, productHandle = null, metadata = null) {
  try {
    return await prisma.analytics.create({
      data: {
        shopId,
        eventType,
        productHandle,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (err) {
    console.error("[Analytics Error]", err.message);
  }
}

/**
 * Prune conversations older than retentionDays
 */
export async function pruneExpiredConversations(shopId, retentionDays = 30) {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.conversation.deleteMany({
      where: {
        shopId,
        createdAt: { lt: cutoff }
      }
    });
    return result.count;
  } catch (err) {
    console.error("[Prune Error]", err.message);
    return 0;
  }
}

/**
 * GDPR: Redact customer conversations
 */
export async function redactCustomerConversations(domain, customerSessionId) {
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) return 0;

  const result = await prisma.conversation.deleteMany({
    where: {
      shopId: shop.id,
      customerSessionId
    }
  });
  return result.count;
}

/**
 * GDPR: Completely purge shop records
 */
export async function purgeShop(domain) {
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) return;

  await prisma.shop.delete({
    where: { id: shop.id }
  });
}
