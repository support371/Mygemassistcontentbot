const APPROVED_START_SOURCES = new Set([
  "website",
  "channel_wealth_20260719",
  "channel_tools_20260720",
  "channel_security_20260721",
  "channel_invite",
  "ext_irishfutures",
  "ext_learncyber",
  "ext_cyberhub",
  "ext_100xsecurity",
  "ext_cybermind",
  "ext_jobsregion",
  "ext_jobsnigeria",
  "ext_lagosrealestate",
  "ext_telega",
  "ext_telegramads",
]);

async function discoverBotUsername() {
  const configured = (process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (configured) return configured;

  const token = process.env.BOT_TOKEN;
  if (!token) return "";

  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) return "";
  return data.result?.username || "";
}

function queryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function approvedStartSource(query = {}) {
  const candidate = String(queryValue(query.src ?? query.source) || "").trim();
  return APPROVED_START_SOURCES.has(candidate) ? candidate : "website";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const username = await discoverBotUsername();
  if (!username) {
    return res.status(503).json({ ok: false, error: "Telegram bot identity could not be resolved" });
  }
  const source = approvedStartSource(req.query || {});
  return res.redirect(302, `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(source)}`);
}
