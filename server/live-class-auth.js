import { createHmac, timingSafeEqual } from "node:crypto";

const USER_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function readLiveClassSession(cookieHeader, {
  secret,
  production = process.env.NODE_ENV === "production",
} = {}) {
  if (!secret) return null;
  const cookieName = production ? "__Host-tgf_admin_session" : "tgf_admin_session";
  const cookie = (cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;

  const [payload, signature, ...rest] = cookie.slice(cookieName.length + 1).split(".");
  if (!payload || !signature || rest.length) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(session.expiresAt) || session.expiresAt <= Date.now() / 1000) return null;
    if (session.type === "super_admin") return { userId: "super-admin", role: "administrator" };
    if (session.type !== "user" || !USER_ID_PATTERN.test(session.userId || "")) return null;
    return { userId: session.userId, role: null };
  } catch {
    return null;
  }
}

export async function authenticateLiveClassCookie(cookieHeader, pool, options = {}) {
  const session = readLiveClassSession(cookieHeader, options);
  if (!session) return null;
  if (session.userId === "super-admin") {
    return {
      id: session.userId,
      full_name: "TGF Group Main Administrator",
      email: "",
      role: "administrator",
    };
  }

  const result = await pool.query(
    `SELECT id, full_name, email, role,
            COALESCE(
              NULLIF(to_jsonb(tgf_users)->>'profile_photo_url', ''),
              NULLIF(to_jsonb(tgf_users)->>'teacher_profile_photo_url', ''),
              ''
            ) AS profile_photo_url
     FROM tgf_users
     WHERE id = $1 AND account_status = 'active'
       AND is_frozen = FALSE AND must_change_password = FALSE`,
    [session.userId],
  );
  return result.rows[0] || null;
}
