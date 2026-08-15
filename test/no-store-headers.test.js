import test from "node:test";
import assert from "node:assert/strict";

import growthStatus from "../api/growth-status.js";
import channelMembers from "../api/channel-members.js";

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: 200,
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
  };
}

test("growth status responses are explicitly non-cacheable", async () => {
  const res = mockResponse();
  await growthStatus({ method: "POST" }, res);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.statusCode, 405);
});

test("channel member responses are explicitly non-cacheable", async () => {
  const res = mockResponse();
  await channelMembers({ method: "POST" }, res);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.statusCode, 405);
});
