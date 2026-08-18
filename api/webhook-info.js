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

function isHealthRoute(req) {
  const origin = `https://${req.headers.host || "localhost"}`;
  const pathname = new URL(req.url || "/api/webhook-info", origin).pathname;
  return pathname === "/api/webhook-health";
}

function healthPayload(result = {}) {
  const configured = Boolean(result.url);
  const pendingUpdateCount = Number(result.pending_update_count || 0);
  const lastErrorDate = result.last_error_date || null;
  return {
    ok: true,
    service: "telegram-webhook-health",
    configured,
    healthy: configured && !lastErrorDate,
    pendingUpdateCount,
    hasRecentError: Boolean(lastErrorDate),
    lastErrorDate,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const healthRoute = isHealthRoute(req);
  if (!healthRoute && !isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return healthRoute
      ? res.status(503).json({ ok: false, service: "telegram-webhook-health", configured: false, healthy: false, error: "bot_not_configured" })
      : res.status(500).json({ ok: false, error: "BOT_TOKEN missing" });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return healthRoute
        ? res.status(502).json({ ok: false, service: "telegram-webhook-health", configured: true, healthy: false, error: "telegram_health_check_failed" })
        : res.status(502).json({ ok: false, error: data.description || "Telegram getWebhookInfo failed" });
    }

    const result = data.result || {};
    if (healthRoute) return res.status(200).json(healthPayload(result));

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
    return healthRoute
      ? res.status(502).json({ ok: false, service: "telegram-webhook-health", configured: true, healthy: false, error: "telegram_health_check_failed" })
      : res.status(502).json({ ok: false, error: error.message });
  }
}
