import { timingSafeEqual } from "node:crypto";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorized(req) {
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) return false;
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const headerKey = req.headers["x-setup-key"] || "";
  return safeEqual(bearer || headerKey, setupKey);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST with Authorization: Bearer <SETUP_KEY>" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const token = process.env.BOT_TOKEN;
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.SECRET_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "BOT_TOKEN missing" });
  if (!webhookSecret) return res.status(500).json({ ok: false, error: "WEBHOOK_SECRET missing" });

  const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = configuredBaseUrl || `${proto}://${host}`;
  const webhookUrl = `${baseUrl}/api/webhook`;

  try {
    const getMeResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const getMe = await getMeResponse.json();
    if (!getMeResponse.ok || !getMe.ok) {
      return res.status(502).json({ ok: false, error: getMe.description || "Telegram bot validation failed" });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: process.env.DROP_PENDING_UPDATES === "true",
      }),
    });
    const telegram = await response.json();
    if (!response.ok || !telegram.ok) {
      return res.status(502).json({ ok: false, webhookUrl, error: telegram.description || "Telegram setWebhook failed" });
    }

    return res.status(200).json({
      ok: true,
      webhookUrl,
      bot: `@${getMe.result.username}`,
      telegram: telegram.description,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message });
  }
}
