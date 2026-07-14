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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "BOT_TOKEN missing" });

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return res.status(502).json({ ok: false, error: data.description || "Telegram getWebhookInfo failed" });
    }
    const result = data.result || {};
    return res.status(200).json({
      ok: true,
      webhook: {
        url: result.url || "",
        has_custom_certificate: Boolean(result.has_custom_certificate),
        pending_update_count: result.pending_update_count || 0,
        last_error_date: result.last_error_date || null,
        last_error_message: result.last_error_message || null,
        max_connections: result.max_connections || null,
        allowed_updates: result.allowed_updates || [],
      },
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message });
  }
}
