import { timingSafeEqual } from "node:crypto";

const VERSION = "4.0.0";
const WEBSITE = process.env.WEBSITE_URL || "https://gemcybersecurityassist.com";
const EMAIL = process.env.CONTACT_EMAIL || "Marketing@gemcybersecurityassist.com";
const PHONE = process.env.CONTACT_PHONE || "+1 (401) 702-2460";
const CHANNEL_URL = process.env.CHANNEL_URL || "https://t.me/mycybersecureWealthsolution";
const CHANNEL_ID = process.env.CHANNEL_ID || "";
const GOOGLE_APPS_SCRIPT_WEBHOOK = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK || "";

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

const MENU = {
  reply_markup: {
    keyboard: [
      [{ text: "🔐 Threat Intel" }, { text: "🏠 Real Estate Alerts" }],
      [{ text: "💼 Services & Pricing" }, { text: "📣 Join Channel" }],
      [{ text: "🎁 Free Guide" }, { text: "📞 Contact Us" }],
      [{ text: "🚨 Emergency" }, { text: "❓ Help" }],
    ],
    resize_keyboard: true,
  },
};

async function getMembership(userId) {
  if (!CHANNEL_ID) {
    return { verified: false, configured: false, reason: "CHANNEL_ID is not configured" };
  }
  try {
    const member = await telegram("getChatMember", { chat_id: CHANNEL_ID, user_id: userId });
    const verified = ["creator", "administrator", "member"].includes(member.status)
      || (member.status === "restricted" && member.is_member === true);
    return { verified, configured: true, status: member.status };
  } catch (error) {
    return { verified: false, configured: true, reason: error.message };
  }
}

async function saveVerifiedLead(user) {
  if (!GOOGLE_APPS_SCRIPT_WEBHOOK) return;
  try {
    await fetch(GOOGLE_APPS_SCRIPT_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "telegram",
        telegram_user_id: user.id,
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        verified_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("Lead capture failed", error.message);
  }
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
  await saveVerifiedLead(user);
  const guideUrl = process.env.PDF_URL || `${requestBaseUrl(req)}/guide.pdf`;
  await send(chatId, `<b>Membership verified.</b>\n\n<a href="${escapeHtml(guideUrl)}">Open the 50 Free Tools & Opportunities guide</a>`, MENU);
}

function isValidWebhookRequest(req) {
  const configuredSecret = process.env.WEBHOOK_SECRET || process.env.SECRET_TOKEN;
  if (!configuredSecret) return false;
  return safeEqual(req.headers["x-telegram-bot-api-secret-token"], configuredSecret);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "GemAssist Telegram Bot", version: VERSION, mode: "opt-in" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isValidWebhookRequest(req)) {
    return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
  }

  try {
    const update = req.body || {};
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      if (callback.data === "verify_membership" && chatId) {
        const membership = await getMembership(callback.from.id);
        if (membership.verified) {
          await answerCallbackQuery(callback.id, "Membership verified");
          await deliverGuide(req, chatId, callback.from);
        } else {
          await answerCallbackQuery(callback.id, "Membership not found yet");
          await send(chatId, "I could not verify your membership yet. Join the channel and try again.", joinKeyboard());
        }
      }
      return res.status(200).json({ ok: true });
    }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text || msg.chat?.type !== "private") return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const rawText = String(msg.text || "").trim();
    const command = rawText.toLowerCase().split("@")[0];
    const text = rawText.toLowerCase();
    const name = escapeHtml(msg.from?.first_name || "there");

    if (command === "/start") {
      await send(chatId, `<b>Welcome to GEM Cybersecurity Assist, ${name}.</b>\n\nUse this bot for defensive cybersecurity guidance, real-estate fraud alerts, services, and the free creator guide.\n\nJoin voluntarily, then verify membership to unlock the guide.`, joinKeyboard());
      await send(chatId, "Use the menu below at any time.", MENU);
    } else if (["/help", "/commands"].includes(command) || text.includes("help")) {
      await send(chatId, `<b>GEM Assistant — Commands</b>\n\n/intel — Defensive threat priorities\n/realestate — Real-estate fraud alerts\n/services — Services and pricing\n/channel — Join the channel\n/free_guide — Verify and open the guide\n/latest_tools — Recommended tools\n/opportunities — Opportunity resources\n/contact — Contact GEM\n/emergency — Incident-response steps\n/sitestatus — Check the website`);
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
