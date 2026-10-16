/**
 * Architecture & Integration Test Suite
 * Tests Rate Limiter, Billing Quota, Grounded Tools, Zod Validation, and Hydration.
 */

import { checkRateLimit } from "../app/lib/rateLimiter.js";
import { checkMessageQuota } from "../app/lib/billing.js";
import { executeTool, hydrateProductCards } from "../app/lib/tools.js";
import { normalizePhoneNumber } from "../app/services/orderService.js";
import { z } from "zod";

const mockCatalog = [
  {
    id: "gid://shopify/Product/101",
    title: "Heavyweight Cotton Black Hoodie",
    handle: "heavyweight-cotton-black-hoodie",
    description: "Premium fleece 450gsm heavyweight hoodie.",
    price: "4500.00",
    available: true,
    variants: [
      { id: "gid://shopify/ProductVariant/201", title: "M", price: "4500.00", available: true },
      { id: "gid://shopify/ProductVariant/202", title: "L", price: "4500.00", available: true }
    ],
    image: "https://cdn.shopify.com/hoodie.jpg"
  },
  {
    id: "gid://shopify/Product/102",
    title: "Classic Oxford White Shirt",
    handle: "classic-oxford-white-shirt",
    description: "100% Egyptian cotton formal shirt.",
    price: "3200.00",
    available: true,
    variants: [
      { id: "gid://shopify/ProductVariant/204", title: "M", price: "3200.00", available: true }
    ],
    image: "https://cdn.shopify.com/shirt.jpg"
  }
];

