import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "https://mygemassistcontentbot.vercel.app";
const DEFAULT_CHANNEL_URL = "https://t.me/mycybersecureWealthsolution";

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");
  return token;
}

function getWebhookSecret(token) {
  return process.env.WEBHOOK_SECRET
    || process.env.SECRET_TOKEN
    || createHash("sha256").update(`gemassist-webhook:${token}`).digest("hex");
}

function getBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getChannelTarget() {
  if (process.env.CHANNEL_ID) return process.env.CHANNEL_ID;
  const channelUrl = process.env.CHANNEL_URL || DEFAULT_CHANNEL_URL;
  try {
    const url = new URL(channelUrl);
    const slug = url.pathname.split("/").filter(Boolean).at(-1) || "";
    if (slug && !slug.startsWith("+")) return `@${slug}`;
  } catch {
    // Return an empty target when CHANNEL_URL is malformed.
  }
  return "";
}

async function telegram(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || response.statusText}`);
  }
  return data.result;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBotToken();
    const secret = getWebhookSecret(token);
    const baseUrl = getBaseUrl();
    const webhookUrl = `${baseUrl}/api/webhook`;
    const bot = await telegram(token, "getMe");
    const channelTarget = getChannelTarget();

    let channel = null;
    if (channelTarget) {
      try {
        const chat = await telegram(token, "getChat", { chat_id: channelTarget });
        channel = { id: chat.id, username: chat.username || null, title: chat.title || null };
      } catch (error) {
        channel = { error: error.message };
      }
    }

    await telegram(token, "setWebhook", {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });

    const info = await telegram(token, "getWebhookInfo");
    const active = info.url === webhookUrl && !info.last_error_message;

    return res.status(active ? 200 : 503).json({
      ok: active,
      service: "GemAssist Telegram Bot",
      bot: `@${bot.username}`,
      webhookUrl,
      pendingUpdateCount: info.pending_update_count || 0,
      lastError: info.last_error_message || null,
      channel,
      automatic: true,
    });
  } catch (error) {
    console.error("Automatic activation failed", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
