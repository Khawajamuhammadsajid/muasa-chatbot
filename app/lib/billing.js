/**
 * Billing Configuration & Quota Management for Muasa Bot
 */

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Free Trial",
    price: 0,
    interval: "EVERY_30_DAYS",
    messageLimit: 100, // ~10 messages/day trial
    features: [
      "10 free AI chats per day",
      "Grounded product catalog search",
      "Storefront dark theme widget",
      "Cart & checkout integration"
    ]
  },
  STARTER: {
    id: "STARTER",
    name: "Growth Plan",
    price: 15,
    interval: "EVERY_30_DAYS",
    messageLimit: 1000, // 1,000 conversations
    features: [
      "1,000 AI conversations / month",
      "Sub-second fast AI responses",
      "Multi-product add to cart & in-chat checkout",
      "30-day chat history retention",
      "Full product recommendations"
    ]
  },
  PRO: {
    id: "PRO",
    name: "Scale Pro Plan",
    price: 30,
    interval: "EVERY_30_DAYS",
    messageLimit: 5000, // 5,000 conversations
    features: [
      "5,000 AI conversations / month",
      "Fastest priority model routing",
      "Advanced sales conversion analytics",
      "Custom brand voice and styling",
      "Priority customer care"
    ]
  }
};

/**
 * Checks if a shop has exceeded its monthly quota
 * @param {object} shop - The Prisma Shop record
 * @returns {{ allowed: boolean, remaining: number, limit: number, plan: string }}
 */
export function checkMessageQuota(shop) {
  const planKey = (shop.plan || "FREE").toUpperCase();
  const plan = PLANS[planKey] || PLANS.FREE;

  // Check if billing cycle should reset (every 30 days)
  const now = new Date();
  const cycleStart = new Date(shop.billingCycleStart || now);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const isNewCycle = now.getTime() - cycleStart.getTime() > thirtyDaysMs;

  const currentUsage = isNewCycle ? 0 : (shop.messagesUsedThisMonth || 0);
  const remaining = Math.max(0, plan.messageLimit - currentUsage);

  return {
    allowed: currentUsage < plan.messageLimit,
    remaining,
    limit: plan.messageLimit,
    usage: currentUsage,
    plan: plan.name,
    planId: plan.id,
    isNewCycle
  };
}
