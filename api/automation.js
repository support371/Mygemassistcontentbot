import { timingSafeEqual } from "node:crypto";
import { dailyPost } from "../lib/content-calendar.js";
import { growthStore, isGrowthStoreConfigured } from "../lib/growth-store.js";

const SCHEDULE = "0 14 * * *";
const BASE_URL = (process.env.PUBLIC_BASE_URL || "https://mygemassistcontentbot.vercel.app").replace(/\/$/, "");
const CHANNEL_URL = process.env.CHANNEL_URL || "https://t.me/mycybersecureWealthsolution";
const GUIDE_URL = process.env.PDF_URL || `${BASE_URL}/guide.pdf`;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

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

function isScheduledWindow(req) {
  const now = new Date();
  const schedule = String(req.headers["x-vercel-cron-schedule"] || "");
  const agent = String(req.headers["user-agent"] || "").toLowerCase();
  const scheduledRequest = schedule === SCHEDULE || agent.includes("vercel-cron");
  return scheduledRequest && now.getUTCHours() === 14 && now.getUTCMinutes() <= 59;
}

async function authorization(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const setupKey = process.env.SETUP_KEY || "";
  const cronSecret = process.env.CRON_SECRET || "";

  if (setupKey && safeEqual(bearer, setupKey)) return { authorized: true, source: "setup-key" };
  if (cronSecret && safeEqual(bearer, cronSecret)) return { authorized: true, source: "cron-secret" };
  if (isScheduledWindow(req)) return { authorized: true, source: "vercel-cron-window" };

  if (String(req.query?.first_run || "") === "1" && isGrowthStoreConfigured()) {
    const analytics = await growthStore("analytics");
    if (analytics.ok && Number(analytics.channel_posts || 0) === 0) {
      return { authorized: true, source: "first-run" };
    }
  }

  return { authorized: false, source: "none" };
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

async function discoverBotUsername() {
  const configured = String(process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (configured) return configured;
  const bot = await telegram("getMe");
  return bot.username;
}

async function ensureWebhook() {
  try {
    const response = await fetch(`${BASE_URL}/api/activate`, { method: "GET" });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data.ok === true, ...data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function channelKeyboard(botUsername, source, guide = false) {
  const botUrl = `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(source)}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent("Join GemAssist for practical cybersecurity, real-estate fraud alerts, tools, and opportunities.")}`;
  const rows = [[{ text: "Open GemAssist", url: botUrl }, { text: "Share", url: shareUrl }]];
  if (guide) rows.unshift([{ text: "Open the free premium guide", url: GUIDE_URL }]);
  return { inline_keyboard: rows };
}

async function publishChannelContent(botUsername, force) {
  const channelTarget = getChannelTarget();
  if (!channelTarget) return { ok: false, skipped: true, reason: "Channel target is not configured" };

  const now = new Date();
  const fallback = dailyPost(now);
  const source = `channel_${fallback.dateKey.replaceAll("-", "")}`;
  let candidates = [];

  if (isGrowthStoreConfigured()) {
    const queued = await growthStore("list_due_channel_posts", {
      now: now.toISOString(),
      limit: 1,
    });
    if (queued.ok && Array.isArray(queued.posts)) candidates = queued.posts;
  }

  if (candidates.length === 0) {
    candidates = [{
      id: fallback.key,
      post_key: fallback.key,
      text_html: `<b>${fallback.title}</b>\n\n${fallback.body}\n\n<a href="${CHANNEL_URL}">GemAssist intelligence channel</a>`,
      button_text: "",
      button_url: "",
      guide: fallback.guide,
      fallback: true,
    }];
  }

  const results = [];
  for (const post of candidates.slice(0, 1)) {
    const postKey = String(post.post_key || post.id || fallback.key);
    if (isGrowthStoreConfigured() && !force) {
      const exists = await growthStore("channel_post_exists", { post_key: postKey });
      if (exists.ok && exists.exists) {
        results.push({ postKey, skipped: true, reason: "Already sent" });
        continue;
      }
    }

    const keyboard = channelKeyboard(botUsername, source, Boolean(post.guide));
    if (post.button_text && post.button_url) {
      keyboard.inline_keyboard.unshift([{ text: String(post.button_text), url: String(post.button_url) }]);
    }

    try {
      const message = await telegram("sendMessage", {
        chat_id: channelTarget,
        text: String(post.text_html || ""),
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: keyboard,
      });

      if (isGrowthStoreConfigured()) {
        await growthStore("record_channel_post", {
          post_key: postKey,
          queue_id: post.id || "",
          message_id: message.message_id,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
      }
      results.push({ postKey, sent: true, messageId: message.message_id });
    } catch (error) {
      if (isGrowthStoreConfigured()) {
        await growthStore("record_channel_post", {
          post_key: postKey,
          queue_id: post.id || "",
          sent_at: new Date().toISOString(),
          status: "failed",
          error: error.message,
        });
      }
      results.push({ postKey, sent: false, error: error.message });
    }
  }

  return { ok: results.some((item) => item.sent) || results.every((item) => item.skipped), results };
}

function followupMessage(stage, firstName, botUsername) {
  const name = firstName ? ` ${firstName}` : "";
  const botUrl = `https://t.me/${encodeURIComponent(botUsername)}?start=followup_${stage}`;
  if (stage === 1) {
    return {
      text: `<b>GemAssist follow-up${name}</b>\n\nJoin the intelligence channel for practical security alerts, real-estate fraud warnings, and opportunity resources.\n\nYou can stop these updates at any time with /stop.`,
      keyboard: [[{ text: "Join the channel", url: CHANNEL_URL }], [{ text: "Stop updates", callback_data: "stop_updates" }]],
    };
  }
  if (stage === 2) {
    return {
      text: `<b>Your premium resource guide is ready${name}.</b>\n\nUse the 30-day plan to turn the 50 tools and opportunities into a focused weekly workflow.\n\nYou can stop these updates at any time with /stop.`,
      keyboard: [[{ text: "Open the premium guide", url: GUIDE_URL }], [{ text: "Share GemAssist", url: `https://t.me/share/url?url=${encodeURIComponent(botUrl)}` }], [{ text: "Stop updates", callback_data: "stop_updates" }]],
    };
  }
  return {
    text: `<b>One-week GemAssist check-in${name}</b>\n\nChoose one action today: secure an account, verify a payment instruction, publish a useful resource, or track one new opportunity.\n\nThis is the final automated onboarding message. Use /start whenever you need the menu.`,
    keyboard: [[{ text: "Open GemAssist", url: botUrl }], [{ text: "Join the channel", url: CHANNEL_URL }], [{ text: "Stop updates", callback_data: "stop_updates" }]],
  };
}

async function sendDueFollowups(botUsername) {
  if (!isGrowthStoreConfigured()) return { ok: true, skipped: true, reason: "Growth store is not configured" };

  const due = await growthStore("list_due_followups", {
    now: new Date().toISOString(),
    limit: 40,
  });
  if (!due.ok) return { ok: false, error: due.error };

  const subscribers = Array.isArray(due.subscribers) ? due.subscribers : [];
  const results = [];
  for (const subscriber of subscribers) {
    const stage = Number(subscriber.stage || 0);
    if (![1, 2, 3].includes(stage)) continue;
    const message = followupMessage(stage, subscriber.first_name || "", botUsername);

    try {
      await telegram("sendMessage", {
        chat_id: subscriber.chat_id,
        text: message.text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: message.keyboard },
      });
      await growthStore("mark_followup", {
        chat_id: subscriber.chat_id,
        stage,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      results.push({ chatId: subscriber.chat_id, stage, sent: true });
    } catch (error) {
      const blocked = error.status === 403 || /blocked|chat not found/i.test(error.message);
      await growthStore(blocked ? "mark_blocked" : "mark_followup", {
        chat_id: subscriber.chat_id,
        stage,
        status: blocked ? "blocked" : "failed",
        error: error.message,
        sent_at: new Date().toISOString(),
      });
      results.push({ chatId: subscriber.chat_id, stage, sent: false, blocked, error: error.message });
    }
  }

  return { ok: true, due: subscribers.length, results };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await authorization(req);
  if (!auth.authorized) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const botUsername = await discoverBotUsername();
    const force = auth.source === "setup-key" && String(req.query?.force || "") === "1";
    const [webhook, channel, followups] = await Promise.all([
      ensureWebhook(),
      publishChannelContent(botUsername, force),
      sendDueFollowups(botUsername),
    ]);

    const ok = webhook.ok && channel.ok && followups.ok;
    return res.status(ok ? 200 : 207).json({
      ok,
      service: "GemAssist Opt-in Growth Engine",
      version: "5.1.0",
      authorization: auth.source,
      storageConfigured: isGrowthStoreConfigured(),
      webhook,
      channel,
      followups,
    });
  } catch (error) {
    console.error("Growth automation failed", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
