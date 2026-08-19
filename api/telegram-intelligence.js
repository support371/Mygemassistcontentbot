import { inspectPublicChannel, trackedPlacementUrl } from "../lib/telegram-intelligence.js";

const SOURCE_CODES = [
  "ext_irishfutures", "ext_learncyber", "ext_cyberhub", "ext_100xsecurity", "ext_cybermind",
  "ext_jobsregion", "ext_jobsnigeria", "ext_lagosrealestate", "ext_telega", "ext_telegramads"
];

const OWNED_VALIDATION_TARGET = "@legalized_Cybersecure_digital_id";
const OWNED_VALIDATION_NONCE = "owned-us-validation-20260819";
const PRODUCTION_BASE_URL = "https://mygemassistcontentbot.vercel.app";

function requestedTargets(req) {
  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const url = new URL(req.url || "/api/telegram-intelligence", origin);
  const raw = url.searchParams.get("targets") || process.env.TELEGRAM_DISCOVERY_TARGETS || "@mycybersecureWealthsolution";
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 10);
}

function requestUrl(req) {
  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  return new URL(req.url || "/api/telegram-intelligence", origin);
}

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");
  return token;
}

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || `Telegram ${method} failed`);
    error.status = response.status;
    throw error;
  }
  return data.result;
}

function isOwnedValidationPreview() {
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "feat/owned-us-validation-send-20260819";
}

async function sendOwnedValidationInvitation(url) {
  if (!isOwnedValidationPreview()) {
    return { ok: false, status: 403, error: "owned_validation_send_is_preview_only" };
  }
  if (url.searchParams.get("confirm") !== OWNED_VALIDATION_NONCE) {
    return { ok: false, status: 403, error: "confirmation_mismatch" };
  }

  const bot = await telegram("getMe");
  const chat = await telegram("getChat", { chat_id: OWNED_VALIDATION_TARGET });
  const trackedUrl = `${PRODUCTION_BASE_URL}/api/start?src=channel_invite`;
  const message = await telegram("sendMessage", {
    chat_id: OWNED_VALIDATION_TARGET,
    text: "<b>GemAssist USA validation invitation</b>\n\nOpen GemAssist for practical cybersecurity alerts, fraud-awareness guidance, tools, and opportunity resources. Participation is voluntary.",
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "Open GemAssist", url: trackedUrl }]],
    },
  });

  return {
    ok: true,
    status: 200,
    sent: true,
    target: OWNED_VALIDATION_TARGET,
    targetChatId: String(chat.id || ""),
    targetTitle: chat.title || "",
    country: "US",
    ownership: "owner_confirmed",
    botUsername: bot.username || "",
    permissionValidatedBy: "telegram_sendMessage_success",
    messageId: message.message_id,
    trackedUrl,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const url = requestUrl(req);
  if (url.searchParams.get("action") === "owned_validation_send") {
    try {
      const result = await sendOwnedValidationInvitation(url);
      return res.status(result.status || 200).json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ ok: false, error: error.message });
    }
  }

  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const targets = requestedTargets(req);
  const channels = await Promise.all(targets.map((target) => inspectPublicChannel(target)));
  const successful = channels.filter((item) => item.ok).sort((a, b) => b.score - a.score);

  return res.status(200).json({
    ok: true,
    service: "gemassist-telegram-intelligence",
    mode: "public-channel-metadata-only",
    generatedAt: new Date().toISOString(),
    safety: {
      memberIdentityCollection: false,
      unsolicitedPrivateMessaging: false,
      unauthorizedPosting: false,
      placementPermissionRequired: true,
    },
    summary: {
      requested: targets.length,
      resolved: successful.length,
      highestScore: successful[0]?.score || 0,
    },
    channels,
    placementLinks: Object.fromEntries(SOURCE_CODES.map((code) => [code, trackedPlacementUrl(origin, code)])),
    nextAction: successful.length
      ? "Review highest-scoring public channels, contact administrators through their published contact route, and use the matching tracked placement link only after permission."
      : "Add public Telegram handles with ?targets=@channel1,@channel2 or configure TELEGRAM_DISCOVERY_TARGETS.",
  });
}
