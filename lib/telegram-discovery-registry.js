const DEFAULT_TARGETS = [
  { handle: "@mycybersecureWealthsolution", source: "owned", permission: "owned", topics: ["cybersecurity", "wealth", "real_estate"] },
];

export function normalizeDiscoveryTarget(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(?:https?:\/\/t\.me\/)?@?([A-Za-z0-9_]{5,32})\/?$/i);
  return match ? `@${match[1]}` : null;
}

export function usTargetSet(value = process.env.TELEGRAM_US_TARGETS || "") {
  return new Set(
    String(value)
      .split(",")
      .map(normalizeDiscoveryTarget)
      .filter(Boolean)
      .map((handle) => handle.toLowerCase()),
  );
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
