import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { authenticateLiveClassCookie, readLiveClassSession } from "./live-class-auth.js";

const userId = "10e2151e-5547-4e31-b86f-d06dd5f6b6f9";

function signedCookie(session, secret = "test-session-secret") {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `tgf_admin_session=${payload}.${signature}`;
}

test("validates the existing signed cookie and rejects tampered or expired sessions", () => {
  const session = { type: "user", userId, expiresAt: Math.floor(Date.now() / 1000) + 60 };
  assert.deepEqual(readLiveClassSession(signedCookie(session), { secret: "test-session-secret" }), {
    userId,
    role: null,
  });
  assert.equal(readLiveClassSession(`${signedCookie(session)}x`, { secret: "test-session-secret" }), null);
  assert.equal(readLiveClassSession(signedCookie({ ...session, expiresAt: 1 }), { secret: "test-session-secret" }), null);
  assert.equal(readLiveClassSession(signedCookie(session), { secret: "" }), null);
});

test("uses the secure host cookie name in production", () => {
  const session = { type: "super_admin", expiresAt: Math.floor(Date.now() / 1000) + 60 };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", "secret").update(payload).digest("base64url");
  assert.equal(
    readLiveClassSession(`__Host-tgf_admin_session=${payload}.${signature}`, {
      secret: "secret",
      production: true,
    }).role,
    "administrator",
  );
});

test("loads only active, approved-to-sign-in accounts from the existing user table", async () => {
  const pool = {
    query: async (sql, params) => {
      assert.match(sql, /account_status = 'active'/);
      assert.match(sql, /is_frozen = FALSE/);
      assert.match(sql, /must_change_password = FALSE/);
      assert.match(sql, /to_jsonb\(tgf_users\)->>'profile_photo_url'/);
      assert.deepEqual(params, [userId]);
      return { rows: [{ id: userId, role: "learner" }] };
    },
  };
  const user = await authenticateLiveClassCookie(
    signedCookie({ type: "user", userId, expiresAt: Math.floor(Date.now() / 1000) + 60 }),
    pool,
    { secret: "test-session-secret" },
  );
  assert.equal(user.role, "learner");
});
