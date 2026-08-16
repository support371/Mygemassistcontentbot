const KEYWORDS = [
  "cyber", "security", "fraud", "scam", "finance", "wealth", "jobs", "career", "technology", "privacy", "risk", "business", "real estate", "creator", "tools"
];

export function normalizePublicHandle(input) {
  const value = String(input || "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9_]{5,32}$/.test(value)) return "";
  return `@${value}`;
}

export function scorePublicChannel({ title = "", description = "", memberCount = 0 } = {}) {
  const haystack = `${title} ${description}`.toLowerCase();
  const matches = KEYWORDS.filter((keyword) => haystack.includes(keyword));
  const relevance = Math.min(70, matches.length * 10);
  const scale = memberCount >= 100000 ? 25 : memberCount >= 10000 ? 20 : memberCount >= 1000 ? 15 : memberCount >= 100 ? 10 : memberCount > 0 ? 5 : 0;
  const score = Math.min(100, relevance + scale + 5);
  return { score, keywordMatches: matches };
}

async function telegramApi(method, params, token, fetchImpl = fetch) {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

export async function inspectPublicChannel(handle, { token = process.env.BOT_TOKEN, fetchImpl = fetch } = {}) {
  const normalized = normalizePublicHandle(handle);
  if (!normalized) return { ok: false, handle: String(handle || ""), error: "invalid_public_handle" };
  if (!token) return { ok: false, handle: normalized, error: "bot_token_not_configured" };

  try {
    const [chat, memberCount] = await Promise.all([
      telegramApi("getChat", { chat_id: normalized }, token, fetchImpl),
      telegramApi("getChatMemberCount", { chat_id: normalized }, token, fetchImpl),
    ]);
    const analysis = scorePublicChannel({ title: chat.title, description: chat.description, memberCount });
    return {
      ok: true,
      handle: normalized,
      chatId: String(chat.id),
      type: chat.type,
      title: chat.title || "",
      description: chat.description || "",
      memberCount: Number(memberCount || 0),
      publicUrl: `https://t.me/${normalized.slice(1)}`,
      placementStatus: "permission_required",
      ...analysis,
    };
  } catch (error) {
    return { ok: false, handle: normalized, error: error.message };
  }
}

export function trackedPlacementUrl(origin, sourceCode) {
  const approved = new Set([
    "ext_irishfutures", "ext_learncyber", "ext_cyberhub", "ext_100xsecurity", "ext_cybermind",
    "ext_jobsregion", "ext_jobsnigeria", "ext_lagosrealestate", "ext_telega", "ext_telegramads"
  ]);
  const source = approved.has(sourceCode) ? sourceCode : "channel_invite";
  return `${String(origin || "").replace(/\/$/, "")}/api/start?src=${encodeURIComponent(source)}`;
}
