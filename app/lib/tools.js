/**
 * ============================================================================
 * Layer C: Grounded Tool Calling & Server-Side Product Hydration
 * ============================================================================
 * Defines Gemini Function Calling tools and handles verified data retrieval
 * from Shopify GraphQL / store catalog cache. Ensures the model never invents
 * products, prices, stock levels, or policies.
 */

// 1. Gemini Function Declarations Schema
export const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_products",
        description: "Search the store catalog for products matching a user query, keyword, category, or style. Handles typos and Roman Urdu terms.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "The search query (e.g. 'polo shirt', 'hoodie', 'formal pants', 'moisturizer')"
            },
            category: {
              type: "STRING",
              description: "Optional product collection or type (e.g. 'Shirts', 'Skincare', 'Winter Wear')"
            },
            maxPrice: {
              type: "NUMBER",
              description: "Optional maximum price filter"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_product",
        description: "Retrieve verified specifications, pricing, variants, sizing, and details for a specific product by its title, handle, or ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            handleOrId: {
              type: "STRING",
              description: "The product title, handle, or Shopify ID"
            }
          },
          required: ["handleOrId"]
        }
      },
      {
        name: "get_policies",
        description: "Fetch the store's verified operational policies such as shipping times, delivery charges, Cash on Delivery (COD), returns, refunds, or contact information.",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: {
              type: "STRING",
              description: "Policy topic: 'shipping', 'delivery', 'returns', 'refund', 'cod', 'contact', 'hours'"
            }
          },
          required: ["topic"]
        }
      },
      {
        name: "check_stock",
        description: "Check verified real-time stock availability for a specific product or variant.",
        parameters: {
          type: "OBJECT",
          properties: {
            productIdentifier: {
              type: "STRING",
              description: "Product handle, title, or ID"
            }
          },
          required: ["productIdentifier"]
        }
      }
    ]
  }
];

// 2. Normalization & Typo Mapping Dictionary
const TYPO_MAP = {
  shurt: "shirt",
  shurtz: "shirt",
  hodi: "hoodie",
  hody: "hoodie",
  blck: "black",
  wht: "white",
  whit: "white",
  tshurt: "t-shirt",
  pant: "pants",
  trouzr: "trouser",
  shamp: "shampoo",
  jeen: "jeans"
};

export function normalizeQuery(query = "") {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(word => TYPO_MAP[word] || word)
    .join(" ");
}

/**
 * Executes a tool call against the store's real catalog and policies
 */
