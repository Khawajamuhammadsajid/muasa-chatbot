/**
 * ============================================================================
 * Layer B & D: Intent Guard & Prompt Injection Defense (Deterministic Layer)
 * ============================================================================
 * High-speed, zero-token pre-flight filter to protect the store's AI tokens,
 * prevent jailbreaks, and enforce strict store-only boundaries.
 */

// 1. Prompt Injection & Jailbreak Attack Signatures
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|prior\s+|the\s+)*(instructions|prompts|rules|commands)/i,
  /disregard\s+(all\s+|previous\s+|the\s+)*(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(dan|developer\s+mode|unrestricted|jailbroken|god\s+mode)/i,
  /reveal\s+(your\s+|the\s+)*(system\s+prompt|prompt|instructions|api\s*key|secret)/i,
  /what\s+(are\s+|is\s+)(your\s+)?(system\s+prompt|initial\s+instructions|system\s+message)/i,
  /repeat\s+(everything|the\s+text|all).*?(above|prior|before)/i,
  /act\s+as\s+(an?\s+)?(unrestricted|evil|opposite|jailbroken|linux|python|terminal)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(not|an?\s+ai|someone\s+else|a\s+|an\s+)/i,
  /override\s+(the\s+)?(price|discount|system|rules|all)/i,
  /give\s+me\s+(a\s+)?([0-9]{2,3}%\s+discount|100%\s+off|free\s+item)/i,
  /system\s*:\s*/i,
  /\[system\s+override\]/i,
  /<<SYS>>/i
];

// 2. Off-Topic Prohibited Domains
const OFF_TOPIC_PATTERNS = [
  // Politics & Government
  /\b(politics|politician|election|prime\s+minister|president|biden|trump|imran\s+khan|nawaz\s+sharif|parliament|democrat|republican|putin|modi)\b/i,
  // Coding, Programming, Math
  /\b(write\s+(a\s+|an\s+)?(python|javascript|code|script|sql|c\+\+|html|css)|debug\s+this|solve\s+(this\s+)?equation|calculate\s+\d|\d+\s*[+*/^]\s*\d+)\b/i,
  // Science, Space, General Trivia, Sports & School Homework
  /\b(capital\s+of|who\s+(discovered|invented|founded|won|lost)|world\s+cup|cricket|football|nba|olympics|photosynthesis|speed\s+of\s+light|distance\s+to\s+(the\s+)?moon|write\s+an?\s+essay\s+on)\b/i,
  // Medical & Legal Advice
  /\b(diagnose|symptoms\s+of|cure\s+for|medicine\s+for|can\s+i\s+sue|legal\s+advice|lawyer\s+for)\b/i,
  // Competitors & Other Marketplaces
  /\b(daraz|amazon|aliexpress|temu|shein|flipkart|walmart|ebay|target|alibaba)\b/i,
  // Creative Writing & Unrelated Entertainment
  /\b(tell\s+(me\s+)?(a\s+)?(funny\s+)?joke|write\s+a\s+(poem|song|story|rap)|tell\s+a\s+bedtime\s+story)\b/i
];

// 3. Roman Urdu Detection Keywords
const ROMAN_URDU_SIGNALS = [
  /\b(kya|hai|hein|batao|chahiye|chahye|dikhao|kitne|kitna|kaise|kese|kahan|apke|aapke|mangwana|khareedna|shukriya|salam|aoa|bhejo|milay\s*ga|deliver|karen)\b/i,
  /[\u0600-\u06FF]/ // Urdu script
];

/**
 * Detects whether customer language is English or Roman Urdu/Urdu
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  for (const signal of ROMAN_URDU_SIGNALS) {
    if (signal.test(text)) return 'ur';
  }
  return 'en';
}

/**
 * Evaluates a message against Layer B (Cheap Scope Guard) and Layer D (Injection Defense).
 * Returns { allowed: true } or { allowed: false, reason, cannedReply }.
 */
export function evaluateMessageScope(message, shopName = 'Our Store') {
  if (!message || typeof message !== 'string') {
    return {
      allowed: false,
      reason: 'EMPTY_MESSAGE',
      cannedReply: `Hello! How can I assist you with ${shopName}'s products and shopping today?`
    };
  }

  const trimmed = message.trim();
  const lang = detectLanguage(trimmed);

  // Check 1: Prompt Injection / Jailbreak Attack
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      const cannedReply = lang === 'ur'
        ? `Main sirf ${shopName} ka shopping assistant hoon. Main sirf store ke products, orders, aur delivery ke baaray mein madad kar sakta hoon.`
        : `I am the dedicated shopping assistant for ${shopName}. I can only assist you with our store's products, orders, sizing, and policies. What can I help you find today?`;

      return {
        allowed: false,
        reason: 'PROMPT_INJECTION_ATTEMPT',
        cannedReply
      };
    }
  }

  // Check 2: Off-Topic Category Filter
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      const cannedReply = lang === 'ur'
        ? `Main sirf ${shopName} ki shopping mein aapki madad kar sakta hoon. Store ke products, pricing, ya delivery ke baaray mein kuch poochna chahein to zaroor batayein!`
        : `I am only able to help with ${shopName}'s shopping experience, including our products, collections, sizing, shipping, and returns. How can I assist with your order today?`;

      return {
        allowed: false,
        reason: 'OFF_TOPIC_CATEGORY',
        cannedReply
      };
    }
  }

  return {
    allowed: true,
    language: lang
  };
}
