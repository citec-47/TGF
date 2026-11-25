import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeLiveClassAccess,
  getLiveClassConfig,
  isLiveClassUuid,
} from "./live-class-validation.js";

test("authorizes only the assigned teacher, enrolled learners and admins", () => {
  assert.deepEqual(authorizeLiveClassAccess({
    role: "teacher",
    userId: "teacher-1",
    teacherId: "teacher-1",
  }), { allowed: true, role: "teacher" });
  assert.equal(authorizeLiveClassAccess({
    role: "teacher",
    userId: "teacher-2",
    teacherId: "teacher-1",
  }).allowed, false);
  assert.equal(authorizeLiveClassAccess({
    role: "learner",
    enrolled: true,
    invited: false,
    scheduled: false,
  }).allowed, true);
  assert.deepEqual(authorizeLiveClassAccess({
    role: "learner",
    enrolled: true,
    invited: true,
  }), { allowed: true, role: "student" });
  assert.equal(authorizeLiveClassAccess({ role: "administrator" }).allowed, true);
});

test("validates UUIDs and the configured class, TURN, and recording limits", () => {
  assert.equal(isLiveClassUuid("10e2151e-5547-4e31-b86f-d06dd5f6b6f9"), true);
  assert.equal(isLiveClassUuid("../invalid"), false);
  const config = getLiveClassConfig({
    LIVE_CLASS_MAX_STUDENTS: "16",
    RECORDING_PART_MINUTES: "15",
    MEDIASOUP_MIN_PORT: "40000",
    MEDIASOUP_MAX_PORT: "49999",
    TURN_URL: "turn:turn.example.test:3478",
    TURN_USERNAME: "student",
    TURN_CREDENTIAL: "credential",
  });
  assert.equal(config.maxStudents, 16);
  assert.equal(config.iceServers[0].urls, "turn:turn.example.test:3478");
  assert.throws(() => getLiveClassConfig({ LIVE_CLASS_MAX_STUDENTS: "17" }), /between 1 and 16/);
  assert.throws(() => getLiveClassConfig({ RECORDING_PART_MINUTES: "0" }), /RECORDING_PART_MINUTES/);
});
