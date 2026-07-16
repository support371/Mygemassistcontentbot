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

export default async function handler(req, res) {
  const username = await discoverBotUsername();
  if (!username) {
    return res.status(503).json({ ok: false, error: "Telegram bot identity could not be resolved" });
  }
  return res.redirect(302, `https://t.me/${encodeURIComponent(username)}?start=website`);
}
