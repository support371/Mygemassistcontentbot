import { recordChannelMemberSnapshot } from "../lib/growth-store.js";

const CHANNEL_URL = process.env.CHANNEL_URL || "https://t.me/mycybersecureWealthsolution";

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");
  return token;
}

function getChannelTarget() {
  if (process.env.CHANNEL_ID) return process.env.CHANNEL_ID;
  try {
    const url = new URL(CHANNEL_URL);
    const slug = url.pathname.split("/").filter(Boolean).at(-1) || "";
    if (slug && !slug.startsWith("+")) return `@${slug}`;
  } catch {
    return "";
  }
  return "";
}

async function telegramMemberCount(chatId) {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/getChatMemberCount`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !Number.isInteger(data.result)) {
    throw new Error(data.description || `Telegram getChatMemberCount failed with HTTP ${response.status}`);
  }
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const channel = getChannelTarget();
    if (!channel) return res.status(503).json({ ok: false, error: "Channel target is not configured" });

    const measuredAt = new Date().toISOString();
    const memberCount = await telegramMemberCount(channel);
    const snapshot = await recordChannelMemberSnapshot(memberCount, measuredAt);

    return res.status(snapshot.ok ? 200 : 207).json({
      ok: snapshot.ok,
      channel,
      memberCount,
      measuredAt,
      snapshot,
    });
  } catch (error) {
    console.error("Channel member measurement failed", error);
    return res.status(502).json({ ok: false, error: error.message });
  }
}
