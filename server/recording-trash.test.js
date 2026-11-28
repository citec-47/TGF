import assert from "node:assert/strict";
import test from "node:test";
import {
  deletePrivateRecordingAssets,
  permanentlyDeleteFailedRecording,
  permanentlyDeleteRecordingFromTrash,
  restoreRecordingFromTrash,
} from "./recording-trash.js";

const sessionId = "bb77777d-4c1a-4a2d-b0e6-107b686c275d";

test("deletes each unique authenticated video asset and accepts already-removed assets", async () => {
  const deleted = [];
  const configured = [];
  const client = {
    config: (options) => configured.push(options),
    uploader: {
      destroy: async (publicId, options) => {
        deleted.push({ publicId, options });
        return { result: publicId === "missing-part" ? "not found" : "ok" };
      },
    },
  };

  await deletePrivateRecordingAssets(
    ["legacy-video", "part-one", "part-one", "missing-part"],
    {
      client,
      cloudName: "test-cloud",
      apiKey: "test-key",
      apiSecret: "test-secret",
    },
  );

  assert.equal(configured.length, 1);
  assert.deepEqual(deleted.map((asset) => asset.publicId), [
    "legacy-video",
    "part-one",
    "missing-part",
  ]);
  assert.ok(deleted.every(({ options }) =>
    options.resource_type === "video" && options.type === "authenticated" && options.invalidate,
  ));
});

test("permanent deletion removes video metadata but preserves the class session", async () => {
  const statements = [];
  const deletedAssets = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("SELECT session.id")) {
        return {
          rows: [{
            id: sessionId,
            recording_status: "ready",
            recording_url: "",
            cloudinary_public_id: "",
            title: "Software Engineering · Nov 24, 2026",
          }],
        };
      }
      if (sql.includes("SELECT part.cloudinary_public_id")) {
        return {
          rows: [
            { cloudinary_public_id: "part-one", secure_url: "https://media/one" },
            { cloudinary_public_id: "part-two", secure_url: "https://media/two" },
          ],
        };
      }
      return { rows: [] };
    },
    release() {},
  };

  const result = await permanentlyDeleteRecordingFromTrash(
    { connect: async () => client },
    sessionId,
    async (publicIds) => deletedAssets.push(...publicIds),
  );

  assert.deepEqual(deletedAssets, ["part-one", "part-two"]);
  assert.equal(result.title, "Software Engineering · Nov 24, 2026");
  assert.ok(statements.some((sql) => sql.includes("DELETE FROM tgf_live_recordings")));
  assert.ok(statements.some((sql) => sql.includes("recording_deleted_at = NULL")));
  assert.ok(!statements.some((sql) => /^\s*DELETE FROM tgf_live_sessions/i.test(sql)));
});

test("permanently deletes failed recording assets from both dashboards", async () => {
  const statements = [];
  const deletedAssets = [];
  const pool = {
    async connect() {
      return {
        async query(sql) {
          statements.push(sql);
          if (sql.includes("SELECT session.id, session.recording_status")) {
            return {
              rows: [{
                id: sessionId,
                recording_status: "failed",
                recording_url: "",
                cloudinary_public_id: "legacy-video",
                teacher_id: "teacher-id",
                title: "Software Engineering · Nov 24, 2026",
              }],
            };
          }
          if (sql.includes("SELECT part.cloudinary_public_id")) {
            return {
              rows: [{ cloudinary_public_id: "partial-video", secure_url: "" }],
            };
          }
          if (sql.includes("SELECT id") && sql.includes("recording_purge_started_at IS NOT NULL")) {
            return { rows: [{ id: sessionId }] };
          }
          return { rows: [] };
        },
        release() {},
      };
    },
  };

  const result = await permanentlyDeleteFailedRecording(
    pool,
    sessionId,
    async (publicIds) => deletedAssets.push(...publicIds),
  );

  assert.deepEqual(deletedAssets, ["legacy-video", "partial-video"]);
  assert.deepEqual(result, {
    id: sessionId,
    title: "Software Engineering · Nov 24, 2026",
    teacherId: "teacher-id",
  });
  assert.ok(statements.some((sql) => sql.includes("DELETE FROM tgf_live_recordings")));
  assert.ok(statements.some((sql) => sql.includes("recording_hidden_from_admin_at")));
  assert.ok(statements.some((sql) => sql.includes("recording_hidden_from_teacher_at")));
  assert.ok(!statements.some((sql) => /^\s*DELETE FROM tgf_live_sessions/i.test(sql)));
});

test("keeps failed permanent deletions in Trash and prevents restore", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("SELECT session.id")) {
        return {
          rows: [{
            id: sessionId,
            recording_status: "ready",
            recording_url: "https://media/legacy",
            cloudinary_public_id: "legacy-video",
            title: "Software Engineering · Nov 24, 2026",
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };

  await assert.rejects(
    permanentlyDeleteRecordingFromTrash(
      { connect: async () => client },
      sessionId,
      async () => {
        throw new Error("storage unavailable");
      },
    ),
    /storage unavailable/,
  );
  assert.ok(statements.includes("COMMIT"));
  assert.ok(statements.some((sql) => sql.includes("recording_purge_started_at = COALESCE")));
  assert.ok(!statements.includes("ROLLBACK"));
  assert.ok(!statements.some((sql) => sql.includes("DELETE FROM tgf_live_recordings")));
});

test("restore is refused after the 30-day retention window", async () => {
  let query = "";
  const restored = await restoreRecordingFromTrash({
    async query(sql) {
      query = sql;
      return { rows: [] };
    },
  }, sessionId);

  assert.equal(restored, null);
  assert.match(query, /recording_deleted_at > NOW\(\) - INTERVAL '30 days'/);
  assert.match(query, /recording_purge_started_at IS NULL/);
});
