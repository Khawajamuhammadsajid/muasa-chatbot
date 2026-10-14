import { unauthenticated } from "../shopify.server.js";

/**
 * Catalog & Storefront Policy Service
 * Efficient GraphQL fetching with in-memory caching and webhook invalidation.
 * Capable of handling 500+ products and real store collections.
 */

const catalogCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const CATALOG_QUERY = `#graphql
  query getStoreCatalogData($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          description
          productType
          vendor
          tags
          totalInventory
          variants(first: 20) {
            edges {
              node {
                id
                title
                price
                availableForSale
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          images(first: 2) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    }
    collections(first: 15) {
      edges {
        node {
          id
          title
          handle
          description
          image {
            url
            altText
          }
          products(first: 1) {
            edges {
              node {
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    shop {
      name
      currencyCode
      contactEmail
      myshopifyDomain
    }
  }
`;

/**
 * Fetches and flattens store products, collections, and policies
 * @param {string} shopDomain
 * @param {object} [adminClient]
 * @param {boolean} [forceRefresh=false]
 */
export async function getStoreCatalog(shopDomain, adminClient = null, forceRefresh = false) {
  const cached = catalogCache.get(shopDomain);
  const now = Date.now();

  if (!forceRefresh && cached && (now - cached.fetchedAt < CACHE_TTL_MS)) {
    return cached;
  }

  try {
    let admin = adminClient;
    if (!admin) {
      const authResult = await unauthenticated.admin(shopDomain);
      admin = authResult.admin;
    }

    let allProducts = [];
    let allCollections = [];
    let hasNextPage = true;
    let cursor = null;
    let shopInfo = {};

    let pageCount = 0;
    const maxPages = 5;

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      const response = await admin.graphql(CATALOG_QUERY, {
        variables: {
          first: 100,
          after: cursor
        }
      });

      const json = await response.json();
      if (json.errors) {
        console.error(`[CatalogService] GraphQL errors for ${shopDomain}:`, json.errors);
        break;
      }

      const data = json.data;
      if (!data) break;

      if (pageCount === 1) {
        shopInfo = {
          name: data.shop?.name || shopDomain,
          currency: data.shop?.currencyCode || "PKR",
          email: data.shop?.contactEmail || ""
        };

        // Extract collections
        const colEdges = data.collections?.edges || [];
        allCollections = colEdges.map(e => {
          const directImg = e.node.image?.url;
          const productImg = e.node.products?.edges?.[0]?.node?.images?.edges?.[0]?.node?.url;
          return {
            id: e.node.id,
            title: e.node.title,
            handle: e.node.handle,
            description: e.node.description || "",
            image: directImg || productImg || ""
          };
        }).filter(c => c.title.toLowerCase() !== "home page");
      }

      const productEdges = data.products?.edges || [];
      for (const edge of productEdges) {
        const p = edge.node;
        const variants = (p.variants?.edges || []).map(ve => ({
          id: ve.node.id,
          title: ve.node.title,
          price: ve.node.price,
          availableForSale: ve.node.availableForSale,
          inventoryQuantity: ve.node.inventoryQuantity ?? 0,
          selectedOptions: ve.node.selectedOptions || []
        }));

        const primaryImage = p.images?.edges?.[0]?.node?.url || "";

        allProducts.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          description: p.description || "",
          productType: p.productType || "General",
          vendor: p.vendor || "",
          tags: p.tags || [],
          totalInventory: p.totalInventory ?? 0,
          inStock: variants.some(v => v.availableForSale),
          price: variants[0]?.price || "0.00",
          variants,
          primaryVariantId: variants[0]?.id || "",
          image: primaryImage
        });
      }

      hasNextPage = data.products?.pageInfo?.hasNextPage;
      cursor = data.products?.pageInfo?.endCursor;
    }

    // Default high-converting Pakistani ecommerce policies
    const shopPolicies = {
      shipping: "Nationwide delivery across Pakistan in 2-4 business days. Cash on Delivery (COD) available.",
      refund: "7-day easy return and exchange policy for unworn items in original packaging.",
      privacy: "Your customer data is completely secure and protected.",
      supportEmail: shopInfo.email || "support@store.com"
    };

    const result = {
      shopDomain,
      shopInfo,
      policies: shopPolicies,
      products: allProducts,
      collections: allCollections,
      fetchedAt: now
    };

    catalogCache.set(shopDomain, result);
    return result;

  } catch (err) {
    console.error(`[CatalogService] Error fetching catalog for ${shopDomain}:`, err.message);

    if (cached) return cached;

    return {
      shopDomain,
      shopInfo: { name: shopDomain, currency: "PKR" },
      policies: {
        shipping: "Standard delivery in 2-4 business days. Cash on Delivery available.",
        refund: "7-day return and exchange policy."
      },
      products: [],
      collections: [],
      fetchedAt: now
    };
  }
}

