import test from "node:test";
import assert from "node:assert/strict";
import {
  canShowLiveClassChatEmail,
  isLiveClassChatMessageId,
  normalizeLiveClassChatBody,
} from "./live-session-chat.js";

test("live-class chat validates message IDs and normalized body length", () => {
  assert.equal(isLiveClassChatMessageId("f9fc0d95-5ec0-4b79-a617-52debf6ca4d1"), true);
  assert.equal(isLiveClassChatMessageId("not-a-uuid"), false);
  assert.equal(normalizeLiveClassChatBody("  Hello class  "), "Hello class");
  assert.equal(normalizeLiveClassChatBody(" \n "), null);
  assert.equal(normalizeLiveClassChatBody("x".repeat(2001)), null);
});

test("student email is private by default and visible to staff and the sender", () => {
  assert.equal(canShowLiveClassChatEmail({
    viewerId: "student-2",
    viewerRole: "learner",
    senderId: "student-1",
  }), false);
  assert.equal(canShowLiveClassChatEmail({
    viewerId: "student-1",
    viewerRole: "learner",
    senderId: "student-1",
  }), true);
  assert.equal(canShowLiveClassChatEmail({
    viewerId: "teacher-1",
    viewerRole: "teacher",
    senderId: "student-1",
  }), true);
  assert.equal(canShowLiveClassChatEmail({
    viewerId: "student-2",
    viewerRole: "learner",
    senderId: "student-1",
    showAllEmails: true,
  }), true);
});