const mockStoreContext = {
  shopName: "Muasa Luxury Store",
  currencySymbol: "Rs.",
  currency: "PKR",
  catalog: mockCatalog,
  policies: {
    shipping: "Standard delivery in 2-4 business days nationwide. Free shipping over Rs. 3,000.",
    returns: "7-day hassle-free return and exchange policy."
  }
};

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("RUNNING SHOPIFY ARCHITECTURE & GROUNDING TEST SUITE");
  console.log("============================================================\n");

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Rate Limiter
  // --------------------------------------------------------------------------
  console.log("[1] Rate Limiter Validation:");
  const testIp = "192.168.1.100";
  const testShop = "test-store.myshopify.com";

  const firstReq = checkRateLimit(testIp, testShop);
  assert(firstReq.allowed === true, "First request from IP is allowed");

  let blocked = false;
  for (let i = 0; i < 35; i++) {
    const res = checkRateLimit(testIp, testShop);
    if (!res.allowed) {
      blocked = true;
      break;
    }
  }
  assert(blocked === true, "Rapid requests exceeding IP limit are throttled (429)");

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Billing & Quota Manager
  // --------------------------------------------------------------------------
  console.log("\n[2] Billing Plans & Quotas:");
  const freeShop = { plan: "FREE", messagesUsedThisMonth: 50, billingCycleStart: new Date() };
  const freeQuota = checkMessageQuota(freeShop);
  assert(freeQuota.allowed === true && freeQuota.remaining === 50, "Free plan calculates 50 remaining out of 100");

  const cappedShop = { plan: "FREE", messagesUsedThisMonth: 100, billingCycleStart: new Date() };
  const cappedQuota = checkMessageQuota(cappedShop);
  assert(cappedQuota.allowed === false && cappedQuota.remaining === 0, "Exhausted quota correctly blocks further queries");

  const proShop = { plan: "PRO", messagesUsedThisMonth: 2500, billingCycleStart: new Date() };
  const proQuota = checkMessageQuota(proShop);
  assert(proQuota.allowed === true && proQuota.remaining === 2500, "Pro plan accommodates high volume (5,000 monthly limit)");

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Grounded Tools Execution
  // --------------------------------------------------------------------------
  console.log("\n[3] Tool Function Grounding:");

  // 3a: search_products
  const searchResult = await executeTool("search_products", { query: "black hoodie" }, mockStoreContext);
  assert(searchResult.found === true && searchResult.results.length === 1, "search_products returns matched item");

  // 3b: search_products with typo
  const typoResult = await executeTool("search_products", { query: "blck hodi" }, mockStoreContext);
  assert(typoResult.found === true && typoResult.results[0].handle === "heavyweight-cotton-black-hoodie", "Fuzzy search resolves typos 'blck hodi' -> 'black hoodie'");

  // 3c: search_products with non-existent item
  const missingResult = await executeTool("search_products", { query: "leather boots" }, mockStoreContext);
  assert(missingResult.found === false && missingResult.count === 0, "Uncatalogued search returns empty with zero hallucination");

  // 3d: get_product
  const getProdResult = await executeTool("get_product", { handleOrId: "classic-oxford-white-shirt" }, mockStoreContext);
  assert(getProdResult.found === true && getProdResult.product.handle === "classic-oxford-white-shirt", "get_product fetches exact handle details");

  // 3e: check_stock
  const stockResult = await executeTool("check_stock", { productIdentifier: "Heavyweight Cotton Black Hoodie" }, mockStoreContext);
  assert(stockResult.inStock === true, "check_stock confirms product is currently in stock");

  // 3f: get_policies
  const policyResult = await executeTool("get_policies", { topic: "shipping" }, mockStoreContext);
  assert(policyResult.topic === "shipping_and_delivery" && policyResult.policy.includes("2-4 business days"), "get_policies retrieves shipping policy text");

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Server-Side Product Hydration
  // --------------------------------------------------------------------------
  console.log("\n[4] Server-Side Product Card Hydration:");
  const hydrated = hydrateProductCards(["heavyweight-cotton-black-hoodie"], mockCatalog, "Rs.");
  assert(hydrated.length === 1, "Hydrates 1 product card");
  assert(hydrated[0].variantId === "201", "Hydrates numeric variant ID 201 for /cart/add.js");
  assert(hydrated[0].image.startsWith("https://cdn.shopify.com"), "Hydrates real image URL");

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Input Validation (Zod)
  // --------------------------------------------------------------------------
  console.log("\n[5] Zod Schema Validation:");
  const ChatRequestSchema = z.object({
    message: z.string().trim().min(1).max(500),
    sessionId: z.string().optional()
  });

  const validParsed = ChatRequestSchema.safeParse({ message: "What is your refund policy?" });
  assert(validParsed.success === true, "Valid 28-char message passes validation");

  const emptyParsed = ChatRequestSchema.safeParse({ message: "   " });
  assert(emptyParsed.success === false, "Empty / whitespace-only message rejected");

  const longText = "a".repeat(501);
  const longParsed = ChatRequestSchema.safeParse({ message: longText });
  assert(longParsed.success === false, "501-character message rejected (max 500)");

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Phone Normalization & E.164 Resilience
  // --------------------------------------------------------------------------
  console.log("\n[6] Phone Normalization & E.164 Resilience:");
  assert(normalizePhoneNumber("03001234567") === "+923001234567", "Normalizes local 03xx format: 03001234567 -> +923001234567");
  assert(normalizePhoneNumber("0300 1234567") === "+923001234567", "Strips spaces: '0300 1234567' -> +923001234567");
  assert(normalizePhoneNumber("0300-1234567") === "+923001234567", "Strips dashes: '0300-1234567' -> +923001234567");
  assert(normalizePhoneNumber("+92 300 1234567") === "+923001234567", "Handles existing +92 with spaces: '+92 300 1234567' -> +923001234567");
  assert(normalizePhoneNumber("923001234567") === "+923001234567", "Adds leading + if starting with 92: '923001234567' -> +923001234567");
  assert(normalizePhoneNumber("invalid") === null, "Returns null safely for invalid non-digits");

  console.log("\n============================================================");
  console.log(`RESULTS: ${passed} PASSED / ${passed + failed} TOTAL (${failed} FAILED)`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
