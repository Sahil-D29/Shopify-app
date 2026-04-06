/**
 * AI Crawler definitions — shared between client and server code.
 */
export const AI_CRAWLERS = [
  {
    key: "allowGPTBot",
    userAgent: "GPTBot",
    description: "OpenAI — ChatGPT shopping and search",
  },
  {
    key: "allowClaudeBot",
    userAgent: "ClaudeBot",
    description: "Anthropic — Claude AI assistant",
  },
  {
    key: "allowPerplexityBot",
    userAgent: "PerplexityBot",
    description: "Perplexity AI — conversational search and shopping",
  },
  {
    key: "allowGoogleExtended",
    userAgent: "Google-Extended",
    description: "Google — Gemini AI and AI Overviews",
  },
  {
    key: "allowCohereBot",
    userAgent: "cohere-ai",
    description: "Cohere — enterprise AI",
  },
  {
    key: "allowMetaBot",
    userAgent: "FacebookBot",
    description: "Meta — Llama AI and Meta AI",
  },
];
