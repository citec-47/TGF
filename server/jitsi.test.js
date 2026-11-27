import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { createJitsiJoinConfig } from "./jitsi.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const env = {
  JITSI_DOMAIN: "8x8.vc",
  JITSI_APP_ID: "test-app",
  JITSI_KID: "test-key-id",
  JITSI_PRIVATE_KEY: privateKey,
};

function decodeToken(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const signedContent = `${encodedHeader}.${encodedPayload}`;
  assert.equal(verify(
    "RSA-SHA256",
    Buffer.from(signedContent),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  ), true);
  return { header, payload };
}

test("JaaS tokens are room-scoped, short-lived, and grant moderator only to the tutor", () => {
  const now = 1_700_000_000_000;
  const tutor = createJitsiJoinConfig({
    userId: "tutor-id",
    name: "Tutor",
    email: "tutor@example.test",
    role: "teacher",
    roomName: "tgf-live-room-uuid",
  }, env, now);
  const student = createJitsiJoinConfig({
    userId: "student-id",
    name: "Student",
    role: "learner",
    roomName: "tgf-live-room-uuid",
  }, env, now);
  const { header, payload } = decodeToken(tutor.token);
  const { payload: studentPayload } = decodeToken(student.token);

  assert.deepEqual(header, { alg: "RS256", typ: "JWT", kid: "test-key-id" });
  assert.equal(tutor.domain, "8x8.vc");
  assert.equal(tutor.roomName, "test-app/tgf-live-room-uuid");
  assert.equal(payload.aud, "jitsi");
  assert.equal(payload.iss, "chat");
  assert.equal(payload.sub, "test-app");
  assert.equal(payload.room, "tgf-live-room-uuid");
  assert.equal(payload.context.user.moderator, "true");
  assert.equal(studentPayload.context.user.moderator, "false");
  assert.equal(payload.exp - payload.nbf, 910);
  assert.equal(payload.context.features.recording, "false");
});

test("JaaS token creation rejects non-classroom roles, wildcard rooms, and missing secrets", () => {
  const participant = {
    userId: "student-id",
    name: "Student",
    role: "learner",
    roomName: "*",
  };
  assert.throws(() => createJitsiJoinConfig({ ...participant, role: "administrator" }, env), /Only the assigned tutor/);
  assert.throws(() => createJitsiJoinConfig(participant, env), /details are invalid/);
  assert.throws(() => createJitsiJoinConfig({
    ...participant,
    roomName: "room-id",
  }, { ...env, JITSI_PRIVATE_KEY: "" }), /JITSI_PRIVATE_KEY is required/);
});

test("JaaS configuration rejects non-HTTPS domains", () => {
  assert.throws(() => createJitsiJoinConfig({
    userId: "student-id",
    name: "Student",
    role: "learner",
    roomName: "room-id",
  }, { ...env, JITSI_DOMAIN: "http://8x8.vc" }), /HTTPS hostname/);
});
