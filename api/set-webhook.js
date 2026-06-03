export default async function handler(req, res) {
  const token = process.env.BOT_TOKEN;
  const secret = process.env.SECRET_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "BOT_TOKEN missing" });

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const webhookUrl = `${proto}://${host}/api/webhook`;

  const result = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ["message", "callback_query"]
    })
  });

  const data = await result.json();
  return res.status(200).json({ ok: true, webhookUrl, telegram: data });
}
