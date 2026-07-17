import { growthStore, growthStoreStatus } from "../lib/growth-store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const [status, analytics] = await Promise.all([
    growthStoreStatus(),
    growthStore("analytics"),
  ]);

  const ok = status.ok === true && status.ready === true && analytics.ok === true;
  return res.status(ok ? 200 : 503).json({
    ok,
    service: "GemAssist Growth Store Self-Test",
    storage: {
      ready: Boolean(status.ready),
      provider: "Supabase",
      version: status.version || null,
    },
    signatureValidation: analytics.ok === true,
    counts: analytics.ok ? {
      subscribers: analytics.subscribers?.total || 0,
      referrals: analytics.referrals || 0,
      channelPosts: analytics.channel_posts || 0,
    } : null,
    error: analytics.ok ? null : analytics.error || status.error || "Self-test failed",
  });
}
