import { isGrowthStoreConfigured } from "../lib/growth-store.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    service: "GemAssist Opt-in Growth Engine",
    version: "5.0.0",
    mode: "consent-based",
    automaticChannelPublishing: true,
    onboardingFollowups: isGrowthStoreConfigured(),
    referralLinks: true,
    unsubscribeControls: true,
    growthStoreConfigured: isGrowthStoreConfigured(),
    scheduleUtc: "14:00 daily",
  });
}
