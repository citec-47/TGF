import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalConversationUsers,
  validateDashboardTheme,
  validateWeeklyTimetable,
} from "./collaboration-validation.js";

test("validates ordered weekday intervals and accepts separate intervals", () => {
  const result = validateWeeklyTimetable({
    timezone: "Africa/Douala",
    slots: [
      { weekday: 1, startsAt: "10:00", endsAt: "12:00" },
      { weekday: 3, startsAt: "09:00", endsAt: "10:30" },
      { weekday: 3, startsAt: "15:00", endsAt: "17:00" },
    ],
  });
  assert.equal(result.timetable.slots.length, 3);
  assert.equal(result.timetable.slots[0].weekday, 1);
});

test("rejects overlapping intervals, invalid times, and unknown time zones", () => {
  assert.match(validateWeeklyTimetable({
    slots: [
      { weekday: 2, startsAt: "09:00", endsAt: "12:00" },
      { weekday: 2, startsAt: "11:30", endsAt: "13:00" },
    ],
  }).error, /overlap/);
  assert.equal(validateWeeklyTimetable({
    slots: [{ weekday: 6, startsAt: "09:00", endsAt: "10:00" }],
  }).timetable.slots[0].weekday, 6);
  assert.equal(validateWeeklyTimetable({
    slots: [{ weekday: 7, startsAt: "09:00", endsAt: "10:00" }],
  }).timetable.slots[0].weekday, 7);
  assert.ok(validateWeeklyTimetable({
    slots: [{ weekday: 8, startsAt: "09:00", endsAt: "10:00" }],
  }).error);
  assert.ok(validateWeeklyTimetable({
    slots: [{ weekday: 1, startsAt: "9:00", endsAt: "10:00" }],
  }).error);
  assert.ok(validateWeeklyTimetable({
    timezone: "Not/A_Timezone",
    slots: [{ weekday: 1, startsAt: "09:00", endsAt: "10:00" }],
  }).error);
});

test("accepts light and dark dashboard themes and rejects invalid values", () => {
  assert.deepEqual(validateDashboardTheme("light"), { theme: "light" });
  assert.deepEqual(validateDashboardTheme("dark"), { theme: "dark" });
  assert.ok(validateDashboardTheme("#241f1b").error);
  assert.ok(validateDashboardTheme("automatic").error);
});

test("canonicalizes a distinct user pair consistently", () => {
  assert.deepEqual(canonicalConversationUsers("b", "a"), ["a", "b"]);
  assert.equal(canonicalConversationUsers("same", "same"), null);
});
