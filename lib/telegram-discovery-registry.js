const DEFAULT_TARGETS = [
  { handle: "@mycybersecureWealthsolution", source: "owned", permission: "owned", topics: ["cybersecurity", "wealth", "real_estate"] },
];

export function normalizeDiscoveryTarget(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(?:https?:\/\/t\.me\/)?@?([A-Za-z0-9_]{5,32})\/?$/i);
  return match ? `@${match[1]}` : null;
}

export function discoveryRegistry(extra = process.env.TELEGRAM_DISCOVERY_TARGETS || "") {
  const configured = String(extra).split(",").map(normalizeDiscoveryTarget).filter(Boolean);
  const map = new Map(DEFAULT_TARGETS.map((item) => [item.handle.toLowerCase(), item]));
  for (const handle of configured) {
    const key = handle.toLowerCase();
    if (!map.has(key)) map.set(key, { handle, source: "configured_public_target", permission: "permission_required", topics: [] });
  }
  return [...map.values()];
}

export function mergeCandidateTargets(rawTargets = [], registry = discoveryRegistry()) {
  const map = new Map(registry.map((item) => [item.handle.toLowerCase(), item]));
  for (const raw of rawTargets) {
    const handle = normalizeDiscoveryTarget(raw);
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (!map.has(key)) map.set(key, { handle, source: "request_public_target", permission: "permission_required", topics: [] });
  }
  return [...map.values()].slice(0, 50);
}