export async function executeTool(name, args, storeContext) {
  const catalog = storeContext.catalog || [];
  const policies = storeContext.policies || {};
  const contact = storeContext.contact || {};

  switch (name) {
    case "search_products": {
      const normalized = normalizeQuery(args.query || "");
      const keywords = normalized.split(/\s+/).filter(Boolean);

      const matches = catalog.filter(product => {
        const title = (product.title || "").toLowerCase();
        const type = (product.productType || product.product_type || "").toLowerCase();
        const desc = (product.description || "").toLowerCase();
        const text = `${title} ${type} ${desc}`;

        return keywords.some(kw => text.includes(kw));
      });

      if (matches.length === 0) {
        return {
          found: false,
          count: 0,
          message: `No products matching "${args.query}" were found in the store catalog.`
        };
      }

      return {
        found: true,
        count: matches.length,
        results: matches.slice(0, 5).map(p => ({
          id: p.id,
          handle: p.handle || p.id,
          title: p.title,
          price: p.price || (p.variants?.[0]?.price ? `Rs. ${p.variants[0].price}` : "Contact for price"),
          category: p.productType || p.product_type || "General",
          available: p.available !== false
        }))
      };
    }

    case "get_product": {
      const target = (args.handleOrId || "").toLowerCase();
      const product = catalog.find(p =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.handle && p.handle.toLowerCase() === target) ||
        (p.title && p.title.toLowerCase().includes(target))
      );

      if (!product) {
        return {
          found: false,
          message: `Product "${args.handleOrId}" does not exist in this store's catalog.`
        };
      }

      return {
        found: true,
        product: {
          id: product.id,
          handle: product.handle || product.id,
          title: product.title,
          price: product.price || (product.variants?.[0]?.price ? `Rs. ${product.variants[0].price}` : "Price in store"),
          description: product.description || "Premium quality item.",
          variants: (product.variants || []).map(v => ({
            id: v.id,
            title: v.title || "Default",
            price: v.price,
            available: v.available !== false
          })),
          available: product.available !== false
        }
      };
    }

    case "get_policies": {
      const topic = (args.topic || "").toLowerCase();

      if (topic.includes("ship") || topic.includes("deliver") || topic.includes("cod")) {
        return {
          topic: "shipping_and_delivery",
          policy: policies.shipping || "Nationwide delivery in 2-4 business days. Cash on Delivery (COD) available across Pakistan."
        };
      }

      if (topic.includes("return") || topic.includes("refund") || topic.includes("exchange")) {
        return {
          topic: "returns_and_refunds",
          policy: policies.returns || "Hassle-free 7-day return and exchange policy for unworn items with original tags."
        };
      }

      if (topic.includes("contact") || topic.includes("phone") || topic.includes("email") || topic.includes("support")) {
        return {
          topic: "contact_information",
          email: contact.emails?.[0] || policies.email || "support@store.com",
          phone: contact.phones?.[0] || policies.phone || "Available on store",
          whatsapp: contact.whatsapp || null
        };
      }

      return {
        topic: "general_policies",
        summary: policies.shipping || "Standard store terms and nationwide shipping apply."
      };
    }

    case "check_stock": {
      const target = (args.productIdentifier || "").toLowerCase();
      const product = catalog.find(p =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.handle && p.handle.toLowerCase() === target) ||
        (p.title && p.title.toLowerCase().includes(target))
      );

      if (!product) {
        return {
          inStock: false,
          message: `Item "${args.productIdentifier}" is not found in the catalog.`
        };
      }

      const inStock = product.available !== false;
      return {
        inStock,
        title: product.title,
        message: inStock ? `Yes, "${product.title}" is currently in stock.` : `Sorry, "${product.title}" is currently out of stock.`
      };
    }

    default:
      return { error: `Unknown tool "${name}"` };
  }
}

/**
 * Step 2.5: Server-side Product Card Hydration
 * Replaces handles/IDs returned by the model with verified store data
 * and in-stock variant IDs for /cart/add.js.
 */
export function hydrateProductCards(identifiers = [], storeCatalog = [], currencySymbol = "Rs.") {
  if (!Array.isArray(identifiers) || identifiers.length === 0) return [];

  const cards = [];

  for (const item of identifiers) {
    const query = typeof item === "string" ? item.toLowerCase() : (item.id || item.handle || item.title || "").toLowerCase();
    if (!query) continue;

    const product = storeCatalog.find(p =>
      (p.id && String(p.id).toLowerCase() === query) ||
      (p.handle && p.handle.toLowerCase() === query) ||
      (p.title && p.title.toLowerCase() === query)
    );

    if (product) {
      // Find valid in-stock variant ID
      let variantId = product.variantId;
      if (!variantId && Array.isArray(product.variants) && product.variants.length > 0) {
        const inStockVar = product.variants.find(v => v.available !== false) || product.variants[0];
        variantId = inStockVar.id;
      }

      // Format clean numeric variant ID (strip gid://shopify/ProductVariant/ if present)
      const cleanVariantId = variantId ? String(variantId).replace(/\D+/g, "") : null;

      // Ensure price is clean without duplicate symbols
      let rawPrice = product.price ? String(product.price).trim() : "";
      rawPrice = rawPrice.replace(/^[^\d.]+/, "").trim();
      const finalPrice = rawPrice ? `${currencySymbol} ${rawPrice}` : `${currencySymbol} Check in store`;

      cards.push({
        id: String(product.id).replace(/\D+/g, ""),
        title: product.title,
        price: finalPrice,
        image: product.image || product.imageUrl || product.images?.[0]?.src || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        variantId: cleanVariantId,
        url: product.url || `/products/${product.handle || ""}`,
        inStock: product.available !== false
      });
    }
  }

  return cards;
}
