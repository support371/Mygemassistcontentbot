import assert from "node:assert/strict";
import test from "node:test";
import { installRunFinalizer } from "../api/automation-entry.js";

test("finalizes the run before ending the HTTP response", async () => {
  const events = [];
  const res = {
    end(...args) {
      events.push(["end", ...args]);
      return this;
    },
  };

  const finalizer = installRunFinalizer(res, async () => {
    events.push(["finalize-start"]);
    await Promise.resolve();
    events.push(["finalize-complete"]);
  });

  const returned = res.end("payload");
  assert.equal(returned, res);
  assert.deepEqual(events, []);

  await finalizer.wait();
  assert.deepEqual(events, [
    ["finalize-start"],
    ["finalize-complete"],
    ["end", "payload"],
  ]);
});

test("suppresses duplicate response endings and finalizes once", async () => {
  let finalizations = 0;
  let endings = 0;
  const res = {
    end() {
      endings += 1;
      return this;
    },
  };

  const finalizer = installRunFinalizer(res, async () => {
    finalizations += 1;
  });

  res.end("first");
  res.end("second");
  await finalizer.wait();

  assert.equal(finalizations, 1);
  assert.equal(endings, 1);
});

test("still ends the response when finalization fails", async () => {
  let ended = false;
  const originalError = console.error;
  console.error = () => {};
  const res = {
    end() {
      ended = true;
      return this;
    },
  };

  try {
    const finalizer = installRunFinalizer(res, async () => {
      throw new Error("storage unavailable");
    });

    res.end();
    await finalizer.wait();
    assert.equal(ended, true);
  } finally {
    console.error = originalError;
  }
});
