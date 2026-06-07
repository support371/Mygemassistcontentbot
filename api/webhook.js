const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const CHANNEL_INVITE = "https://t.me/+hlefNslWU7c5NjM0";
const CHANNEL_LINK = "https://t.me/mycybersecureWealthsolution";
const WEBSITE = "https://gemcybersecurityassist.com";
const EMAIL = "Marketing@gemcybersecurityassist.com";
const PHONE = "+1 (401) 702-2460";

async function send(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false, ...extra }),
  });
}

const MENU = {
  reply_markup: {
    keyboard: [
      [{ text: "🔐 Threat Intel" }, { text: "🏠 Real Estate Alerts" }],
      [{ text: "💼 Services & Pricing" }, { text: "📣 Join Channel" }],
      [{ text: "🚨 Emergency" }, { text: "📞 Contact Us" }],
      [{ text: "❓ Help" }],
    ],
    resize_keyboard: true,
  },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, status: "GEM Bot Webhook Active", bot: "@Gemassistbuilder_Bot" });
  }
  if (req.method !== "POST") return res.status(405).end();

  const update = req.body;
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text || msg.chat?.type !== "private") return res.status(200).end();

  const chatId = msg.chat.id;
  const cmd = msg.text.trim().toLowerCase().split("@")[0];
  const name = msg.from?.first_name || "there";

  if (cmd === "/start") {
    await send(chatId, `<b>Welcome to GEM Cybersecurity Assist, ${name}!</b>\n\nI'm <b>GEM Assistent</b> — your cybersecurity and real estate protection guide.\n\n/intel — Threat briefing\n/realestate — Real estate fraud alerts\n/services — All services and pricing\n/channel — Join our intelligence channel\n/emergency — Security incident response\n/contact — Reach our team\n/help — Full command list\n\n<a href="${CHANNEL_INVITE}">Join our free daily intelligence channel</a>`, MENU);

  } else if (["/help", "/commands"].includes(cmd) || cmd.includes("help")) {
    await send(chatId, `<b>GEM Assistent — All Commands</b>\n\n<b>Intelligence</b>\n/intel — Threat briefing\n/realestate — Real estate fraud alerts\n\n<b>Services</b>\n/services — All services and pricing\n/endpoint — Endpoint Shield $299/yr\n/phishing — Phishing Defense $199/yr\n/vault — Compliance Vault $499/yr\n/threatdash — Threat Intel Dashboard $399/yr\n/suite — Full bundle $799/yr\n\n<b>Support</b>\n/channel — Join our channel\n/about — About GEM\n/contact — Contact us\n/emergency — Incident response\n/quote — Request a quote\n/free_guide — Free security guide\n/sitestatus — Check website status`);

  } else if (cmd === "/services" || msg.text.includes("Services")) {
    await send(chatId, `<b>GEM Services and Pricing</b>\n\n<b>Annual Software Subscriptions</b>\n1. Endpoint Shield — <b>$299/yr</b>\n2. Phishing Defense Toolkit — <b>$199/yr</b>\n3. Compliance Vault — <b>$499/yr</b>\n4. Threat Intel Dashboard — <b>$399/yr</b>\n5. Security Starter Suite — <b>$799/yr</b>\n\n<b>Professional Services</b>\n• Security Readiness Review — from $1,500\n• Compliance Evidence Sprint — from $2,500\n• Executive Security Reporting — $750/mo\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>`);

  } else if (cmd === "/intel" || cmd === "/threats" || msg.text.includes("Threat Intel")) {
    await send(chatId, `<b>GEM Threat Intel — June 2026</b>\n\n<b>CRITICAL</b>\n• AI-powered phishing bypassing email filters\n• Ransomware-as-a-Service targeting unpatched SMBs\n• SIM Swap surge — 40% increase in carrier fraud\n\n<b>HIGH PRIORITY</b>\n• Cloud misconfiguration exploits\n• Supply chain attacks on npm/PyPI packages\n• Deepfake voice fraud for wire transfer auth\n\n<b>WATCH LIST</b>\n• IoT botnets on smart office devices\n• QR code phishing (quishing)\n• Tax identity fraud post-season\n\nTip: Enable FIDO2 MFA on all business email. SMS 2FA is no longer safe.\n\n<a href="${CHANNEL_LINK}">Subscribe for daily briefings</a>`);

  } else if (cmd === "/realestate" || msg.text.includes("Real Estate")) {
    await send(chatId, `<b>Real Estate Fraud Alerts</b>\n\n<b>Wire Fraud</b>\nScammers intercept closing emails with fake wire instructions. Always verify by phone — never email alone.\n\n<b>Title Fraud</b>\nCriminals forge deed transfers using stolen identity. Monitor property records quarterly.\n\n<b>Rental Scams</b>\nFake listings, below-market price, Zelle deposit required. Always view in person.\n\n<b>Foreclosure Relief Scams</b>\nFake rescue companies charging upfront fees. HUD counselors never charge first.\n\nNever wire based on email alone.\nVerify routing numbers by phone on official documents.\n\nPhone: ${PHONE}`);

  } else if (cmd === "/channel" || msg.text.includes("Join Channel")) {
    await send(chatId, `<b>Join Our Free Intelligence Channel</b>\n\nDaily threat briefings (7 AM ET)\nReal estate fraud alerts\nFinancial scam warnings\nGEM security tips\nWeekly intel digest\n\n<a href="${CHANNEL_INVITE}">Join @mycybersecureWealthsolution now</a>\n\nAlready a member? Share this bot with a friend:\nhttps://t.me/Gemassistbuilder_Bot`);

  } else if (cmd === "/about") {
    await send(chatId, `<b>About GEM Cybersecurity Assist</b>\n\nHelping businesses operationalize defensive cybersecurity through practical software, evidence workflows, and compliance-ready operations.\n\nGEM Cybersecurity and Monitoring Assist\nAlliance Trust Realty\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>`);

  } else if (cmd === "/emergency" || msg.text.includes("Emergency")) {
    await send(chatId, `<b>Security Incident Response</b>\n\n<b>Step 1 — Contain</b>\nDisconnect affected devices. Do NOT power off — preserve evidence.\n\n<b>Step 2 — Assess</b>\nDocument what systems and data are affected with timestamps.\n\n<b>Step 3 — Notify</b>\n• IT team immediately\n• Legal if customer data involved\n• FBI IC3: ic3.gov for financial fraud\n\n<b>Step 4 — Contact GEM</b>\nPhone: <b>${PHONE}</b>\nEmail: ${EMAIL}\n\nAct immediately. Every minute counts.`);

  } else if (cmd === "/contact" || msg.text.includes("Contact")) {
    await send(chatId, `<b>Contact GEM Cybersecurity Assist</b>\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>\nFax: 855-673-2062\nAddress: 444 Alaska Ave, Torrance, CA 90503\n\nHours: Mon–Fri 9AM–6PM ET\nEmergency line: 24/7`);

  } else if (cmd === "/quote") {
    await send(chatId, `<b>Request a Quote</b>\n\nSend us:\n1. Business name and industry\n2. Number of employees and devices\n3. Services needed\n4. Compliance requirements (SOC 2, HIPAA, etc.)\n5. Budget range\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n\nAll quotes free. Response within 1 business day.`);

  } else if (cmd === "/free_guide") {
    await send(chatId, `<b>Free Cybersecurity Starter Guide</b>\n\n5 Actions to Take Today:\n\n1. Enable MFA on email, banking, cloud — use authenticator app, not SMS\n2. Audit admin access — remove anyone who no longer needs it\n3. Test backups — restore a file today to confirm it works\n4. Patch everything — 60% of breaches exploit known vulnerabilities\n5. Write one security policy — even one page builds credibility\n\nEmail ${EMAIL} with subject "Free Guide" for the full 50-action checklist.\n\n<a href="${CHANNEL_LINK}">Join our daily intelligence channel</a>`);

  } else if (cmd === "/endpoint") {
    await send(chatId, `<b>Endpoint Shield — $299/year</b>\n\nDevice posture tracking, baseline visibility, executive reporting.\n\n✅ Endpoint posture dashboard\n✅ Device baseline checklist\n✅ Risk register workflow\n✅ Weekly executive export\n\nEmail: ${EMAIL}\nPhone: ${PHONE}`);

  } else if (cmd === "/phishing") {
    await send(chatId, `<b>Phishing Defense Toolkit — $199/year</b>\n\nCampaign planning, user risk tracking, awareness reporting.\n\n✅ Phishing campaign planner\n✅ User risk tracker\n✅ Training status dashboard\n✅ Executive awareness reports\n\nEmail: ${EMAIL}\nPhone: ${PHONE}`);

  } else if (cmd === "/vault") {
    await send(chatId, `<b>Compliance Vault — $499/year</b>\n\nEvidence register, control mapping, audit readiness.\n\n✅ Policy and control library\n✅ Evidence register\n✅ Audit readiness tracker\n✅ Owner and due-date workflow\n\nEmail: ${EMAIL}\nPhone: ${PHONE}`);

  } else if (cmd === "/threatdash") {
    await send(chatId, `<b>Threat Intel Dashboard — $399/year</b>\n\nRisk watchlists, signal tracking, executive digests.\n\n✅ Threat watchlist workspace\n✅ Risk signal dashboard\n✅ Monthly executive digest\n✅ Security priority tracker\n\nEmail: ${EMAIL}\nPhone: ${PHONE}`);

  } else if (cmd === "/suite") {
    await send(chatId, `<b>Security Starter Suite — $799/year — Best Value</b>\n\nAll 4 tools bundled. Save $597.\n\n✅ Endpoint Shield ($299)\n✅ Phishing Defense ($199)\n✅ Compliance Vault ($499)\n✅ Threat Intel Dashboard ($399)\n\nTotal value $1,396. You pay $799.\n\nEmail: ${EMAIL}\nPhone: ${PHONE}`);

  } else if (cmd === "/sitestatus") {
    try {
      const r = await fetch("https://gemcybersecurityassist.com", { method: "HEAD" });
      await send(chatId, r.ok ? `gemcybersecurityassist.com is ONLINE — HTTP ${r.status}` : `gemcybersecurityassist.com returned status ${r.status}`);
    } catch {
      await send(chatId, `gemcybersecurityassist.com appears offline. Monitoring 24/7.`);
    }

  } else {
    await send(chatId, `Hi ${name}! I didn't recognize that command.\n\nType /help to see all available commands, or tap a button from the menu below.\n\n<a href="${CHANNEL_INVITE}">Join our free intelligence channel</a>`, MENU);
  }

  return res.status(200).end();
}
