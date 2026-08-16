import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicHandle, scorePublicChannel, trackedPlacementUrl } from "../lib/telegram-intelligence.js";

test("normalizes public Telegram handles without accepting arbitrary paths", () => {
  assert.equal(normalizePublicHandle("https://t.me/cyberhub"), "@cyberhub");
  assert.equal(normalizePublicHandle("@learn_cyber"), "@learn_cyber");
  assert.equal(normalizePublicHandle("bad"), "");
});

test("scores relevant public channel metadata without member identities", () => {
  const result = scorePublicChannel({ title: "Cyber Security Jobs", description: "privacy tools and fraud awareness", memberCount: 12000 });
  assert.ok(result.score >= 50);
  assert.ok(result.keywordMatches.includes("cyber"));
  assert.ok(result.keywordMatches.includes("security"));
});

test("placement links only preserve approved external source codes", () => {
  assert.equal(trackedPlacementUrl("https://example.com", "ext_cyberhub"), "https://example.com/api/start?src=ext_cyberhub");
  assert.equal(trackedPlacementUrl("https://example.com/", "unknown"), "https://example.com/api/start?src=channel_invite");
});
