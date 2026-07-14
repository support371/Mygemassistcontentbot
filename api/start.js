export default function handler(req, res) {
  const username = (process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (!username) {
    return res.status(503).json({ ok: false, error: "BOT_USERNAME is not configured" });
  }
  return res.redirect(302, `https://t.me/${encodeURIComponent(username)}?start=website`);
}
