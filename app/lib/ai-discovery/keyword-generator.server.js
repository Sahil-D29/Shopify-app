/**
 * Keyword & Synonym Generator
 *
 * Generates keyword synonyms, conversational phrases, and natural language
 * variations that match how people ask AI shopping assistants for products.
 *
 * Example: "running shoes" → synonyms: "jogging shoes, athletic sneakers,
 * running trainers" + conversational: "best shoes for running, comfortable
 * running shoes for beginners"
 */

// Common synonym patterns for product attributes
const SYNONYM_MAP = {
  // Size
  small: ["petite", "compact", "mini", "xs"],
  medium: ["mid-size", "regular", "standard", "m"],
  large: ["big", "oversized", "xl", "plus-size"],

  // Color generics
  black: ["dark", "ebony", "onyx", "midnight"],
  white: ["ivory", "cream", "pearl", "snow"],
  red: ["crimson", "scarlet", "ruby", "burgundy"],
  blue: ["navy", "cobalt", "azure", "sapphire"],
  green: ["emerald", "olive", "sage", "forest"],
  pink: ["rose", "blush", "coral", "salmon"],

  // Material
  leather: ["genuine leather", "real leather", "full-grain leather"],
  cotton: ["100% cotton", "organic cotton", "pure cotton"],
  silk: ["pure silk", "natural silk", "mulberry silk"],
  wool: ["merino", "cashmere", "lambswool"],

  // Price
  cheap: ["affordable", "budget", "inexpensive", "value"],
  expensive: ["premium", "luxury", "high-end", "designer"],

  // Quality
  best: ["top-rated", "highest quality", "recommended", "#1"],
  new: ["latest", "newest", "just released", "brand new"],
  popular: ["best-selling", "trending", "top pick", "fan favorite"],
};

// Conversational phrase templates
const CONVERSATIONAL_TEMPLATES = [
  "best {product} for {use_case}",
  "what is the best {product}",
  "where can I buy {product}",
  "affordable {product} online",
  "top rated {product}",
  "{product} worth buying",
  "is {product} good",
  "cheapest {product} that is good quality",
  "recommended {product} for {audience}",
  "{product} under {price}",
  "compare {product}",
  "{product} vs alternatives",
  "which {product} should I get",
  "help me find {product}",
  "I need {product} for {use_case}",
];

// Common use cases by product type
const USE_CASE_MAP = {
  shoes: ["running", "walking", "work", "casual", "hiking", "gym"],
  shirt: ["work", "casual", "formal", "everyday", "summer"],
  pants: ["work", "casual", "outdoor", "athletic", "dress"],
  dress: ["wedding", "party", "casual", "work", "summer"],
  bag: ["travel", "work", "school", "everyday", "gym"],
  watch: ["everyday", "sports", "dress", "outdoor", "gift"],
  jewelry: ["gift", "wedding", "everyday", "special occasion"],
  skincare: ["dry skin", "oily skin", "sensitive skin", "anti-aging"],
  default: ["everyday use", "gift", "personal use"],
};

// Common audiences
const AUDIENCES = [
  "men", "women", "teens", "beginners", "professionals",
  "students", "travelers", "athletes",
];

/**
 * Generate keyword synonyms for a product.
 */
export function generateSynonyms(product) {
  const terms = [];
  const title = product.title?.toLowerCase() || "";
  const type = product.productType?.toLowerCase() || "";
  const tags = product.tags?.map((t) => t.toLowerCase()) || [];

  // Direct synonyms from title words
  const titleWords = title.split(/\s+/);
  for (const word of titleWords) {
    if (SYNONYM_MAP[word]) {
      terms.push(...SYNONYM_MAP[word]);
    }
  }

  // Tag-based synonyms
  for (const tag of tags) {
    if (SYNONYM_MAP[tag]) {
      terms.push(...SYNONYM_MAP[tag]);
    }
  }

  // Product type variations
  if (type) {
    terms.push(type);
    if (type.endsWith("s")) terms.push(type.slice(0, -1)); // plural to singular
    else terms.push(type + "s"); // singular to plural
  }

  // Vendor as keyword
  if (product.vendor) {
    terms.push(product.vendor.toLowerCase());
    terms.push(`${product.vendor} ${type}`.trim().toLowerCase());
  }

  return [...new Set(terms)].filter(Boolean);
}

/**
 * Generate conversational search phrases for a product.
 */
export function generateConversationalPhrases(product) {
  const phrases = [];
  const title = product.title || "";
  const type = product.productType?.toLowerCase() || "product";
  const minPrice = product.priceRangeV2?.minVariantPrice;

  // Determine use cases
  const typeKey = Object.keys(USE_CASE_MAP).find(
    (k) => type.includes(k) || title.toLowerCase().includes(k)
  );
  const useCases = USE_CASE_MAP[typeKey] || USE_CASE_MAP.default;

  // Generate from templates
  for (const template of CONVERSATIONAL_TEMPLATES) {
    if (template.includes("{use_case}")) {
      for (const useCase of useCases.slice(0, 3)) {
        phrases.push(
          template
            .replace("{product}", type)
            .replace("{use_case}", useCase)
            .replace("{audience}", AUDIENCES[0])
            .replace("{price}", minPrice ? `$${Math.ceil(parseFloat(minPrice.amount))}` : "$100")
        );
      }
    } else if (template.includes("{audience}")) {
      for (const audience of AUDIENCES.slice(0, 3)) {
        phrases.push(
          template
            .replace("{product}", type)
            .replace("{audience}", audience)
            .replace("{price}", minPrice ? `$${Math.ceil(parseFloat(minPrice.amount))}` : "$100")
        );
      }
    } else {
      phrases.push(
        template
          .replace("{product}", title)
          .replace("{price}", minPrice ? `$${Math.ceil(parseFloat(minPrice.amount))}` : "$100")
      );
    }
  }

  return [...new Set(phrases)];
}

/**
 * Generate a full keyword mapping for a product.
 */
export function generateKeywordMapping(product) {
  const synonyms = generateSynonyms(product);
  const conversational = generateConversationalPhrases(product);

  return {
    primaryTerm: product.title,
    synonyms: synonyms.join(", "),
    conversationalPhrases: conversational.join(" | "),
  };
}
