import { inspectPublicChannel, trackedPlacementUrl } from "../lib/telegram-intelligence.js";

const SOURCE_CODES = [
  "ext_irishfutures", "ext_learncyber", "ext_cyberhub", "ext_100xsecurity", "ext_cybermind",
  "ext_jobsregion", "ext_jobsnigeria", "ext_lagosrealestate", "ext_telega", "ext_telegramads"
];

function requestedTargets(req) {
  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const url = new URL(req.url || "/api/telegram-intelligence", origin);
  const raw = url.searchParams.get("targets") || process.env.TELEGRAM_DISCOVERY_TARGETS || "@mycybersecureWealthsolution";
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const targets = requestedTargets(req);
  const channels = await Promise.all(targets.map((target) => inspectPublicChannel(target)));
  const successful = channels.filter((item) => item.ok).sort((a, b) => b.score - a.score);

  return res.status(200).json({
    ok: true,
    service: "gemassist-telegram-intelligence",
    mode: "public-channel-metadata-only",
    generatedAt: new Date().toISOString(),
    safety: {
      memberIdentityCollection: false,
      unsolicitedPrivateMessaging: false,
      unauthorizedPosting: false,
      placementPermissionRequired: true,
    },
    summary: {
      requested: targets.length,
      resolved: successful.length,
      highestScore: successful[0]?.score || 0,
    },
    channels,
    placementLinks: Object.fromEntries(SOURCE_CODES.map((code) => [code, trackedPlacementUrl(origin, code)])),
    nextAction: successful.length
      ? "Review highest-scoring public channels, contact administrators through their published contact route, and use the matching tracked placement link only after permission."
      : "Add public Telegram handles with ?targets=@channel1,@channel2 or configure TELEGRAM_DISCOVERY_TARGETS.",
  });
}
