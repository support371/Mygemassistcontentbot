const DEFAULT_TARGETS = [
  { handle: "@mycybersecureWealthsolution", source: "owned", permission: "owned", topics: ["cybersecurity", "wealth", "real_estate"] },
  {
    handle: "@legalized_Cybersecure_digital_id",
    source: "owned",
    permission: "owned",
    topics: ["cybersecurity", "digital_identity", "security"],
    sourceCode: "channel_invite",
    country: "US",
    verification: {
      method: "owner_confirmation",
      evidence: "Repository owner confirmed control of the channel and that it is USA-based.",
      verifiedAt: "2026-08-19",
    },
    ownedValidationTarget: true,
  },
  {
    handle: "@wisestepjobs",
    source: "verified_us_public_target",
    permission: "permission_required",
    topics: ["jobs", "cybersecurity", "technology"],
    sourceCode: "ext_jobsregion",
    country: "US",
    verification: {
      method: "public_telegram_feed",
      evidence: "Telegram public feed is titled USA Jobs and consistently publishes United States job locations.",
      verifiedAt: "2026-08-17",
    },
  },
];

const BUILTIN_US_TARGETS = new Set(
  DEFAULT_TARGETS
    .filter((target) => target.country === "US")
    .map((target) => target.handle.toLowerCase()),
);

export function normalizeDiscoveryTarget(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(?:https?:\/\/t\.me\/)?@?([A-Za-z0-9_]{5,32})\/?$/i);
  return match ? `@${match[1]}` : null;
}

export function usTargetSet(value = process.env.TELEGRAM_US_TARGETS || "") {
  const configured = String(value)
    .split(",")
    .map(normalizeDiscoveryTarget)
    .filter(Boolean)
    .map((handle) => handle.toLowerCase());
  return new Set([...BUILTIN_US_TARGETS, ...configured]);
}

export function applyUsPlacementPolicy(target, allowedUsTargets = usTargetSet()) {
  const handle = normalizeDiscoveryTarget(target?.handle);
  const owned = target?.source === "owned" || target?.permission === "owned";
  const confirmedUs = Boolean(handle && allowedUsTargets.has(handle.toLowerCase()));
  return {
    ...target,
    countryPolicy: owned ? "owned_not_external" : confirmedUs ? "US_confirmed" : "blocked_unconfirmed_US",
    externalPlacementEligible: !owned && confirmedUs,
  };
}

export function discoveryRegistry(extra = process.env.TELEGRAM_DISCOVERY_TARGETS || "", usTargets = process.env.TELEGRAM_US_TARGETS || "") {
  const configured = String(extra).split(",").map(normalizeDiscoveryTarget).filter(Boolean);
  const allowedUsTargets = usTargetSet(usTargets);
  const map = new Map(DEFAULT_TARGETS.map((item) => [item.handle.toLowerCase(), item]));
  for (const handle of configured) {
    const key = handle.toLowerCase();
    if (!map.has(key)) map.set(key, { handle, source: "configured_public_target", permission: "permission_required", topics: [] });
  }
  return [...map.values()].map((target) => applyUsPlacementPolicy(target, allowedUsTargets));
}

export function mergeCandidateTargets(rawTargets = [], registry = discoveryRegistry(), usTargets = process.env.TELEGRAM_US_TARGETS || "") {
  const allowedUsTargets = usTargetSet(usTargets);
  const map = new Map(registry.map((item) => [item.handle.toLowerCase(), applyUsPlacementPolicy(item, allowedUsTargets)]));
  for (const raw of rawTargets) {
    const handle = normalizeDiscoveryTarget(raw);
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (!map.has(key)) {
      map.set(key, applyUsPlacementPolicy({ handle, source: "request_public_target", permission: "permission_required", topics: [] }, allowedUsTargets));
    }
  }
  return [...map.values()].slice(0, 50);
}
