import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventKey,
  parseWebhookEvent,
  validateWebhookChallenge,
} from "../webhook-validation.ts";

test("validateWebhookChallenge returns challenge on valid subscription", () => {
  const result = validateWebhookChallenge(
    { mode: "subscribe", challenge: "abc123", verifyToken: "secret" },
    "secret"
  );
  assert.equal(result, "abc123");
});

test("validateWebhookChallenge rejects wrong mode", () => {
  assert.equal(
    validateWebhookChallenge(
      { mode: "unsubscribe", challenge: "abc", verifyToken: "secret" },
      "secret"
    ),
    null
  );
});

test("validateWebhookChallenge rejects missing challenge", () => {
  assert.equal(
    validateWebhookChallenge({ mode: "subscribe", verifyToken: "secret" }, "secret"),
    null
  );
});

test("validateWebhookChallenge rejects mismatched verify token", () => {
  assert.equal(
    validateWebhookChallenge(
      { mode: "subscribe", challenge: "abc", verifyToken: "wrong" },
      "secret"
    ),
    null
  );
});

test("validateWebhookChallenge rejects when no expected token configured", () => {
  assert.equal(
    validateWebhookChallenge(
      { mode: "subscribe", challenge: "abc", verifyToken: "" },
      ""
    ),
    null
  );
});

const validEvent = {
  object_type: "activity",
  object_id: 1234,
  aspect_type: "create",
  owner_id: 99,
  subscription_id: 7,
  event_time: 1_700_000_000,
};

test("parseWebhookEvent accepts a well-formed payload", () => {
  const parsed = parseWebhookEvent(validEvent);
  assert.deepEqual(parsed, { ...validEvent, updates: undefined });
});

test("parseWebhookEvent preserves updates object", () => {
  const parsed = parseWebhookEvent({
    ...validEvent,
    aspect_type: "update",
    updates: { title: "New name" },
  });
  assert.deepEqual(parsed?.updates, { title: "New name" });
});

test("parseWebhookEvent rejects non-object bodies", () => {
  assert.equal(parseWebhookEvent(null), null);
  assert.equal(parseWebhookEvent("nope"), null);
  assert.equal(parseWebhookEvent(42), null);
});

test("parseWebhookEvent rejects missing required fields", () => {
  const { object_id, ...rest } = validEvent;
  void object_id;
  assert.equal(parseWebhookEvent(rest), null);
});

test("parseWebhookEvent rejects wrong field types", () => {
  assert.equal(parseWebhookEvent({ ...validEvent, object_id: "1234" }), null);
  assert.equal(parseWebhookEvent({ ...validEvent, event_time: "now" }), null);
});

test("buildEventKey is deterministic and unique per aspect/time", () => {
  assert.equal(buildEventKey(validEvent), "activity:1234:create:1700000000");
  assert.notEqual(
    buildEventKey(validEvent),
    buildEventKey({ ...validEvent, aspect_type: "update" })
  );
});
