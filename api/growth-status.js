import { growthStoreStatus, isGrowthStoreConfigured } from "../lib/growth-store.js";

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const botConfigured = Boolean(process.env.BOT_TOKEN);
  const channelConfigured = channelTargetConfigured();
  const storeConfigured = isGrowthStoreConfigured();
  const store = storeConfigured ? await growthStoreStatus() : { ok: false, ready: false };
  const storageReady = Boolean(store.ok && store.ready);
  const automaticChannelPublishingReady = botConfigured && channelConfigured && storageReady;
  const onboardingFollowupsReady = automaticChannelPublishingReady;

  return res.status(200).json({
    ok: true,
    service: "GemAssist Opt-in Growth Engine",
    version: "5.1.0",
    mode: "consent-based",
    botConfigured,
    channelTargetConfigured: channelConfigured,
    growthStoreConfigured: storeConfigured,
    growthStoreReady: storageReady,
    automaticChannelPublishingReady,
    onboardingFollowupsReady,
    referralLinksReady: botConfigured,
    unsubscribeControlsReady: true,
    scheduleUtc: "14:00 daily",
    storageProvider: "Supabase",
    blockers: [
      ...(!botConfigured ? ["BOT_TOKEN"] : []),
      ...(!channelConfigured ? ["CHANNEL_TARGET"] : []),
      ...(!storageReady ? ["SUPABASE_GROWTH_STORE"] : []),
    ],
  });
}
