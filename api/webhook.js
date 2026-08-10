import { createHash, timingSafeEqual } from "node:crypto";
import { growthStore, isGrowthStoreConfigured, referralCodeFor } from "../lib/growth-store.js";

const VERSION = "5.1.2";
const WEBSITE = process.env.WEBSITE_URL || "https://gemcybersecurityassist.com";
const EMAIL = process.env.CONTACT_EMAIL || "Marketing@gemcybersecurityassist.com";
const PHONE = process.env.CONTACT_PHONE || "+1 (401) 702-2460";
const CHANNEL_URL = process.env.CHANNEL_URL || "https://t.me/mycybersecureWealthsolution";
let cachedBotUsername = "";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");
  return token;
}

function getWebhookSecret() {
  const token = getBotToken();
  return process.env.WEBHOOK_SECRET
    || process.env.SECRET_TOKEN
    || createHash("sha256").update(`gemassist-webhook:${token}`).digest("hex");
}

function getChannelTarget() {
  if (process.env.CHANNEL_ID) return process.env.CHANNEL_ID;
  try {
    const url = new URL(CHANNEL_URL);
    const slug = url.pathname.split("/").filter(Boolean).at(-1) || "";
    if (slug && !slug.startsWith("+")) return `@${slug}`;
  } catch {
    // CHANNEL_URL validation is handled by the membership response below.
  }
  return "";
}

function requestBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || response.statusText}`);
  }
  return data.result;
}

async function discoverBotUsername() {
  if (cachedBotUsername) return cachedBotUsername;
  const configured = String(process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (configured) {
    cachedBotUsername = configured;
    return cachedBotUsername;
  }
  const bot = await telegram("getMe");
  cachedBotUsername = bot.username || "Gemassistbuilder_Bot";
  return cachedBotUsername;
}

async function send(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...extra,
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

function joinKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📣 Join the intelligence channel", url: CHANNEL_URL }],
        [{ text: "✅ Verify membership", callback_data: "verify_membership" }],
      ],
    },
  };
}

async function shareKeyboard(userId, source = "share") {
  const botUsername = await discoverBotUsername();
  const code = referralCodeFor(userId);
  const payload = code ? `ref_${code}` : source;
  const botUrl = `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(payload)}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent("Join GemAssist for practical cybersecurity, real-estate fraud alerts, tools, and opportunities.")}`;
  return {
    botUrl,
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share GemAssist", url: shareUrl }],
        [{ text: "📣 Open the channel", url: CHANNEL_URL }],
      ],
    },
  };
}

function consentKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔔 Enable helpful updates", callback_data: "consent_updates" }],
        [{ text: "🛑 Stop updates", callback_data: "stop_updates" }],
      ],
    },
  };
}

const MENU = {
  reply_markup: {
    keyboard: [
      [{ text: "🔐 Threat Intel" }, { text: "🏠 Real Estate Alerts" }],
      [{ text: "💼 Services & Pricing" }, { text: "📣 Join Channel" }],
      [{ text: "🎁 Free Guide" }, { text: "📤 Share GemAssist" }],
      [{ text: "🔔 Update Status" }, { text: "🛑 Stop Updates" }],
      [{ text: "🚨 Emergency" }, { text: "❓ Help" }],
    ],
    resize_keyboard: true,
  },
};

async function getMembership(userId) {
  const channelTarget = getChannelTarget();
  if (!channelTarget) {
    return { verified: false, configured: false, reason: "A public CHANNEL_URL or CHANNEL_ID is required" };
  }
  try {
    const member = await telegram("getChatMember", { chat_id: channelTarget, user_id: userId });
    const verified = ["creator", "administrator", "member"].includes(member.status)
      || (member.status === "restricted" && member.is_member === true);
    return { verified, configured: true, status: member.status };
  } catch (error) {
    return { verified: false, configured: true, reason: error.message };
  }
}

function cleanStartPayload(value) {
  const payload = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(payload) ? payload : "direct";
}

async function upsertSubscriber(user, chatId, payload, consentStatus = "pending") {
  if (!isGrowthStoreConfigured()) return { ok: false, configured: false };
  const referrer = payload.startsWith("ref_") ? payload.slice(4) : "";
  const ownCode = referralCodeFor(user.id);
  const result = await growthStore("upsert_subscriber", {
    subscriber: {
      chat_id: chatId,
      user_id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      consent_status: consentStatus,
      referral_code: ownCode,
      referred_by: referrer && referrer !== ownCode ? referrer : "",
      source: referrer ? "referral" : payload,
      last_seen_at: new Date().toISOString(),
    },
  });
  if (result.ok && referrer && referrer !== ownCode) {
    await growthStore("record_referral", {
      referrer_code: referrer,
      new_chat_id: chatId,
      source: payload,
      created_at: new Date().toISOString(),
    });
  }
  return result;
}

async function saveVerifiedLead(user, chatId) {
  if (!isGrowthStoreConfigured()) return;
  await upsertSubscriber(user, chatId, "verified", "pending");
  await growthStore("mark_verified", {
    chat_id: chatId,
    verified_at: new Date().toISOString(),
  });
}

async function deliverGuide(req, chatId, user) {
  const membership = await getMembership(user.id);
  if (!membership.configured) {
    await send(chatId, "Membership verification is not configured yet. Please contact GEM support.");
    return;
  }
  if (!membership.verified) {
    await send(chatId, "Join the channel first, then tap <b>Verify membership</b> to unlock the guide.", joinKeyboard());
    return;
  }
  await saveVerifiedLead(user, chatId);
  const guideUrl = process.env.PDF_URL || `${requestBaseUrl(req)}/guide.pdf`;
  await send(chatId, `<b>Membership verified.</b>\n\n<a href="${escapeHtml(guideUrl)}">Open the 50 Free Tools & Opportunities premium guide</a>`, MENU);
}

async function enableUpdates(chatId, user) {
  if (!isGrowthStoreConfigured()) {
    await send(chatId, "Automated follow-up storage is not connected yet. The channel and bot commands remain available.", MENU);
    return false;
  }
  await upsertSubscriber(user, chatId, "telegram", "subscribed");
  const result = await growthStore("set_consent", {
    chat_id: chatId,
    consent_status: "subscribed",
    subscribed_at: new Date().toISOString(),
  });
  if (!result.ok) {
    await send(chatId, "I could not save your update preference. Please try again later.", MENU);
    return false;
  }
  await send(chatId, "<b>Helpful updates are enabled.</b>\n\nYou may receive up to three onboarding messages over the next seven days. Send /stop at any time to unsubscribe.", MENU);
  return true;
}

async function stopUpdates(chatId) {
  if (isGrowthStoreConfigured()) {
    await growthStore("set_consent", {
      chat_id: chatId,
      consent_status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
    });
  }
  await send(chatId, "<b>Automated updates stopped.</b>\n\nYou can still use the bot whenever you choose. Send /updates to enable the onboarding messages again.", MENU);
}

async function showUpdateStatus(chatId, userId) {
  const membership = await getMembership(userId);
  if (!isGrowthStoreConfigured()) {
    await send(chatId, `<b>GemAssist status</b>\n\nChannel membership: ${membership.verified ? "verified" : "not verified"}\nAutomated follow-ups: storage not connected\nBot commands: active`, MENU);
    return;
  }
  const stored = await growthStore("get_subscriber", { chat_id: chatId });
  const consent = stored.subscriber?.consent_status || "pending";
  await send(chatId, `<b>GemAssist status</b>\n\nChannel membership: ${membership.verified ? "verified" : "not verified"}\nAutomated follow-ups: ${escapeHtml(consent)}\nBot commands: active\n\nUse /updates to subscribe or /stop to unsubscribe.`, MENU);
}

function isValidWebhookRequest(req) {
  return safeEqual(req.headers["x-telegram-bot-api-secret-token"], getWebhookSecret());
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "GemAssist Telegram Bot",
      version: VERSION,
      mode: "opt-in",
      automaticActivation: true,
      consentBasedGrowth: true,
      growthStoreConfigured: isGrowthStoreConfigured(),
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!isValidWebhookRequest(req)) {
      return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
    }

    const update = req.body || {};
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      if (!chatId) return res.status(200).json({ ok: true });

      if (callback.data === "verify_membership") {
        const membership = await getMembership(callback.from.id);
        if (membership.verified) {
          await answerCallbackQuery(callback.id, "Membership verified");
          await deliverGuide(req, chatId, callback.from);
        } else {
          await answerCallbackQuery(callback.id, "Membership not found yet");
          await send(chatId, "I could not verify your membership yet. Join the channel and try again.", joinKeyboard());
        }
      } else if (callback.data === "consent_updates") {
        const enabled = await enableUpdates(chatId, callback.from);
        await answerCallbackQuery(callback.id, enabled ? "Updates enabled" : "Updates not enabled");
      } else if (callback.data === "stop_updates") {
        await stopUpdates(chatId);
        await answerCallbackQuery(callback.id, "Updates stopped");
      }
      return res.status(200).json({ ok: true });
    }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text || msg.chat?.type !== "private") return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const rawText = String(msg.text || "").trim();
    const tokens = rawText.split(/\s+/);
    const command = String(tokens[0] || "").toLowerCase().split("@")[0];
    const text = rawText.toLowerCase();
    const name = escapeHtml(msg.from?.first_name || "there");

    if (command === "/start") {
      const payload = cleanStartPayload(tokens[1]);
      await upsertSubscriber(msg.from, chatId, payload, "pending");
      await send(chatId, `<b>Welcome to GEM Cybersecurity Assist, ${name}.</b>\n\nUse this bot for defensive cybersecurity guidance, real-estate fraud alerts, services, and the premium creator guide.\n\nJoin voluntarily, verify membership, and choose whether to enable a short onboarding update sequence.`, joinKeyboard());
      await send(chatId, "Enable helpful updates only when you choose. The sequence contains no more than three messages over seven days and /stop works at any time.", consentKeyboard());
      const share = await shareKeyboard(msg.from.id);
      await send(chatId, "Use the menu below or share GemAssist with someone who would benefit.", share);
      await send(chatId, "Main menu", MENU);
    } else if (["/help", "/commands"].includes(command) || text.includes("help")) {
      await send(chatId, `<b>GEM Assistant — Commands</b>\n\n/intel — Defensive threat priorities\n/realestate — Real-estate fraud alerts\n/services — Services and pricing\n/channel — Join the channel\n/free_guide — Verify and open the premium guide\n/share — Get your personal sharing link\n/updates — Enable the short onboarding sequence\n/status — Check membership and update preferences\n/stop — Stop automated updates\n/latest_tools — Recommended tools\n/opportunities — Opportunity resources\n/contact — Contact GEM\n/emergency — Incident-response steps\n/sitestatus — Check the website`);
    } else if (command === "/updates" || text.includes("enable helpful updates")) {
      await enableUpdates(chatId, msg.from);
    } else if (["/stop", "/unsubscribe"].includes(command) || text.includes("stop updates")) {
      await stopUpdates(chatId);
    } else if (command === "/status" || text.includes("update status")) {
      await showUpdateStatus(chatId, msg.from.id);
    } else if (command === "/share" || text.includes("share gemassist")) {
      const share = await shareKeyboard(msg.from.id);
      await send(chatId, `<b>Your GemAssist sharing link</b>\n\n${escapeHtml(share.botUrl)}\n\nShare it only with people who may find the resources useful.`, share);
    } else if (command === "/services" || text.includes("services & pricing")) {
      await send(chatId, `<b>GEM Services and Pricing</b>\n\n<b>Annual Software Subscriptions</b>\n1. Endpoint Shield — <b>$299/yr</b>\n2. Phishing Defense Toolkit — <b>$199/yr</b>\n3. Compliance Vault — <b>$499/yr</b>\n4. Threat Intel Dashboard — <b>$399/yr</b>\n5. Security Starter Suite — <b>$799/yr</b>\n\n<b>Professional Services</b>\n• Security Readiness Review — from $1,500\n• Compliance Evidence Sprint — from $2,500\n• Executive Security Reporting — $750/mo\n\nEmail: ${escapeHtml(EMAIL)}\nPhone: ${escapeHtml(PHONE)}\n<a href="${escapeHtml(WEBSITE)}">${escapeHtml(WEBSITE)}</a>`);
    } else if (["/intel", "/threats"].includes(command) || text.includes("threat intel")) {
      await send(chatId, `<b>Current Defensive Priorities</b>\n\n• Phishing-resistant MFA for privileged accounts\n• Patch management for internet-facing systems\n• Cloud configuration review and least privilege\n• Tested offline backups and recovery exercises\n• Vendor and software-supply-chain review\n• Wire-transfer verification using a separate channel\n\n<a href="${escapeHtml(CHANNEL_URL)}">Subscribe for defensive briefings</a>`);
    } else if (command === "/realestate" || text.includes("real estate")) {
      await send(chatId, `<b>Real Estate Fraud Alerts</b>\n\n<b>Wire Fraud</b>\nVerify all payment instructions using a trusted phone number before sending funds.\n\n<b>Title Fraud</b>\nMonitor property records and investigate unexpected filing notices.\n\n<b>Rental Scams</b>\nConfirm ownership and avoid deposits before independent verification.\n\nPhone: ${escapeHtml(PHONE)}`);
    } else if (["/channel", "/subscribe"].includes(command) || text.includes("join channel")) {
      await send(chatId, "Join voluntarily for defensive briefings, fraud alerts, and practical security guidance.", joinKeyboard());
    } else if (command === "/free_guide" || text.includes("free guide")) {
      await deliverGuide(req, chatId, msg.from);
    } else if (command === "/latest_tools") {
      await send(chatId, `<b>Recommended Starter Tools</b>\n\n• Password manager\n• Authenticator or security key\n• Device and browser update controls\n• Backup and recovery tooling\n• Project tracker for remediation evidence\n\nThe complete creator-resource list is available through /free_guide.`);
    } else if (command === "/opportunities") {
      await send(chatId, `<b>Opportunity Resources</b>\n\nUse reputable job boards, official grant portals, verified company career pages, and recognized freelance platforms. Verify the organization and never pay an upfront fee to receive a job or award.`);
    } else if (command === "/about") {
      await send(chatId, `<b>About GEM Cybersecurity Assist</b>\n\nHelping organizations operationalize defensive cybersecurity through practical software, evidence workflows, and compliance-ready operations.\n\n<a href="${escapeHtml(WEBSITE)}">${escapeHtml(WEBSITE)}</a>`);
    } else if (command === "/emergency" || text.includes("emergency")) {
      await send(chatId, `<b>Security Incident Response</b>\n\n1. Isolate affected systems from the network.\n2. Preserve logs, timestamps, screenshots, and relevant messages.\n3. Notify the responsible IT and security contacts.\n4. Use established legal, insurer, and law-enforcement escalation paths when required.\n5. Contact GEM: ${escapeHtml(PHONE)} | ${escapeHtml(EMAIL)}`);
    } else if (command === "/contact" || text.includes("contact us")) {
      await send(chatId, `<b>Contact GEM Cybersecurity Assist</b>\n\nEmail: ${escapeHtml(EMAIL)}\nPhone: ${escapeHtml(PHONE)}\n<a href="${escapeHtml(WEBSITE)}">${escapeHtml(WEBSITE)}</a>`);
    } else if (command === "/quote") {
      await send(chatId, `<b>Request a Quote</b>\n\nSend your business name, industry, approximate user/device count, requested services, and compliance requirements to ${escapeHtml(EMAIL)}.`);
    } else if (command === "/endpoint") {
      await send(chatId, `<b>Endpoint Shield — $299/year</b>\n\nDevice posture tracking, baseline visibility, risk workflow, and executive reporting.`);
    } else if (command === "/phishing") {
      await send(chatId, `<b>Phishing Defense Toolkit — $199/year</b>\n\nCampaign planning, awareness tracking, training status, and executive reporting.`);
    } else if (command === "/vault") {
      await send(chatId, `<b>Compliance Vault — $499/year</b>\n\nEvidence register, control mapping, ownership, due dates, and audit-readiness tracking.`);
    } else if (command === "/threatdash") {
      await send(chatId, `<b>Threat Intel Dashboard — $399/year</b>\n\nWatchlists, signal tracking, risk priorities, and executive digests.`);
    } else if (command === "/suite") {
      await send(chatId, `<b>Security Starter Suite — $799/year</b>\n\nEndpoint Shield, Phishing Defense, Compliance Vault, and Threat Intel Dashboard in one bundle.`);
    } else if (command === "/sitestatus") {
      try {
        const response = await fetch(WEBSITE, { method: "HEAD" });
        await send(chatId, response.ok ? `${escapeHtml(WEBSITE)} is online — HTTP ${response.status}` : `${escapeHtml(WEBSITE)} returned HTTP ${response.status}`);
      } catch {
        await send(chatId, `${escapeHtml(WEBSITE)} could not be reached from the bot service.`);
      }
    } else {
      await send(chatId, `Hi ${name}. Type /help to see all commands.`, MENU);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return res.status(500).json({ ok: false, error: "Webhook processing failed" });
  }
}