const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "a", "an", "the", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been", "have", "has", "had",
  "do", "does", "did", "need", "want", "give", "show", "get", "find", "looking", "look", "buy",
  "kya", "hai", "hain", "ko", "ki", "ka", "ke", "se", "mein", "me", "mai", "mujhe", "chahiye",
  "yeh", "ye", "woh", "wo", "wala", "wali", "wale", "item", "items", "product", "products",
  "batao", "dikhao", "koi", "kuch", "hoga", "please", "can", "tell", "karo", "acha", "achi"
]);

const TYPO_MAP = {
  max: "wax",
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

function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const d = [];
  for (let i = 0; i <= s1.length; i++) d[i] = [i];
  for (let j = 0; j <= s2.length; j++) d[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[s1.length][s2.length];
}

/**
 * Intelligent Catalog Search (Instant local search, 5 items per batch)
 * Equipped with typo tolerance (Levenshtein), stopword filtering, and ranked relevance scoring.
 */
export function searchCatalogProducts(catalog = [], query = "", limit = 5, offset = 0) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { products: [], total: 0, hasMore: false };
  }

  const q = (query || "").toLowerCase().trim();
  let matches = [];

  const isBrowseAll = !q ||
    q.includes("all product") ||
    q.includes("all items") ||
    q.includes("explore best") ||
    q.includes("best seller") ||
    q.includes("explore similar") ||
    (q.includes("similar") && !q.includes("to ")) ||
    q.includes("full catalog") ||
    q === "all" ||
    q === "products" ||
    q === "catalog";

  if (isBrowseAll) {
    matches = catalog.filter(p => p.inStock);
    if (matches.length === 0) matches = catalog;
  } else {
    // Extract keywords, filter out stopwords and single letters
    const rawTerms = q.replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean);
    const meaningfulTerms = rawTerms
      .map(t => TYPO_MAP[t] || t)
      .filter(t => !STOP_WORDS.has(t) && t.length > 1);

    const searchTerms = meaningfulTerms.length > 0 ? meaningfulTerms : rawTerms;

    const scored = [];

    for (const p of catalog) {
      const title = (p.title || "").toLowerCase();
      const type = (p.productType || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const tags = (Array.isArray(p.tags) ? p.tags.join(" ") : "").toLowerCase();
      const handle = (p.handle || "").toLowerCase();

      let score = 0;
      const titleWords = title.split(/\s+/);

      for (const term of searchTerms) {
        // Exact handle or exact title match
        if (handle === term || title === term) {
          score += 30;
        } else if (title.includes(term)) {
          score += 20;
        } else if (type.includes(term) || tags.includes(term)) {
          score += 12;
        } else if (desc.includes(term)) {
          score += 3;
        } else if (term.length >= 3) {
          // Check typo / fuzzy match against words in title
          for (const tw of titleWords) {
            if (tw.length <= 3 || term.length <= 3) {
              if (tw.length === term.length && levenshteinDistance(tw, term) <= 1) {
                score += 15;
                break;
              }
            } else if (Math.abs(tw.length - term.length) <= 1 && levenshteinDistance(tw, term) <= 1) {
              score += 15;
              break;
            }
          }
        }
      }

      if (score > 0) {
        scored.push({ product: p, score });
      }
    }

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);
    matches = scored.map(s => s.product);
  }

  const paginated = matches.slice(offset, offset + limit);
  const hasMore = matches.length > offset + limit;

  return {
    products: paginated,
    total: matches.length,
    offset,
    limit,
    hasMore
  };
}

export function invalidateCatalog(shopDomain) {
  catalogCache.delete(shopDomain);
}
