import dotenv from "dotenv";
dotenv.config();
process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "dummy_secret_for_test";
const { processCustomerChat } = await import("../app/lib/aiEngine.js");

const storeContext = {
  brandName: "BareBeauty PK",
  currencySymbol: "Rs.",
  currency: "PKR",
  policies: {
    shipping: "Nationwide delivery across Pakistan in 2-4 business days. Cash on delivery (COD) available everywhere.",
    refund: "7-day return and exchange policy for undamaged items."
  }
};

const catalog = [
  {
    id: "gid://shopify/Product/1",
    title: "The Nourish: Rosemary Shampoo",
    handle: "the-nourish-rosemary-shampoo",
    description: "Designed to boost hair growth, repair split ends, and provide deep cleansing and nourishment. Gentle formula.",
    productType: "Hair Care",
    tags: ["shampoo", "hairfall", "rosemary", "organic"],
    price: "1,700",
    inStock: true,
    variants: [{ id: "gid://shopify/ProductVariant/101", title: "Default", price: "1,700", availableForSale: true }]
  },
  {
    id: "gid://shopify/Product/2",
    title: "Deep Healing Daily Moisturizer",
    handle: "deep-healing-daily-moisturizer",
    description: "Deep hydration for dull, dry and patchy skin. Non-greasy and lightweight texture with ceramides and hyaluronic acid.",
    productType: "Moisturizers",
    tags: ["moisturizer", "dry skin", "hydration", "ceramides"],
    price: "2,100",
    inStock: true,
    variants: [{ id: "gid://shopify/ProductVariant/102", title: "Default", price: "2,100", availableForSale: true }]
  },
  {
    id: "gid://shopify/Product/3",
    title: "Fairer & Eventone Skin Whitening Serum",
    handle: "skin-whitening-serum",
    description: "Targets uneven skin tone, lightens skin complexion, hydrates skin with alpha arbutin and niacinamide.",
    productType: "Serums",
    tags: ["serum", "brightening", "niacinamide", "glow"],
    price: "2,500",
    inStock: true,
    variants: [{ id: "gid://shopify/ProductVariant/103", title: "Default", price: "2,500", availableForSale: true }]
  },
  {
    id: "gid://shopify/Product/4",
    title: "Clarifying Gentle Foaming Cleanser",
    handle: "clarifying-gentle-foaming-cleanser",
    description: "Cleanses deep pores, removes excess sebum and acne-causing bacteria without stripping moisture. Salicylic acid formula.",
    productType: "Cleansers",
    tags: ["cleanser", "acne", "oily skin", "foaming"],
    price: "1,850",
    inStock: true,
    variants: [{ id: "gid://shopify/ProductVariant/104", title: "Default", price: "1,850", availableForSale: true }]
  }
];

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING PRODUCTION AI CUSTOMER CARE CONCIERGE");
  console.log("=================================================");

  // Scenario 1: Tell me more about Shampoos
  console.log("\n[1] Product Inquiry: 'Tell me more about Shampoos'");
  const r1 = await processCustomerChat({
    userMessage: "Tell me more about Shampoos",
    storeContext,
    catalog,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r1.heading);
  console.log("Reply:", r1.reply);
  console.log("Products:", r1.products.map(p => p.title));
  console.log("Chips:", r1.chips);

  // Scenario 2: Multi-turn Follow-up
  console.log("\n[2] Multi-turn follow-up: 'How should I apply it and how often?'");
  const history = [
    { role: "user", content: "Tell me more about Shampoos" },
    { role: "assistant", content: r1.reply }
  ];
  const r2 = await processCustomerChat({
    userMessage: "How should I apply it and how often?",
    storeContext,
    catalog,
    conversationHistory: history,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r2.heading);
  console.log("Reply:", r2.reply);
  console.log("Products:", r2.products.map(p => p.title));
  console.log("Chips:", r2.chips);

  // Scenario 3: Roman Urdu symptom recommendation
  console.log("\n[3] Roman Urdu Symptom: 'Meri skin bohot dry aur patchy hai, kya use karu?'");
  const r3 = await processCustomerChat({
    userMessage: "Meri skin bohot dry aur patchy hai, kya use karu?",
    storeContext,
    catalog,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r3.heading);
  console.log("Reply:", r3.reply);
  console.log("Products:", r3.products.map(p => p.title));
  console.log("Chips:", r3.chips);

  // Scenario 4: Policy question (COD & Delivery time)
  console.log("\n[4] Policy Question: 'Lahore me delivery kitne din me hogi aur COD hai?'");
  const r4 = await processCustomerChat({
    userMessage: "Lahore me delivery kitne din me hogi aur COD hai?",
    storeContext,
    catalog,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r4.heading);
  console.log("Reply:", r4.reply);
  console.log("Chips:", r4.chips);

  // Scenario 5: Budget filter
  console.log("\n[5] Budget Inquiry: 'Show me products under Rs 2000'");
  const r5 = await processCustomerChat({
    userMessage: "Show me products under Rs 2000",
    storeContext,
    catalog,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r5.heading);
  console.log("Reply:", r5.reply);
  console.log("Products:", r5.products.map(p => p.title));
  console.log("Chips:", r5.chips);

  // Scenario 6: Gibberish input e.g. "fffff"
  console.log("\n[6] Gibberish Test: 'fffff'");
  const r6 = await processCustomerChat({
    userMessage: "fffff",
    storeContext,
    catalog,
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r6.heading);
  console.log("Reply:", r6.reply);
  console.log("Products Count:", r6.products.length, "(Must be 0)");
  console.log("Model Used:", r6.modelUsed);

  // Scenario 7: Follow-up greeting in ongoing conversation
  console.log("\n[7] Multi-turn Follow-up Greeting: 'hello'");
  const r7 = await processCustomerChat({
    userMessage: "hello",
    storeContext,
    catalog,
    conversationHistory: [{ role: "user", content: "Tell me more about Shampoos" }, { role: "assistant", content: "Here is rosemary shampoo" }],
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log("Heading:", r7.heading);
  console.log("Reply:", r7.reply);
  console.log("Products Count:", r7.products.length, "(Must be 0)");
  console.log("Model Used:", r7.modelUsed);
}

runTests().catch(console.error);
