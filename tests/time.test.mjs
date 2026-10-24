import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWallTime, resolveWallTime } from "../src/time.ts";

test("company timezone scheduling round-trips independently of the browser timezone", () => {
  assert.equal(resolveWallTime("2026-10-21T09:30", "Asia/Karachi"), "2026-10-21T04:30:00.000Z");
  assert.equal(resolveWallTime("2026-10-21T00:00", "UTC"), "2026-10-21T00:00:00.000Z");
  assert.equal(resolveWallTime("2026-10-21T09:30", "Asia/Kathmandu"), "2026-10-21T03:45:00.000Z");
  assert.equal(formatWallTime(new Date("2026-10-21T04:30:00Z"), "Asia/Karachi"), "2026-10-21T09:30");
});

test("nonexistent, repeated, and invalid calendar times cannot silently change a schedule", () => {
  assert.throws(() => resolveWallTime("2026-03-08T02:30", "America/New_York"), /invalid.*clock change/);
  assert.throws(() => resolveWallTime("2026-11-01T01:30", "America/New_York"), /occurs twice/);
  assert.throws(() => resolveWallTime("2026-04-05T01:45", "Australia/Lord_Howe"), /occurs twice/);
  assert.throws(() => resolveWallTime("2026-10-04T02:15", "Australia/Lord_Howe"), /invalid.*clock change/);
  assert.throws(() => resolveWallTime("2026-02-30T09:00", "UTC"), /valid date/);
  assert.throws(() => resolveWallTime("", "UTC"), /valid date/);
});
