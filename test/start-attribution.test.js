import test from "node:test";
import assert from "node:assert/strict";

import startHandler, { approvedStartSource } from "../api/start.js";

const APPROVED = [
  "channel_wealth_20260719",
  "channel_tools_20260720",
  "channel_security_20260721",
  "channel_invite",
  "ext_irishfutures",
  "ext_learncyber",
  "ext_cyberhub",
  "ext_100xsecurity",
  "ext_cybermind",
  "ext_jobsregion",
  "ext_jobsnigeria",
  "ext_lagosrealestate",
  "ext_telega",
  "ext_telegramads",
];

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    location: "",
    body: undefined,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(code, location) {
      this.statusCode = code;
      this.location = location;
      return this;
    },
    headers,
  };
}

test("approved acquisition sources survive the website-to-bot redirect", async () => {
  const previous = process.env.BOT_USERNAME;
  process.env.BOT_USERNAME = "Gemassistbuilder_Bot";
  try {
    for (const source of APPROVED) {
      assert.equal(approvedStartSource({ src: source }), source);
      const res = mockResponse();
      await startHandler({ query: { src: source } }, res);
      assert.equal(res.statusCode, 302);
      assert.equal(res.location, `https://t.me/Gemassistbuilder_Bot?start=${source}`);
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
  } finally {
    if (previous === undefined) delete process.env.BOT_USERNAME;
    else process.env.BOT_USERNAME = previous;
  }
});

test("unknown or malformed acquisition sources fail closed to website attribution", () => {
  assert.equal(approvedStartSource({ src: "unknown_campaign" }), "website");
  assert.equal(approvedStartSource({ src: "https://example.com" }), "website");
  assert.equal(approvedStartSource({}), "website");
});

test("source query alias is supported for approved tracked links", () => {
  assert.equal(approvedStartSource({ source: "ext_telegramads" }), "ext_telegramads");
});
