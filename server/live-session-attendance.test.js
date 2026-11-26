import assert from "node:assert/strict";
import test from "node:test";
import {
  listLiveSessionAttendees,
  markLiveSessionParticipantJoined,
  markLiveSessionParticipantLeft,
} from "./live-session-attendance.js";

test("records an authorized student joining the session", async () => {
  let query;
  const pool = {
    async query(...args) {
      query = args;
      return { rowCount: 1 };
    },
  };

  await markLiveSessionParticipantJoined(pool, "session-id", "student-id");

  assert.match(query[0], /INSERT INTO tgf_live_session_attendance/);
  assert.match(query[0], /participant_role/);
  assert.match(query[0], /'learner'/);
  assert.match(query[0], /ON CONFLICT \(session_id, user_id\)/);
  assert.deepEqual(query[1], ["session-id", "student-id"]);
});

test("reports when a join cannot be recorded", async () => {
  const pool = { async query() { return { rowCount: 0 }; } };

  await assert.rejects(
    markLiveSessionParticipantJoined(pool, "session-id", "student-id"),
    /Student attendance could not be recorded/,
  );
});

test("closes a student's attendance interval on disconnect", async () => {
  let query;
  const pool = {
    async query(...args) {
      query = args;
      return { rowCount: 1 };
    },
  };

  await markLiveSessionParticipantLeft(pool, "session-id", "student-id");

  assert.match(query[0], /current_joined_at = NULL, last_left_at = NOW\(\)/);
  assert.deepEqual(query[1], ["session-id", "student-id"]);
});

test("returns attendee history with API-ready timestamps and durations", async () => {
  const pool = {
    async query() {
      return {
        rows: [{
          user_id: "student-id",
          participant_role: "learner",
          microphone_allowed: false,
          full_name: "Student Example",
          first_joined_at: "2025-01-02T03:04:05.000Z",
          attendance_seconds: 125,
        }],
      };
    },
  };

  assert.deepEqual(await listLiveSessionAttendees(pool, "session-id"), [{
    id: "student-id",
    name: "Student Example",
    role: "learner",
    microphoneAllowed: false,
    firstJoinedAt: "2025-01-02T03:04:05.000Z",
    attendanceSeconds: 125,
  }]);
});
