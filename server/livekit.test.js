import assert from "node:assert/strict";
import test from "node:test";
import {
  createLiveKitRecordingRequest,
  createLiveKitParticipantToken,
  createLiveRecordingObjectKey,
  getLiveKitConfig,
  isLiveRecordingObjectKey,
} from "./livekit.js";

const config = {
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-secret",
};
const sessionId = "92f5db7a-4cf6-4dca-9bb4-8ca02cbf7bb6";

test("normalizes the LiveKit API host while retaining the browser WebSocket URL", () => {
  assert.deepEqual(getLiveKitConfig(config), {
    publicUrl: "wss://example.livekit.cloud",
    apiHost: "https://example.livekit.cloud",
    apiKey: "test-key",
    apiSecret: "test-secret",
  });
});

test("issues an administrator token with no publish sources", async () => {
  const jwt = await createLiveKitParticipantToken({
    identity: "admin-id",
    name: "Administrator",
    roomName: "tgf-live-test",
    role: "administrator",
  }, config);
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  assert.equal(claims.sub, "admin-id");
  assert.equal(claims.video.room, "tgf-live-test");
  assert.deepEqual(claims.video.canPublishSources, []);
  assert.equal(claims.video.canSubscribe, true);
});

test("keeps a learner microphone permission off the token until host approval", async () => {
  const credentials = {
    identity: "student-id",
    name: "Student",
    roomName: "tgf-live-test",
    role: "learner",
  };
  const createClaims = async (microphoneAllowed) => {
    const jwt = await createLiveKitParticipantToken({
      ...credentials,
      microphoneAllowed,
    }, config);
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  };

  const mutedClaims = await createClaims(false);
  assert.deepEqual(mutedClaims.video.canPublishSources, ["camera"]);

  const allowedClaims = await createClaims(true);
  assert.deepEqual(allowedClaims.video.canPublishSources, ["camera", "microphone"]);
});

test("allows tutors to publish audio, video, and screen shares", async () => {
  const jwt = await createLiveKitParticipantToken({
    identity: "teacher-id",
    name: "Tutor",
    roomName: "tgf-live-test",
    role: "teacher",
  }, config);
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));

  assert.deepEqual(claims.video.canPublishSources, [
    "camera",
    "microphone",
    "screen_share",
    "screen_share_audio",
  ]);
});

test("creates session-scoped MP4 object keys and rejects keys outside the private prefix", () => {
  const key = createLiveRecordingObjectKey(sessionId, {}, 12345);
  assert.equal(key, `tgfvp/live-classes/${sessionId}/12345.mp4`);
  assert.equal(isLiveRecordingObjectKey(key, {}), true);
  assert.equal(isLiveRecordingObjectKey(`tgfvp/live-classes/../${sessionId}/recording.mp4`, {}), false);
  assert.throws(() => createLiveRecordingObjectKey("../wrong", {}, 12345), /valid live-session ID/);
});

test("builds a v2 room recording request targeting the configured private S3 storage", () => {
  const request = createLiveKitRecordingRequest(
    "tgf-live-test",
    `tgfvp/live-classes/${sessionId}/12345.mp4`,
    {
      ...config,
      LIVE_RECORDING_S3_BUCKET: "private-recordings",
      LIVE_RECORDING_S3_REGION: "auto",
      LIVE_RECORDING_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      LIVE_RECORDING_S3_ACCESS_KEY: "storage-key",
      LIVE_RECORDING_S3_SECRET: "storage-secret",
    },
  );

  assert.equal(request.roomName, "tgf-live-test");
  assert.equal(request.source.case, "template");
  assert.equal(request.source.value.layout, "speaker");
  assert.equal(request.outputs[0].config.case, "file");
  assert.equal(request.outputs[0].config.value.filepath, `tgfvp/live-classes/${sessionId}/12345.mp4`);
  assert.equal(request.storage.provider.case, "s3");
  assert.equal(request.storage.provider.value.bucket, "private-recordings");
  assert.equal(request.storage.provider.value.forcePathStyle, true);
});

test("requires valid LiveKit URLs and credentials", () => {
  assert.throws(() => getLiveKitConfig({ ...config, LIVEKIT_URL: "https://example.livekit.cloud" }), /ws:\/\/ or wss:\/\//);
  assert.throws(() => getLiveKitConfig({ ...config, LIVEKIT_API_SECRET: "" }), /LIVEKIT_API_SECRET is required/);
});
