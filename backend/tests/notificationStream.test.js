/**
 * Per-user notification socket events.
 *
 * Run: node --test backend/tests/notificationStream.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loaderUrl = pathToFileURL(
  path.join(__dirname, "fixtures", "prismaLoader.mjs"),
).href;
register(loaderUrl, import.meta.url);

const { userRoom, buildUserEvent } = await import("../lib/socketHub.js");
const { createNotificationsForUsers } = await import(
  "../lib/createNotification.js"
);

test("userRoom scopes a socket room to one user", () => {
  assert.equal(userRoom("abc"), "user:abc");
});

test("buildUserEvent includes the user, event name, and data", () => {
  assert.deepEqual(buildUserEvent("u1", "notification:new", { a: 1 }), {
    userId: "u1",
    event: "notification:new",
    data: { a: 1 },
  });
  assert.deepEqual(buildUserEvent("u1", "notification:new"), {
    userId: "u1",
    event: "notification:new",
    data: {},
  });
});

test("createNotificationsForUsers publishes once per unique recipient", async () => {
  const published = [];
  const result = await createNotificationsForUsers(
    ["a", "b", "a", "", null],
    { kind: "ADMIN_MESSAGE", title: "Hi", body: "There" },
    (event) => {
      published.push(event);
    },
  );

  assert.equal(result.count, 2);
  assert.deepEqual(
    published.map((event) => event.userId),
    ["a", "b"],
  );
  assert.ok(published.every((event) => event.event === "notification:new"));
});

test("createNotificationsForUsers publishes nothing when there are no recipients", async () => {
  let calls = 0;
  const result = await createNotificationsForUsers(
    ["", null],
    { kind: "ADMIN_MESSAGE", title: "Hi", body: "There" },
    () => {
      calls += 1;
    },
  );

  assert.equal(result.count, 0);
  assert.equal(calls, 0);
});
