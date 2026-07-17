import { isGrowthStoreConfigured } from "../lib/growth-store.js";

function channelTargetConfigured() {
  if (process.env.CHANNEL_ID) return true;
  try {
    const url = new URL(process.env.CHANNEL_URL || "https://t.me/mycybersecureWealthsolution");
    const slug = url.pathname.split("/").filter(Boolean).at(-1) || "";
    return Boolean(slug && !slug.startsWith("+"));
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);
  const setupKeyConfigured = Boolean(process.env.SETUP_KEY);
  const storeConfigured = isGrowthStoreConfigured();
  const channelConfigured = channelTargetConfigured();
  const botConfigured = Boolean(process.env.BOT_TOKEN);
  const automaticChannelPublishingReady = botConfigured && channelConfigured && cronSecretConfigured;
  const onboardingFollowupsReady = automaticChannelPublishingReady && storeConfigured;

  return res.status(200).json({
    ok: true,
    service: "GemAssist Opt-in Growth Engine",
    version: "5.0.1",
    mode: "consent-based",
    botConfigured,
    channelTargetConfigured: channelConfigured,
    cronSecretConfigured,
    setupKeyConfigured,
    growthStoreConfigured: storeConfigured,
    automaticChannelPublishingReady,
    onboardingFollowupsReady,
    referralLinksReady: botConfigured,
    unsubscribeControlsReady: true,
    scheduleUtc: "14:00 daily",
    blockers: [
      ...(!cronSecretConfigured ? ["CRON_SECRET"] : []),
      ...(!storeConfigured ? ["GROWTH_STORE_URL"] : []),
    ],
  });
}
