export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return res.status(503).json({
      ok: false,
      service: "telegram-webhook-health",
      configured: false,
      healthy: false,
      error: "bot_not_configured",
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return res.status(502).json({
        ok: false,
        service: "telegram-webhook-health",
        configured: true,
        healthy: false,
        error: "telegram_health_check_failed",
      });
    }

    const result = data.result || {};
    const configured = Boolean(result.url);
    const pendingUpdateCount = Number(result.pending_update_count || 0);
    const lastErrorDate = result.last_error_date || null;
    const healthy = configured && !lastErrorDate;

    return res.status(200).json({
      ok: true,
      service: "telegram-webhook-health",
      configured,
      healthy,
      pendingUpdateCount,
      hasRecentError: Boolean(lastErrorDate),
      lastErrorDate,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      service: "telegram-webhook-health",
      configured: true,
      healthy: false,
      error: "telegram_health_check_failed",
    });
  }
}
