import { createHmac, timingSafeEqual } from "node:crypto";

const USER_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const LIVE_CLASS_SOCKET_TICKET_TTL_SECONDS = 120;

function isLiveClassIdentity(value) {
  return value === "super-admin" || USER_ID_PATTERN.test(value || "");
}

export function createLiveClassSocketTicket({ userId, sessionId, secret, now = Date.now() }) {
  if (!secret) throw new Error("SESSION_SECRET is required to issue live-class socket tickets.");
  if (!isLiveClassIdentity(userId) || !USER_ID_PATTERN.test(sessionId || "")) {
    throw new Error("A valid user and live-class session are required for a socket ticket.");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    purpose: "live-class-socket",
    userId,
    sessionId,
    issuedAt,
    expiresAt: issuedAt + LIVE_CLASS_SOCKET_TICKET_TTL_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readLiveClassSocketTicket(token, {
  secret,
  sessionId,
  now = Date.now(),
} = {}) {
  if (!secret || typeof token !== "string" || token.length > 2048) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length ||
      !/^[A-Za-z0-9_-]+$/.test(payload) ||
      !/^[A-Za-z0-9_-]+$/.test(signature)) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const nowSeconds = Math.floor(now / 1000);
    if (ticket.purpose !== "live-class-socket" ||
        !isLiveClassIdentity(ticket.userId) ||
        !USER_ID_PATTERN.test(ticket.sessionId || "") ||
        !Number.isInteger(ticket.issuedAt) ||
        !Number.isInteger(ticket.expiresAt) ||
        ticket.issuedAt > nowSeconds + 30 ||
        ticket.expiresAt <= nowSeconds ||
        ticket.expiresAt - ticket.issuedAt > LIVE_CLASS_SOCKET_TICKET_TTL_SECONDS ||
        (sessionId && ticket.sessionId !== sessionId)) {
      return null;
    }
    return { userId: ticket.userId, sessionId: ticket.sessionId };
  } catch {
    return null;
  }
}

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
  return authenticateLiveClassUser(session.userId, pool);
}

export async function authenticateLiveClassUser(userId, pool) {
  if (userId === "super-admin") {
    return {
      id: userId,
      full_name: "TGF Group Main Administrator",
      email: "",
      role: "administrator",
    };
  }
  if (!USER_ID_PATTERN.test(userId || "")) return null;

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
    [userId],
  );
  return result.rows[0] || null;
}
