import { inspectPublicChannel, trackedPlacementUrl } from "../lib/telegram-intelligence.js";
import { discoveryRegistry, mergeCandidateTargets } from "../lib/telegram-discovery-registry.js";

const SOURCE_CODES = ["ext_irishfutures","ext_learncyber","ext_cyberhub","ext_100xsecurity","ext_cybermind","ext_jobsregion","ext_jobsnigeria","ext_lagosrealestate","ext_telega","ext_telegramads"];

function requestCandidates(req) {
  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const url = new URL(req.url || "/api/telegram-discovery", origin);
  return (url.searchParams.get("targets") || "").split(",").map((v) => v.trim()).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const origin = `https://${req.headers.host || "mygemassistcontentbot.vercel.app"}`;
  const registry = mergeCandidateTargets(requestCandidates(req), discoveryRegistry());
  const inspected = await Promise.all(registry.slice(0, 10).map(async (target) => ({
    ...target,
    intelligence: await inspectPublicChannel(target.handle),
  })));
  const ranked = inspected.sort((a, b) => (b.intelligence?.score || 0) - (a.intelligence?.score || 0));

  return res.status(200).json({
    ok: true,
    service: "gemassist-telegram-discovery",
    mode: "public-channel-opportunity-registry",
    generatedAt: new Date().toISOString(),
    safety: {
      publicChannelMetadataOnly: true,
      memberIdentityCollection: false,
      unsolicitedPrivateMessaging: false,
      unauthorizedPosting: false,
      placementPermissionRequired: true,
    },
    summary: { registered: registry.length, inspected: inspected.length, resolved: inspected.filter((x) => x.intelligence?.ok).length },
    opportunities: ranked,
    placementLinks: Object.fromEntries(SOURCE_CODES.map((code) => [code, trackedPlacementUrl(origin, code)])),
    workflow: ["collect_public_handle", "deduplicate", "inspect_public_metadata", "rank_relevance", "review_admin_contact_route", "obtain_permission", "publish_tracked_placement", "measure_bot_start_and_opt_in"],
  });
}
