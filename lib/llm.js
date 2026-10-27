// Provider-agnostic model router for GemAssist.
//
// Runs on open-weight models only (OpenAI gpt-oss), through free tiers that
// cannot bill without a payment method attached:
//   1. Cloudflare Workers AI  (@cf/openai/gpt-oss-120b, then gpt-oss-20b)
//   2. OpenRouter free tier   (openai/gpt-oss-120b:free)
//   3. Hugging Face router    (openai/gpt-oss-120b), optional
// Each provider is used only when its credentials are present. When every
// provider fails or is out of daily quota, complete() returns { ok: false }
// and callers fall back to their existing static content.

const CF_PRIMARY = "@cf/openai/gpt-oss-120b";
const CF_SMALL = "@cf/openai/gpt-oss-20b";
const DEFAULT_BUDGET_MS = 20000;

export function providerChain(env = process.env, { preferSmall = false } = {}) {
  const chain = [];
  if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/ai/v1/chat/completions`;
    const big = env.CF_AI_MODEL || CF_PRIMARY;
    const small = env.CF_AI_FALLBACK_MODEL || CF_SMALL;
    const order = preferSmall ? [small, big] : [big, small];
    for (const model of [...new Set(order)]) {
      chain.push({ name: "cloudflare", model, url, token: env.CF_AI_TOKEN });
    }
  }
  if (env.OPENROUTER_API_KEY) {
    chain.push({
      name: "openrouter",
      model: env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
      url: "https://openrouter.ai/api/v1/chat/completions",
      token: env.OPENROUTER_API_KEY,
      headers: { "HTTP-Referer": env.PUBLIC_BASE_URL || "https://mygemassistcontentbot.vercel.app", "X-Title": "GemAssist" },
    });
  }
  if (env.HF_TOKEN) {
    chain.push({
      name: "huggingface",
      model: env.HF_MODEL || "openai/gpt-oss-120b",
      url: "https://router.huggingface.co/v1/chat/completions",
      token: env.HF_TOKEN,
    });
  }
  return chain;
}

export function isAiConfigured(env = process.env) {
  return providerChain(env).length > 0;
}

// Pulls the answer text out of the response shapes these providers return.
export function extractText(data) {
  if (!data || typeof data !== "object") return "";
  const root = data.result && typeof data.result === "object" ? data.result : data;
  const choice = Array.isArray(root.choices) ? root.choices[0] : null;
  const candidates = [
    choice?.message?.content,
    choice?.text,
    root.output_text,
    root.response,
  ];
  if (Array.isArray(root.output)) {
    for (const item of root.output) {
      if (item?.type === "reasoning") continue;
      for (const part of Array.isArray(item?.content) ? item.content : []) {
        if (typeof part?.text === "string") candidates.push(part.text);
      }
    }
  }
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return cleanText(value);
    if (Array.isArray(value)) {
      const joined = value.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
      if (joined.trim()) return cleanText(joined);
    }
  }
  return "";
}

function cleanText(text) {
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^<\|[^|]*\|>/g, "")
    .trim();
}

async function callProvider(provider, messages, { maxTokens, temperature, timeoutMs, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetchImpl(provider.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${provider.token}`,
        "content-type": "application/json",
        ...(provider.headers || {}),
      },
      body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.errors?.[0]?.message || response.statusText || "request failed";
      return { ok: false, status: response.status, error: String(detail).slice(0, 200) };
    }
    const text = extractText(data);
    if (!text) return { ok: false, status: response.status, error: "empty response" };
    return { ok: true, text };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === "AbortError" ? "timeout" : String(error?.message || error).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export async function complete(messages, options = {}) {
  const {
    env = process.env,
    fetchImpl = globalThis.fetch,
    maxTokens = 700,
    temperature = 0.6,
    budgetMs = DEFAULT_BUDGET_MS,
    preferSmall = false,
  } = options;
  const chain = providerChain(env, { preferSmall });
  const attempts = [];
  if (!chain.length) return { ok: false, text: "", attempts, error: "no AI provider configured" };

  const deadline = Date.now() + budgetMs;
  for (const provider of chain) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    const result = await callProvider(provider, messages, { maxTokens, temperature, timeoutMs: remaining, fetchImpl });
    attempts.push({ provider: provider.name, model: provider.model, ok: result.ok, status: result.status, error: result.error });
    if (result.ok) return { ok: true, text: result.text, provider: provider.name, model: provider.model, attempts };
  }
  return { ok: false, text: "", attempts, error: "all providers failed" };
}

// Parses the first JSON object or array in a model reply.
export function parseJsonReply(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export async function completeJson(messages, options = {}) {
  const result = await complete(messages, options);
  if (!result.ok) return { ...result, data: null };
  const data = parseJsonReply(result.text);
  return data ? { ...result, data } : { ...result, ok: false, data: null, error: "reply was not valid JSON" };
}
