// GEM Cybersecurity Assist — Telegram Bot Webhook v3
const CHANNEL_INVITE = "https://t.me/+hlefNslWU7c5NjM0";
const CHANNEL_LINK = "https://t.me/mycybersecureWealthsolution";
const WEBSITE = "https://gemcybersecurityassist.com";
const EMAIL = "Marketing@gemcybersecurityassist.com";
const PHONE = "+1 (401) 702-2460";

function getBotToken() {
  return process.env.BOT_TOKEN_2 || process.env.BOT_TOKEN || "8327316373:AAEXeisn6svbs6JHtlIWBon7YOQzbu7upq4";
}

async function send(chatId, text, extra = {}) {
  const tok = getBotToken();
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
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
    return res.status(200).json({ ok: true, status: "GEM Bot Webhook Active", bot: "@gemassistmedia_bot" });
  }
  if (req.method !== "POST") return res.status(405).end();

  const update = req.body;
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text || msg.chat?.type !== "private") return res.status(200).end();

  const chatId = msg.chat.id;
  const cmd = (msg.text || "").trim().toLowerCase().split("@")[0];
  const t = (msg.text || "").toLowerCase();
  const name = msg.from?.first_name || "there";

  if (cmd === "/start") {
    await send(chatId, `<b>Welcome to GEM Cybersecurity Assist, ${name}!</b>\n\nI\'m <b>GEM Assistent</b> \u2014 your cybersecurity and real estate protection guide.\n\n/intel \u2014 Threat briefing\n/realestate \u2014 Real estate fraud alerts\n/services \u2014 All services and pricing\n/channel \u2014 Join our intelligence channel\n/emergency \u2014 Security incident response\n/contact \u2014 Reach our team\n/help \u2014 Full command list\n\n<a href="${CHANNEL_INVITE}">Join our free daily intelligence channel</a>`, MENU);

  } else if (["/help", "/commands"].includes(cmd)) {
    await send(chatId, `<b>GEM Assistent \u2014 All Commands</b>\n\n<b>Intelligence</b>\n/intel \u2014 Threat briefing\n/realestate \u2014 Fraud alerts\n\n<b>Services</b>\n/services \u2014 All services and pricing\n/endpoint \u2014 Endpoint Shield $299/yr\n/phishing \u2014 Phishing Defense $199/yr\n/vault \u2014 Compliance Vault $499/yr\n/threatdash \u2014 Threat Intel Dashboard $399/yr\n/suite \u2014 Full bundle $799/yr\n\n<b>Support</b>\n/channel \u2014 Join our channel\n/about \u2014 About GEM\n/contact \u2014 Contact us\n/emergency \u2014 Incident response\n/quote \u2014 Get a quote\n/free_guide \u2014 Free security guide\n/sitestatus \u2014 Check website`);

  } else if (cmd === "/services" || t.includes("services & pricing")) {
    await send(chatId, `<b>GEM Services and Pricing</b>\n\n<b>Annual Software Subscriptions</b>\n1. Endpoint Shield \u2014 <b>$299/yr</b>\n2. Phishing Defense Toolkit \u2014 <b>$199/yr</b>\n3. Compliance Vault \u2014 <b>$499/yr</b>\n4. Threat Intel Dashboard \u2014 <b>$399/yr</b>\n5. Security Starter Suite \u2014 <b>$799/yr</b>\n\n<b>Professional Services</b>\n\u2022 Security Readiness Review \u2014 from $1,500\n\u2022 Compliance Evidence Sprint \u2014 from $2,500\n\u2022 Executive Security Reporting \u2014 $750/mo\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>`);

  } else if (["/intel", "/threats"].includes(cmd) || t.includes("threat intel")) {
    await send(chatId, `<b>GEM Threat Intel \u2014 June 2026</b>\n\n<b>CRITICAL</b>\n\u2022 AI-powered phishing bypassing email filters\n\u2022 Ransomware-as-a-Service targeting unpatched SMBs\n\u2022 SIM Swap surge \u2014 40% increase in carrier fraud\n\n<b>HIGH PRIORITY</b>\n\u2022 Cloud misconfiguration exploits\n\u2022 Supply chain attacks on npm/PyPI\n\u2022 Deepfake voice fraud for wire transfers\n\n<b>WATCH LIST</b>\n\u2022 IoT botnets on smart office devices\n\u2022 QR code phishing (quishing)\n\u2022 Tax identity fraud post-season\n\nTip: Enable FIDO2 MFA on all business email.\n\n<a href="${CHANNEL_LINK}">Subscribe for daily briefings</a>`);

  } else if (cmd === "/realestate" || t.includes("real estate")) {
    await send(chatId, `<b>Real Estate Fraud Alerts</b>\n\n<b>Wire Fraud</b>\nScammers send fake wire instructions via email. Verify by phone \u2014 never email alone.\n\n<b>Title Fraud</b>\nCriminals forge deed transfers. Monitor property records quarterly.\n\n<b>Rental Scams</b>\nFake listings, below-market price, Zelle deposit required.\n\n<b>Foreclosure Scams</b>\nFake rescue companies charging upfront fees.\n\nNever wire based on email alone. Verify routing by phone.\n\nPhone: ${PHONE}`);

  } else if (cmd === "/channel" || t.includes("join channel")) {
    await send(chatId, `<b>Join Our Free Intelligence Channel</b>\n\nDaily threat briefings (7 AM ET)\nReal estate fraud alerts\nFinancial scam warnings\nGEM security tips\nWeekly intel digest\n\n<a href="${CHANNEL_INVITE}">Join @mycybersecureWealthsolution now</a>\n\nShare this bot with a friend:\nhttps://t.me/gemassistmedia_bot`);

  } else if (cmd === "/about") {
    await send(chatId, `<b>About GEM Cybersecurity Assist</b>\n\nHelping businesses operationalize defensive cybersecurity through practical software, evidence workflows, and compliance-ready operations.\n\nGEM Cybersecurity and Monitoring Assist\nAlliance Trust Realty\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>`);

  } else if (cmd === "/emergency" || t.includes("emergency")) {
    await send(chatId, `<b>Security Incident Response</b>\n\n<b>Step 1 \u2014 Contain</b>\nDisconnect affected devices. Do NOT power off.\n\n<b>Step 2 \u2014 Assess</b>\nDocument what is affected with timestamps.\n\n<b>Step 3 \u2014 Notify</b>\n\u2022 IT team immediately\n\u2022 Legal if customer data involved\n\u2022 FBI IC3: ic3.gov\n\n<b>Step 4 \u2014 Contact GEM</b>\nPhone: <b>${PHONE}</b>\nEmail: ${EMAIL}\n\nAct immediately. Every minute counts.`);

  } else if (cmd === "/contact" || t.includes("contact us")) {
    await send(chatId, `<b>Contact GEM Cybersecurity Assist</b>\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n<a href="${WEBSITE}">${WEBSITE}</a>\nFax: 855-673-2062\n444 Alaska Ave, Torrance, CA 90503\n\nHours: Mon\u2013Fri 9AM\u20136PM ET\nEmergency: 24/7`);

  } else if (cmd === "/quote") {
    await send(chatId, `<b>Request a Quote</b>\n\nSend us:\n1. Business name and industry\n2. Number of employees and devices\n3. Services needed\n4. Compliance requirements\n5. Budget range\n\nEmail: ${EMAIL}\nPhone: ${PHONE}\n\nAll quotes free. Response within 1 business day.`);

  } else if (cmd === "/free_guide") {
    await send(chatId, `<b>Free Cybersecurity Starter Guide</b>\n\n1. Enable MFA \u2014 authenticator app, not SMS\n2. Audit admin access \u2014 remove who no longer needs it\n3. Test backups \u2014 restore a file today\n4. Patch everything \u2014 60% of breaches exploit known CVEs\n5. Write one security policy \u2014 builds credibility\n\nEmail ${EMAIL} with subject \"Free Guide\" for the full 50-action checklist.\n\n<a href="${CHANNEL_LINK}">Join our daily channel</a>`);

  } else if (cmd === "/endpoint") {
    await send(chatId, `<b>Endpoint Shield \u2014 $299/year</b>\n\nDevice posture tracking, baseline visibility, executive reporting.\n\u2705 Endpoint posture dashboard\n\u2705 Device baseline checklist\n\u2705 Risk register workflow\n\u2705 Weekly executive export\n\nEmail: ${EMAIL} | Phone: ${PHONE}`);

  } else if (cmd === "/phishing") {
    await send(chatId, `<b>Phishing Defense Toolkit \u2014 $199/year</b>\n\nCampaign planning, user risk tracking, awareness reporting.\n\u2705 Phishing campaign planner\n\u2705 User risk tracker\n\u2705 Training status dashboard\n\u2705 Executive awareness reports\n\nEmail: ${EMAIL} | Phone: ${PHONE}`);

  } else if (cmd === "/vault") {
    await send(chatId, `<b>Compliance Vault \u2014 $499/year</b>\n\nEvidence register, control mapping, audit readiness.\n\u2705 Policy and control library\n\u2705 Evidence register\n\u2705 Audit readiness tracker\n\u2705 Owner and due-date workflow\n\nEmail: ${EMAIL} | Phone: ${PHONE}`);

  } else if (cmd === "/threatdash") {
    await send(chatId, `<b>Threat Intel Dashboard \u2014 $399/year</b>\n\nRisk watchlists, signal tracking, executive digests.\n\u2705 Threat watchlist workspace\n\u2705 Risk signal dashboard\n\u2705 Monthly executive digest\n\u2705 Security priority tracker\n\nEmail: ${EMAIL} | Phone: ${PHONE}`);

  } else if (cmd === "/suite") {
    await send(chatId, `<b>Security Starter Suite \u2014 $799/year \u2014 Best Value</b>\n\nAll 4 tools bundled. Save $597.\n\u2705 Endpoint Shield ($299)\n\u2705 Phishing Defense ($199)\n\u2705 Compliance Vault ($499)\n\u2705 Threat Intel Dashboard ($399)\n\nTotal value $1,396. You pay $799.\n\nEmail: ${EMAIL} | Phone: ${PHONE}`);

  } else if (cmd === "/sitestatus") {
    try {
      const r = await fetch("https://gemcybersecurityassist.com", { method: "HEAD" });
      await send(chatId, r.ok ? `gemcybersecurityassist.com is ONLINE \u2014 HTTP ${r.status}` : `gemcybersecurityassist.com returned status ${r.status}`);
    } catch {
      await send(chatId, `gemcybersecurityassist.com appears offline. Monitoring 24/7.`);
    }

  } else {
    await send(chatId, `Hi ${name}! Type /help to see all commands.\n\n<a href="${CHANNEL_INVITE}">Join our free intelligence channel</a>`, MENU);
  }

  return res.status(200).end();
}
