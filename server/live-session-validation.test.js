import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeLiveSessionJoin,
  canInitiallyPublish,
  isJoinWindowOpen,
} from "./live-session-validation.js";

const MINUTE = 60 * 1000;

test("opens the join window exactly 15 minutes before start and closes after class end", () => {
  const start = Date.UTC(2026, 3, 6, 9);
  const end = start + 60 * MINUTE;

  assert.equal(isJoinWindowOpen(start - 15 * MINUTE, start, end), true);
  assert.equal(isJoinWindowOpen(start - 15 * MINUTE - 1, start, end), false);
  assert.equal(isJoinWindowOpen(start, start, end), true);
  assert.equal(isJoinWindowOpen(end, start, end), true);
  assert.equal(isJoinWindowOpen(end + 1, start, end), false);
});

test("denies a learner who is not enrolled and only allows the assigned teacher to host", () => {
  assert.deepEqual(authorizeLiveSessionJoin({
    role: "learner",
    userId: "learner-id",
    teacherId: "teacher-id",
    enrolled: false,
  }), { allowed: false, role: null, status: 403 });
  assert.equal(authorizeLiveSessionJoin({
    role: "teacher",
    userId: "other-teacher",
    teacherId: "assigned-teacher",
    enrolled: true,
  }).status, 403);
  assert.equal(authorizeLiveSessionJoin({
    role: "learner",
    userId: "learner-id",
    teacherId: "teacher-id",
    enrolled: true,
  }).allowed, true);
});

test("denies enrolled learners who were not invited to an instant live class", () => {
  assert.deepEqual(authorizeLiveSessionJoin({
    role: "learner",
    userId: "learner-id",
    teacherId: "teacher-id",
    enrolled: true,
    invited: false,
  }), { allowed: false, role: null, status: 403 });
});

test("learners and teachers can publish while administrators cannot", () => {
  assert.equal(canInitiallyPublish("learner"), true);
  assert.equal(canInitiallyPublish("teacher"), true);
  assert.equal(canInitiallyPublish("administrator"), false);
});
