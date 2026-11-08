import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { createCloudinarySignature, validateLocation } from "../../../api/location-validation.js";
import {
  generateTemporaryPassword,
  hashPassword,
  validateAccount,
  verifyPassword,
} from "../../../api/account-security.js";
import {
  SITE_SETTING_DEFAULTS,
  validateSiteSettings,
} from "../../../api/site-settings.js";
import {
  getBoardGroups,
  validateBoardMember,
  validateLiveClass,
  validateModule,
  validateProgramme,
  validateWhiteboardStrokes,
} from "../../../api/learning-validation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LocationRow {
  id: string;
  city: string;
  region: string;
  address: string;
  description: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

interface Session {
  expiresAt: number;
  nonce: string;
  type: "super_admin" | "user";
  userId?: string;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  subsidiary: string;
  is_frozen: boolean;
  must_change_password: boolean;
  created_at: Date;
}

interface UserSessionRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  subsidiary: string;
  is_frozen: boolean;
  must_change_password: boolean;
}

interface BoardMemberRow {
  id: string;
  full_name: string;
  position_title: string;
  hierarchy_group: string;
  biography: string;
  photo_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ProgrammeRow {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface ModuleRow {
  id: string;
  programme_id: string;
  programme_title?: string;
  title: string;
  description: string;
  lesson_content: string;
  meeting_url: string;
  position: number;
  is_released: boolean;
  completed?: boolean;
}

interface LiveClassRow {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  module_id: string;
  module_title?: string;
  programme_title?: string;
  title: string;
  starts_at: Date;
  meeting_url: string;
}

interface LoginAttempt {
  count: number;
  resetAt: number;
}

interface LocationInput {
  city: string;
  region: string;
  address: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const globalForPg = globalThis as typeof globalThis & { tgfPool?: Pool };
const pool =
  globalForPg.tgfPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
  });
if (process.env.NODE_ENV !== "production") globalForPg.tgfPool = pool;
pool.on("error", (error: Error & { code?: string }) => {
  console.error(`An idle database connection failed (error code: ${error.code ?? "unexpected"}).`);
});

const sessionLifetimeSeconds = 12 * 60 * 60;
const bodyLimitBytes = 32 * 1024;
const loginWindowMilliseconds = 15 * 60 * 1000;
const maximumLoginAttempts = 10;
const sessionCookie =
  process.env.NODE_ENV === "production" ? "__Host-tgf_admin_session" : "tgf_admin_session";
const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";
const loginPassword = process.env.ADMIN_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || "";
const passwordSalt = loginPassword ? randomBytes(16) : Buffer.alloc(16);
const expectedPasswordHash = loginPassword
  ? scryptSync(loginPassword, passwordSalt, 64)
  : Buffer.alloc(64);
const loginAttempts = new Map<string, LoginAttempt>();
const registrationAttempts = new Map<string, LoginAttempt>();
let schemaReady: Promise<void> | null = null;

function jsonResponse(
  status: number,
  value: object,
  additionalHeaders: HeadersInit = {},
): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...additionalHeaders,
    },
  });
}

function safeLogFailure(operation: string, error: unknown): void {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "unexpected")
      : "unexpected";
  console.error(`${operation} failed (error code: ${code}).`);
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = import("node:fs/promises")
      .then(async ({ readdir }) => {
        const migrationDirectory = path.join(process.cwd(), "db", "migrations");
        const migrations = (await readdir(migrationDirectory))
          .filter((name) => /^\d+_.+\.sql$/.test(name))
          .sort((left, right) => left.localeCompare(right));
        if (migrations.length === 0) throw new Error("No database migrations were found.");
        for (const migrationName of migrations) {
          const migration = await readFile(path.join(migrationDirectory, migrationName), "utf8");
          await pool.query(migration);
        }
      })
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

function sessionSignature(payload: string): string {
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function makeSessionCookie(token: string, maxAge: number): string {
  return `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie}`;
}

function issueSession(type: Session["type"], userId?: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      expiresAt: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds,
      nonce: randomBytes(16).toString("base64url"),
      type,
      ...(userId ? { userId } : {}),
    } satisfies Session),
  ).toString("base64url");
  return `${payload}.${sessionSignature(payload)}`;
}

function readSession(request: Request): Session | null {
  if (!sessionSecret) return null;
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`));
  if (!cookie) return null;

  const [payload, signature, ...rest] = cookie.slice(sessionCookie.length + 1).split(".");
  if (!payload || !signature || rest.length !== 0) return null;

  const expected = Buffer.from(sessionSignature(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (
      Number.isInteger(session.expiresAt) &&
      session.expiresAt > Date.now() / 1000 &&
      (session.type === "super_admin" ||
        (session.type === "user" &&
          typeof session.userId === "string" &&
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(session.userId)))
    ) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

async function getAccountForSession(request: Request): Promise<UserSessionRow | null> {
  const session = readSession(request);
  if (!session) return null;
  if (session.type === "super_admin") {
    return {
      id: "super-admin",
      full_name: "TGF Group Main Administrator",
      email: "Main administrator",
      role: "administrator",
      subsidiary: "central_administration",
      is_frozen: false,
      must_change_password: false,
    };
  }
  await ensureSchema();
  const result = await pool.query<UserSessionRow>(
    `SELECT id, full_name, email, role, subsidiary, is_frozen, must_change_password
     FROM tgf_users WHERE id = $1`,
    [session.userId],
  );
  const user = result.rows[0];
  return user && !user.is_frozen ? user : null;
}

async function requireAdministrator(request: Request): Promise<UserSessionRow | null> {
  const account = await getAccountForSession(request);
  return account?.role === "administrator" && !account.must_change_password ? account : null;
}

async function requireTeacher(request: Request): Promise<UserSessionRow | null> {
  const account = await getAccountForSession(request);
  return account &&
    !account.must_change_password &&
    (account.role === "teacher" || account.role === "administrator")
    ? account
    : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsedOrigin = new URL(origin);
    return (
      (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:") &&
      parsedOrigin.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

function isRateLimited(request: Request): boolean {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const existing = loginAttempts.get(address);
  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(address, { count: 0, resetAt: now + loginWindowMilliseconds });
    return false;
  }
  return existing.count >= maximumLoginAttempts;
}

function recordFailedLogin(request: Request): void {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const existing = loginAttempts.get(address);
  if (existing) existing.count += 1;
}

function consumeRateLimit(bucket: Map<string, LoginAttempt>, request: Request, limit: number): boolean {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const existing = bucket.get(address);
  if (!existing || existing.resetAt <= now) {
    bucket.set(address, { count: 1, resetAt: now + loginWindowMilliseconds });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    throw Object.assign(new Error("A JSON request body is required."), { status: 415 });
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > bodyLimitBytes) {
    throw Object.assign(new Error("The request is too large."), { status: 413 });
  }
  try {
    const value: unknown = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("Enter valid form details and try again."), { status: 400 });
  }
}

function serializeLocation(row: LocationRow) {
  return {
    id: row.id,
    city: row.city,
    region: row.region,
    address: row.address,
    description: row.description,
    imageUrl: row.image_url,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function validatedBody(body: Record<string, unknown>) {
  const result = validateLocation(body, process.env.CLOUDINARY_CLOUD_NAME);
  if (result.error) return { error: result.error };
  return { location: result.location as LocationInput };
}

function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.CLOUDINARY_UPLOAD_PRESET,
  );
}

function serializeUser(user: UserRow) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    subsidiary: user.subsidiary,
    isFrozen: user.is_frozen,
    mustChangePassword: user.must_change_password,
    createdAt: user.created_at,
  };
}

async function getSiteSettings(): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM tgf_site_settings",
    );
    const settings: {
      resumptionDate: string;
      resumptionLabel: string;
      accentColor: string;
      flyerImageUrl: string;
    } = { ...SITE_SETTING_DEFAULTS };
    for (const row of result.rows) {
      if (row.key === "resumption_date") settings.resumptionDate = row.value;
      if (row.key === "resumption_label") settings.resumptionLabel = row.value;
      if (row.key === "accent_color") settings.accentColor = row.value;
      if (row.key === "flyer_image_url") settings.flyerImageUrl = row.value;
    }
    return jsonResponse(200, settings);
  } catch (error) {
    safeLogFailure("Website settings lookup", error);
    return jsonResponse(503, { error: "Website settings are temporarily unavailable." });
  }
}

async function updateSiteSettings(request: Request, userId: string): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateSiteSettings(body, process.env.CLOUDINARY_CLOUD_NAME);
    if (validation.error || !validation.settings) {
      return jsonResponse(400, { error: validation.error || "Enter valid website settings." });
    }
    const values: Record<string, string> = {
      resumption_date: validation.settings.resumptionDate,
      resumption_label: validation.settings.resumptionLabel,
      accent_color: validation.settings.accentColor,
      flyer_image_url: validation.settings.flyerImageUrl,
    };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [key, value] of Object.entries(values)) {
        await client.query(
          `INSERT INTO tgf_site_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
          [key, value, userId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return jsonResponse(200, validation.settings);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: unknown }).status)
        : 0;
    if (status) {
      return jsonResponse(status, {
        error: error instanceof Error ? error.message : "The website settings are invalid.",
      });
    }
    safeLogFailure("Website settings update", error);
    return jsonResponse(503, { error: "Website settings could not be saved." });
  }
}

async function listUsers(): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<UserRow>(
      `SELECT id, full_name, email, password_hash, role, subsidiary,
              is_frozen, must_change_password, created_at
       FROM tgf_users ORDER BY lower(full_name), lower(email)`,
    );
    return jsonResponse(200, result.rows.map(serializeUser));
  } catch (error) {
    safeLogFailure("Account list", error);
    return jsonResponse(503, { error: "Accounts are temporarily unavailable." });
  }
}

async function createUser(request: Request): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateAccount(body);
    if (validation.error || !validation.account) {
      return jsonResponse(400, { error: validation.error || "Enter valid account details." });
    }
    const temporaryPassword = generateTemporaryPassword();
    const result = await pool.query<UserRow>(
      `INSERT INTO tgf_users
         (full_name, email, password_hash, role, subsidiary, is_frozen, must_change_password)
       VALUES ($1, $2, $3, $4, $5, FALSE, TRUE)
       RETURNING id, full_name, email, password_hash, role, subsidiary,
                 is_frozen, must_change_password, created_at`,
      [
        validation.account.fullName,
        validation.account.email,
        hashPassword(temporaryPassword),
        validation.account.role,
        validation.account.subsidiary,
      ],
    );
    return jsonResponse(201, {
      user: serializeUser(result.rows[0]),
      temporaryPassword,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (String((error as { code: unknown }).code) === "23505") {
        return jsonResponse(409, { error: "An account already uses this email address." });
      }
    }
    if (error && typeof error === "object" && "status" in error) {
      const status = Number((error as { status: unknown }).status);
      if (status) {
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "Check the account details and try again.",
        });
      }
    }
    safeLogFailure("Account creation", error);
    return jsonResponse(503, { error: "The account could not be created." });
  }
}

async function updateUser(request: Request, id: string): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateAccount(body);
    if (validation.error || !validation.account) {
      return jsonResponse(400, { error: validation.error || "Enter valid account details." });
    }
    if (typeof body.isFrozen !== "boolean") {
      return jsonResponse(400, { error: "Choose whether this account should be frozen." });
    }
    const resetPassword = body.resetPassword === true;
    const temporaryPassword = resetPassword ? generateTemporaryPassword() : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(917321, 1)");
      const current = await client.query<{ role: string; is_frozen: boolean }>(
        "SELECT role, is_frozen FROM tgf_users WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return jsonResponse(404, { error: "This account no longer exists." });
      }
      const shouldDeactivateAdmin =
        current.rows[0].role === "administrator" &&
        !current.rows[0].is_frozen &&
        (validation.account.role !== "administrator" || body.isFrozen);
      if (shouldDeactivateAdmin) {
        const admins = await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM tgf_users WHERE role = 'administrator' AND is_frozen = FALSE",
        );
        if (Number(admins.rows[0].count) <= 1) {
          await client.query("ROLLBACK");
          return jsonResponse(409, {
            error: "The last active administrator cannot be frozen or demoted.",
          });
        }
      }
      const result = await client.query<UserRow>(
        `UPDATE tgf_users
         SET full_name = $2, email = $3, role = $4, subsidiary = $5, is_frozen = $6,
             password_hash = COALESCE($7, password_hash),
             must_change_password = CASE WHEN $8 THEN TRUE ELSE must_change_password END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, full_name, email, password_hash, role, subsidiary,
                   is_frozen, must_change_password, created_at`,
        [
          id,
          validation.account.fullName,
          validation.account.email,
          validation.account.role,
          validation.account.subsidiary,
          body.isFrozen,
          temporaryPassword ? hashPassword(temporaryPassword) : null,
          resetPassword,
        ],
      );
      await client.query("COMMIT");
      return jsonResponse(200, {
        user: serializeUser(result.rows[0]),
        ...(temporaryPassword ? { temporaryPassword } : {}),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (String((error as { code: unknown }).code) === "23505") {
        return jsonResponse(409, { error: "An account already uses this email address." });
      }
    }
    if (error && typeof error === "object" && "status" in error) {
      const status = Number((error as { status: unknown }).status);
      if (status) {
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "Check the account details and try again.",
        });
      }
    }
    safeLogFailure("Account update", error);
    return jsonResponse(503, { error: "The account could not be updated." });
  }
}

async function deleteUser(id: string): Promise<Response> {
  try {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(917321, 1)");
      const current = await client.query<{ role: string; is_frozen: boolean }>(
        "SELECT role, is_frozen FROM tgf_users WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return jsonResponse(404, { error: "This account no longer exists." });
      }
      if (current.rows[0].role === "administrator" && !current.rows[0].is_frozen) {
        const admins = await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM tgf_users WHERE role = 'administrator' AND is_frozen = FALSE",
        );
        if (Number(admins.rows[0].count) <= 1) {
          await client.query("ROLLBACK");
          return jsonResponse(409, { error: "The last active administrator cannot be deleted." });
        }
      }
      await client.query("DELETE FROM tgf_users WHERE id = $1", [id]);
      await client.query("COMMIT");
      return jsonResponse(200, { deleted: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    safeLogFailure("Account deletion", error);
    return jsonResponse(503, { error: "The account could not be deleted." });
  }
}

function serializeBoardMember(member: BoardMemberRow) {
  return {
    id: member.id,
    fullName: member.full_name,
    positionTitle: member.position_title,
    hierarchyGroup: member.hierarchy_group,
    biography: member.biography,
    photoUrl: member.photo_url,
    sortOrder: member.sort_order,
    isActive: member.is_active,
  };
}

function serializeProgramme(programme: ProgrammeRow) {
  return {
    id: programme.id,
    title: programme.title,
    description: programme.description,
    sortOrder: programme.sort_order,
    isActive: programme.is_active,
  };
}

function serializeModule(module: ModuleRow, includeLesson = true) {
  return {
    id: module.id,
    programmeId: module.programme_id,
    programmeTitle: module.programme_title,
    title: module.title,
    description: module.description,
    position: module.position,
    isReleased: module.is_released,
    ...(includeLesson
      ? {
          lessonContent: module.lesson_content,
          meetingUrl: module.meeting_url,
        }
      : {}),
  };
}

function serializeLiveClass(liveClass: LiveClassRow) {
  return {
    id: liveClass.id,
    moduleId: liveClass.module_id,
    moduleTitle: liveClass.module_title,
    programmeTitle: liveClass.programme_title,
    title: liveClass.title,
    startsAt: liveClass.starts_at,
    meetingUrl: liveClass.meeting_url,
    teacherName: liveClass.teacher_name,
  };
}

async function listBoardMembers(admin = false): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<BoardMemberRow>(
      `SELECT id, full_name, position_title, hierarchy_group, biography,
              photo_url, sort_order, is_active
       FROM tgf_board_members
       ${admin ? "" : "WHERE is_active = TRUE"}
       ORDER BY CASE hierarchy_group
          WHEN 'Board of Directors' THEN 1
          WHEN 'Executive Leadership' THEN 2
          WHEN 'Directors' THEN 3
          WHEN 'Subsidiary Management' THEN 4
          WHEN 'Supervisory Functions' THEN 5
          ELSE 6
        END, sort_order ASC, lower(full_name) ASC`,
    );
    return jsonResponse(
      200,
      admin
        ? { groups: getBoardGroups(), members: result.rows.map(serializeBoardMember) }
        : result.rows.map(serializeBoardMember),
    );
  } catch (error) {
    safeLogFailure("Board directory lookup", error);
    return jsonResponse(503, { error: "Board profiles are temporarily unavailable." });
  }
}

async function saveBoardMember(request: Request, id?: string): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateBoardMember(body, process.env.CLOUDINARY_CLOUD_NAME);
    if (validation.error || !validation.member) {
      return jsonResponse(400, { error: validation.error || "Enter valid board-member details." });
    }
    const member = validation.member;
    const result = id
      ? await pool.query<BoardMemberRow>(
          `UPDATE tgf_board_members
           SET full_name = $2, position_title = $3, hierarchy_group = $4, biography = $5,
               photo_url = $6, sort_order = $7, is_active = $8, updated_at = NOW()
           WHERE id = $1
           RETURNING id, full_name, position_title, hierarchy_group, biography,
                     photo_url, sort_order, is_active`,
          [
            id,
            member.fullName,
            member.positionTitle,
            member.hierarchyGroup,
            member.biography,
            member.photoUrl,
            member.sortOrder,
            member.isActive,
          ],
        )
      : await pool.query<BoardMemberRow>(
          `INSERT INTO tgf_board_members
             (full_name, position_title, hierarchy_group, biography, photo_url, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, full_name, position_title, hierarchy_group, biography,
                     photo_url, sort_order, is_active`,
          [
            member.fullName,
            member.positionTitle,
            member.hierarchyGroup,
            member.biography,
            member.photoUrl,
            member.sortOrder,
            member.isActive,
          ],
        );
    if (!result.rows[0]) return jsonResponse(404, { error: "This profile no longer exists." });
    return jsonResponse(id ? 200 : 201, serializeBoardMember(result.rows[0]));
  } catch (error) {
    safeLogFailure("Board profile save", error);
    return jsonResponse(503, { error: "The board profile could not be saved." });
  }
}

async function deleteBoardMember(id: string): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query(
      "DELETE FROM tgf_board_members WHERE id = $1 RETURNING id",
      [id],
    );
    return result.rowCount
      ? jsonResponse(200, { deleted: true })
      : jsonResponse(404, { error: "This profile no longer exists." });
  } catch (error) {
    safeLogFailure("Board profile deletion", error);
    return jsonResponse(503, { error: "The board profile could not be deleted." });
  }
}

async function listProgrammes(admin = false): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<ProgrammeRow>(
      `SELECT id, title, description, sort_order, is_active
       FROM tgf_programmes
       ${admin ? "" : "WHERE is_active = TRUE"}
       ORDER BY sort_order ASC, lower(title) ASC`,
    );
    return jsonResponse(200, result.rows.map(serializeProgramme));
  } catch (error) {
    safeLogFailure("Programme list", error);
    return jsonResponse(503, { error: "Programmes are temporarily unavailable." });
  }
}

async function saveProgramme(request: Request, id?: string): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateProgramme(body);
    if (validation.error || !validation.programme) {
      return jsonResponse(400, { error: validation.error || "Enter valid programme details." });
    }
    const programme = validation.programme;
    const result = id
      ? await pool.query<ProgrammeRow>(
          `UPDATE tgf_programmes SET title = $2, description = $3, sort_order = $4,
             is_active = $5, updated_at = NOW()
           WHERE id = $1
           RETURNING id, title, description, sort_order, is_active`,
          [id, programme.title, programme.description, programme.sortOrder, programme.isActive],
        )
      : await pool.query<ProgrammeRow>(
          `INSERT INTO tgf_programmes (title, description, sort_order, is_active)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, description, sort_order, is_active`,
          [programme.title, programme.description, programme.sortOrder, programme.isActive],
        );
    if (!result.rows[0]) return jsonResponse(404, { error: "This programme no longer exists." });
    return jsonResponse(id ? 200 : 201, serializeProgramme(result.rows[0]));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (String((error as { code: unknown }).code) === "23505") {
        return jsonResponse(409, { error: "A programme with this title already exists." });
      }
    }
    safeLogFailure("Programme save", error);
    return jsonResponse(503, { error: "The programme could not be saved." });
  }
}

async function listProgrammeModules(programmeId: string): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<ModuleRow>(
      `SELECT id, programme_id, title, description, lesson_content, meeting_url,
              position, is_released
       FROM tgf_modules WHERE programme_id = $1
       ORDER BY position ASC`,
      [programmeId],
    );
    return jsonResponse(200, result.rows.map((module) => serializeModule(module)));
  } catch (error) {
    safeLogFailure("Programme modules lookup", error);
    return jsonResponse(503, { error: "Programme modules are temporarily unavailable." });
  }
}

async function saveModule(
  request: Request,
  programmeId: string | undefined,
  id?: string,
): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateModule(body);
    if (validation.error || !validation.module) {
      return jsonResponse(400, { error: validation.error || "Enter valid module details." });
    }
    if (!id && !programmeId) {
      return jsonResponse(400, { error: "Choose the programme for this module." });
    }
    const module = validation.module;
    const result = id
      ? await pool.query<ModuleRow>(
          `UPDATE tgf_modules SET title = $2, description = $3, lesson_content = $4,
             meeting_url = $5, position = $6, is_released = $7, updated_at = NOW()
           WHERE id = $1 AND ($8::uuid IS NULL OR programme_id = $8)
           RETURNING id, programme_id, title, description, lesson_content, meeting_url,
                     position, is_released`,
          [
            id,
            module.title,
            module.description,
            module.lessonContent,
            module.meetingUrl,
            module.position,
            module.isReleased,
            programmeId || null,
          ],
        )
      : await pool.query<ModuleRow>(
          `INSERT INTO tgf_modules
             (programme_id, title, description, lesson_content, meeting_url, position, is_released)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, programme_id, title, description, lesson_content, meeting_url,
                     position, is_released`,
          [
            programmeId,
            module.title,
            module.description,
            module.lessonContent,
            module.meetingUrl,
            module.position,
            module.isReleased,
          ],
        );
    if (!result.rows[0]) return jsonResponse(404, { error: "This module no longer exists." });
    return jsonResponse(id ? 200 : 201, serializeModule(result.rows[0]));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (String((error as { code: unknown }).code) === "23505") {
        return jsonResponse(409, { error: "A module already uses this position." });
      }
    }
    safeLogFailure("Module save", error);
    return jsonResponse(503, { error: "The module could not be saved." });
  }
}

async function registerLearner(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return jsonResponse(403, { error: "This request must come from the TGFVP website." });
  }
  if (!sessionSecret) {
    return jsonResponse(503, { error: "Secure sign-in is not configured on the server." });
  }
  if (!consumeRateLimit(registrationAttempts, request, 6)) {
    return jsonResponse(429, { error: "Too many registration attempts. Try again in 15 minutes." });
  }
  try {
    await ensureSchema();
    const body = await readJson(request);
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (fullName.length < 2 || fullName.length > 120) {
      return jsonResponse(400, { error: "Enter your full name (2 to 120 characters)." });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: "Enter a valid email address." });
    }
    if (password.length < 14 || password.length > 1024) {
      return jsonResponse(400, { error: "Choose a password with at least 14 characters." });
    }
    const result = await pool.query<{ id: string }>(
      `INSERT INTO tgf_users
         (full_name, email, password_hash, role, subsidiary, is_frozen, must_change_password)
       VALUES ($1, $2, $3, 'learner', 'tgfvp', FALSE, FALSE)
       RETURNING id`,
      [fullName, email, hashPassword(password)],
    );
    const id = result.rows[0].id;
    return jsonResponse(
      201,
      { registered: true, redirectTo: "/student" },
      { "Set-Cookie": makeSessionCookie(issueSession("user", id), sessionLifetimeSeconds) },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (String((error as { code: unknown }).code) === "23505") {
        return jsonResponse(409, { error: "An account already uses this email address. Sign in instead." });
      }
    }
    if (error && typeof error === "object" && "status" in error) {
      const status = Number((error as { status: unknown }).status);
      if (status) {
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "Check your details and try again.",
        });
      }
    }
    safeLogFailure("Learner registration", error);
    return jsonResponse(503, { error: "Registration is temporarily unavailable." });
  }
}

async function listStudentCourses(userId: string): Promise<Response> {
  try {
    await ensureSchema();
    const [programmeResult, enrolledResult] = await Promise.all([
      pool.query<(ProgrammeRow & { enrolled: boolean })>(
        `SELECT p.id, p.title, p.description, p.sort_order, p.is_active,
                (e.user_id IS NOT NULL) AS enrolled
         FROM tgf_programmes p
         LEFT JOIN tgf_enrollments e ON e.programme_id = p.id AND e.user_id = $1
         WHERE p.is_active = TRUE ORDER BY p.sort_order, lower(p.title)`,
        [userId],
      ),
      pool.query<{ programme_id: string }>(
        "SELECT programme_id FROM tgf_enrollments WHERE user_id = $1",
        [userId],
      ),
    ]);
    const enrolledIds = new Set(enrolledResult.rows.map((row) => row.programme_id));
    const programmes = await Promise.all(
      programmeResult.rows.map(async (programme) => {
        if (!enrolledIds.has(programme.id)) {
          return {
            ...serializeProgramme(programme),
            enrolled: false,
            modules: [],
          };
        }
        const [moduleResult, classResult] = await Promise.all([
          pool.query<ModuleRow>(
            `SELECT m.id, m.programme_id, m.title, m.description, m.lesson_content,
                    m.meeting_url, m.position, m.is_released,
                    (c.id IS NOT NULL) AS completed
             FROM tgf_modules m
             LEFT JOIN tgf_module_completions c
               ON c.module_id = m.id AND c.user_id = $2
             WHERE m.programme_id = $1 ORDER BY m.position`,
            [programme.id, userId],
          ),
          pool.query<LiveClassRow>(
            `SELECT l.id, l.teacher_id, t.full_name AS teacher_name, l.module_id,
                    m.title AS module_title, p.title AS programme_title,
                    l.title, l.starts_at, l.meeting_url
             FROM tgf_live_classes l
             JOIN tgf_modules m ON m.id = l.module_id
             JOIN tgf_programmes p ON p.id = m.programme_id
             JOIN tgf_users t ON t.id = l.teacher_id
             WHERE p.id = $1 AND l.is_active = TRUE AND l.starts_at >= NOW() - INTERVAL '2 hours'
             ORDER BY l.starts_at LIMIT 50`,
            [programme.id],
          ),
        ]);
        let earlierModulesCompleted = true;
        const modules = moduleResult.rows.map((module) => {
          const completed = Boolean(module.completed);
          const isUnlocked = module.is_released && earlierModulesCompleted;
          earlierModulesCompleted = earlierModulesCompleted && completed;
          return {
            ...serializeModule(module, isUnlocked),
            completed,
            isUnlocked,
          };
        });
        const unlockedModules = new Set(
          modules.filter((module) => module.isUnlocked).map((module) => module.id),
        );
        return {
          ...serializeProgramme(programme),
          enrolled: true,
          modules,
          liveClasses: classResult.rows
            .filter((liveClass) => unlockedModules.has(liveClass.module_id))
            .map(serializeLiveClass),
        };
      }),
    );
    return jsonResponse(200, programmes);
  } catch (error) {
    safeLogFailure("Student course lookup", error);
    return jsonResponse(503, { error: "Your courses are temporarily unavailable." });
  }
}

async function enrollStudent(request: Request, userId: string): Promise<Response> {
  try {
    const body = await readJson(request);
    const programmeId = typeof body.programmeId === "string" ? body.programmeId : "";
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(programmeId)) {
      return jsonResponse(400, { error: "Choose a valid programme to enroll in." });
    }
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO tgf_enrollments (user_id, programme_id)
       SELECT $1, id FROM tgf_programmes WHERE id = $2 AND is_active = TRUE
       ON CONFLICT (user_id, programme_id) DO NOTHING
       RETURNING id`,
      [userId, programmeId],
    );
    let alreadyEnrolled = Boolean(result.rowCount);
    if (!alreadyEnrolled) {
      const existing = await pool.query(
        "SELECT 1 FROM tgf_enrollments WHERE user_id = $1 AND programme_id = $2",
        [userId, programmeId],
      );
      alreadyEnrolled = Boolean(existing.rowCount);
    }
    return alreadyEnrolled
      ? jsonResponse(200, { enrolled: true })
      : jsonResponse(404, { error: "This programme is not open for enrollment." });
  } catch (error) {
    safeLogFailure("Student enrollment", error);
    return jsonResponse(503, { error: "You could not be enrolled in this programme." });
  }
}

async function completeStudentModule(userId: string, moduleId: string): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO tgf_module_completions (user_id, module_id)
       SELECT $1, m.id
       FROM tgf_modules m
       JOIN tgf_enrollments e ON e.programme_id = m.programme_id AND e.user_id = $1
       WHERE m.id = $2 AND m.is_released = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM tgf_modules previous
           WHERE previous.programme_id = m.programme_id AND previous.position < m.position
             AND NOT EXISTS (
               SELECT 1 FROM tgf_module_completions done
               WHERE done.user_id = $1 AND done.module_id = previous.id
             )
         )
       ON CONFLICT (user_id, module_id) DO NOTHING
       RETURNING id`,
      [userId, moduleId],
    );
    if (result.rowCount) return jsonResponse(200, { completed: true });
    const existing = await pool.query(
      `SELECT 1 FROM tgf_module_completions c
       JOIN tgf_modules m ON m.id = c.module_id
       JOIN tgf_enrollments e ON e.programme_id = m.programme_id AND e.user_id = $1
       WHERE c.user_id = $1 AND c.module_id = $2`,
      [userId, moduleId],
    );
    return existing.rowCount
      ? jsonResponse(200, { completed: true })
      : jsonResponse(403, {
          error: "Complete the current released module before moving forward.",
        });
  } catch (error) {
    safeLogFailure("Student module completion", error);
    return jsonResponse(503, { error: "Your module completion could not be saved." });
  }
}

async function listTeacherModules(teacher: UserSessionRow): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<ModuleRow>(
      `SELECT m.id, m.programme_id, p.title AS programme_title, m.title, m.description,
              m.lesson_content, m.meeting_url, m.position, m.is_released
       FROM tgf_modules m JOIN tgf_programmes p ON p.id = m.programme_id
       WHERE p.is_active = TRUE AND (
         $2::boolean OR EXISTS (
           SELECT 1 FROM tgf_live_classes l
           WHERE l.module_id = m.id AND l.teacher_id = $1 AND l.is_active = TRUE
         )
       )
       ORDER BY p.sort_order, m.position`,
      [teacher.id, teacher.role === "administrator"],
    );
    return jsonResponse(200, result.rows.map((module) => serializeModule(module)));
  } catch (error) {
    safeLogFailure("Teacher modules lookup", error);
    return jsonResponse(503, { error: "Teaching modules are temporarily unavailable." });
  }
}

async function listTeacherClasses(teacherId: string): Promise<Response> {
  try {
    await ensureSchema();
    const result = await pool.query<LiveClassRow>(
      `SELECT l.id, l.teacher_id, t.full_name AS teacher_name, l.module_id,
              m.title AS module_title, p.title AS programme_title,
              l.title, l.starts_at, l.meeting_url
       FROM tgf_live_classes l
       JOIN tgf_modules m ON m.id = l.module_id
       JOIN tgf_programmes p ON p.id = m.programme_id
       JOIN tgf_users t ON t.id = l.teacher_id
       WHERE l.teacher_id = $1 AND l.is_active = TRUE AND l.starts_at >= NOW() - INTERVAL '2 hours'
       ORDER BY l.starts_at LIMIT 50`,
      [teacherId],
    );
    return jsonResponse(200, result.rows.map(serializeLiveClass));
  } catch (error) {
    safeLogFailure("Teacher live-class lookup", error);
    return jsonResponse(503, { error: "Live classes are temporarily unavailable." });
  }
}

async function createTeacherClass(request: Request, teacherId: string): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validation = validateLiveClass(body);
    if (validation.error || !validation.liveClass) {
      return jsonResponse(400, { error: validation.error || "Enter valid live-class details." });
    }
    const liveClass = validation.liveClass;
    const result = await pool.query<LiveClassRow>(
      `INSERT INTO tgf_live_classes (teacher_id, module_id, title, starts_at, meeting_url)
       SELECT $1, m.id, $3, $4, $5
       FROM tgf_modules m
       JOIN tgf_programmes p ON p.id = m.programme_id AND p.is_active = TRUE
       WHERE m.id = $2
       RETURNING id, teacher_id, module_id, title, starts_at, meeting_url`,
      [teacherId, liveClass.moduleId, liveClass.title, liveClass.startsAt, liveClass.meetingUrl],
    );
    if (!result.rows[0]) {
      return jsonResponse(404, { error: "Select an active programme module for this class." });
    }
    return jsonResponse(201, serializeLiveClass(result.rows[0]));
  } catch (error) {
    safeLogFailure("Live-class creation", error);
    return jsonResponse(503, { error: "The live class could not be scheduled." });
  }
}

async function updateTeacherClass(
  request: Request,
  teacherId: string,
  classId: string,
): Promise<Response> {
  try {
    const body = await readJson(request);
    if (typeof body.isActive !== "boolean") {
      return jsonResponse(400, { error: "Choose whether this live class is active." });
    }
    await ensureSchema();
    const result = await pool.query(
      `UPDATE tgf_live_classes SET is_active = $3, updated_at = NOW()
       WHERE id = $1 AND teacher_id = $2 RETURNING id`,
      [classId, teacherId, body.isActive],
    );
    return result.rowCount
      ? jsonResponse(200, { updated: true })
      : jsonResponse(404, { error: "This live class is not assigned to you." });
  } catch (error) {
    safeLogFailure("Live-class update", error);
    return jsonResponse(503, { error: "The live class could not be updated." });
  }
}

async function getModuleAccess(moduleId: string, userId: string) {
  const result = await pool.query<{
    programme_id: string;
    is_released: boolean;
    enrolled: boolean;
    prerequisites_complete: boolean;
  }>(
    `SELECT m.programme_id, m.is_released,
       EXISTS (
         SELECT 1 FROM tgf_enrollments e
         WHERE e.programme_id = m.programme_id AND e.user_id = $2
       ) AS enrolled,
       NOT EXISTS (
         SELECT 1 FROM tgf_modules previous
         WHERE previous.programme_id = m.programme_id AND previous.position < m.position
           AND NOT EXISTS (
             SELECT 1 FROM tgf_module_completions done
             WHERE done.user_id = $2 AND done.module_id = previous.id
           )
       ) AS prerequisites_complete
     FROM tgf_modules m
     JOIN tgf_programmes p ON p.id = m.programme_id AND p.is_active = TRUE
     WHERE m.id = $1`,
    [moduleId, userId],
  );
  return result.rows[0] || null;
}

async function readLessonBoard(
  moduleId: string,
  user: UserSessionRow,
): Promise<Response> {
  try {
    await ensureSchema();
    if (user.role === "learner") {
      const access = await getModuleAccess(moduleId, user.id);
      if (!access || !access.enrolled || !access.is_released || !access.prerequisites_complete) {
        return jsonResponse(403, { error: "This module is locked or is not part of your enrollment." });
      }
    } else if (user.role === "teacher") {
      const assigned = await pool.query(
        "SELECT 1 FROM tgf_live_classes WHERE module_id = $1 AND teacher_id = $2 AND is_active = TRUE LIMIT 1",
        [moduleId, user.id],
      );
      if (!assigned.rowCount) {
        return jsonResponse(403, { error: "This module is not assigned to your classes." });
      }
    } else if (user.role !== "administrator") {
      return jsonResponse(403, { error: "A teacher or enrolled learner account is required." });
    }
    const result = await pool.query<{ strokes: unknown; updated_at: Date }>(
      "SELECT strokes, updated_at FROM tgf_lesson_boards WHERE module_id = $1",
      [moduleId],
    );
    return jsonResponse(200, {
      strokes: result.rows[0]?.strokes || [],
      updatedAt: result.rows[0]?.updated_at || null,
    });
  } catch (error) {
    safeLogFailure("Shared whiteboard lookup", error);
    return jsonResponse(503, { error: "The class whiteboard is temporarily unavailable." });
  }
}

async function saveLessonBoard(
  request: Request,
  moduleId: string,
  user: UserSessionRow,
): Promise<Response> {
  if (user.role !== "teacher" && user.role !== "administrator") {
    return jsonResponse(403, { error: "Only the class teacher can update the whiteboard." });
  }
  try {
    const body = await readJson(request);
    const validation = validateWhiteboardStrokes(body.strokes);
    if (validation.error || !validation.strokes) {
      return jsonResponse(400, { error: validation.error || "The drawing data is invalid." });
    }
    const access = await pool.query<{ id: string }>(
      `SELECT m.id FROM tgf_modules m
       JOIN tgf_programmes p ON p.id = m.programme_id
       LEFT JOIN tgf_live_classes l ON l.module_id = m.id AND l.teacher_id = $2 AND l.is_active = TRUE
       WHERE m.id = $1 AND p.is_active = TRUE
         AND ($3::boolean OR l.id IS NOT NULL)`,
      [moduleId, user.id, user.role === "administrator"],
    );
    if (!access.rowCount) return jsonResponse(404, { error: "This module no longer exists." });
    await pool.query(
      `INSERT INTO tgf_lesson_boards (module_id, strokes, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (module_id)
       DO UPDATE SET strokes = EXCLUDED.strokes, updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [moduleId, JSON.stringify(validation.strokes), user.id],
    );
    return jsonResponse(200, { saved: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = Number((error as { status: unknown }).status);
      if (status) {
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "The drawing data is invalid.",
        });
      }
    }
    safeLogFailure("Shared whiteboard update", error);
    return jsonResponse(503, { error: "The whiteboard could not be saved." });
  }
}

async function handleRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);

  if (pathname === "/api/register" && request.method === "POST") {
    return registerLearner(request);
  }

  if (pathname === "/api/board-members" && request.method === "GET") {
    return listBoardMembers();
  }

  if (pathname === "/api/programmes" && request.method === "GET") {
    return listProgrammes();
  }

  if (pathname === "/api/student/courses" && request.method === "GET") {
    try {
      const account = await getAccountForSession(request);
      if (!account || account.role !== "learner" || account.must_change_password) {
        return jsonResponse(401, { error: "Sign in and update your temporary password to continue." });
      }
      return listStudentCourses(account.id);
    } catch (error) {
      safeLogFailure("Student access check", error);
      return jsonResponse(503, { error: "Your student access could not be verified." });
    }
  }

  if (pathname === "/api/student/enrollments" && request.method === "POST") {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    try {
      const account = await getAccountForSession(request);
      if (!account || account.role !== "learner" || account.must_change_password) {
        return jsonResponse(401, { error: "Sign in and update your temporary password to continue." });
      }
      return enrollStudent(request, account.id);
    } catch (error) {
      safeLogFailure("Student enrollment access check", error);
      return jsonResponse(503, { error: "Your student access could not be verified." });
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 3).join("/") === "api/student/modules" &&
    segments[3] &&
    request.method === "POST"
  ) {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    if (!isUuid(segments[3])) return jsonResponse(404, { error: "This module was not found." });
    try {
      const account = await getAccountForSession(request);
      if (!account || account.role !== "learner" || account.must_change_password) {
        return jsonResponse(401, { error: "Sign in and update your temporary password to continue." });
      }
      return completeStudentModule(account.id, segments[3]);
    } catch (error) {
      safeLogFailure("Student module access check", error);
      return jsonResponse(503, { error: "Your student access could not be verified." });
    }
  }

  if (pathname === "/api/teacher/modules" && request.method === "GET") {
    try {
      const teacher = await requireTeacher(request);
      if (!teacher) {
        return jsonResponse(403, { error: "Teacher access is required." });
      }
      return listTeacherModules(teacher);
    } catch (error) {
      safeLogFailure("Teacher access check", error);
      return jsonResponse(503, { error: "Your teacher access could not be verified." });
    }
  }

  if (pathname === "/api/teacher/classes" && (request.method === "GET" || request.method === "POST")) {
    if (request.method === "POST" && !hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    try {
      const teacher = await requireTeacher(request);
      if (!teacher) return jsonResponse(403, { error: "Teacher access is required." });
      return request.method === "GET"
        ? listTeacherClasses(teacher.id)
        : createTeacherClass(request, teacher.id);
    } catch (error) {
      safeLogFailure("Teacher live-class access check", error);
      return jsonResponse(503, { error: "Your teacher access could not be verified." });
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 3).join("/") === "api/teacher/classes" &&
    isUuid(segments[3]) &&
    request.method === "PATCH"
  ) {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    try {
      const teacher = await requireTeacher(request);
      if (!teacher) return jsonResponse(403, { error: "Teacher access is required." });
      return updateTeacherClass(request, teacher.id, segments[3]);
    } catch (error) {
      safeLogFailure("Teacher live-class access check", error);
      return jsonResponse(503, { error: "Your teacher access could not be verified." });
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 2).join("/") === "api/modules" &&
    segments[3] === "board" &&
    (request.method === "GET" || request.method === "PUT")
  ) {
    const moduleId = segments[2];
    if (!isUuid(moduleId)) return jsonResponse(404, { error: "This module was not found." });
    if (request.method === "PUT" && !hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    try {
      const account = await getAccountForSession(request);
      if (!account || account.must_change_password) {
        return jsonResponse(401, { error: "Sign in and update your temporary password to continue." });
      }
      return request.method === "GET"
        ? readLessonBoard(moduleId, account)
        : saveLessonBoard(request, moduleId, account);
    } catch (error) {
      safeLogFailure("Whiteboard access check", error);
      return jsonResponse(503, { error: "Your classroom access could not be verified." });
    }
  }

  if (pathname === "/api/admin/board-members") {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Board administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "GET") return listBoardMembers(true);
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveBoardMember(request);
    }
  }

  if (pathname === "/api/admin/programmes") {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Programme administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "GET") return listProgrammes(true);
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveProgramme(request);
    }
  }

  if (
    segments.length === 5 &&
    segments.slice(0, 3).join("/") === "api/admin/programmes" &&
    segments[4] === "modules"
  ) {
    const programmeId = segments[3];
    if (!isUuid(programmeId)) return jsonResponse(404, { error: "This programme was not found." });
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Module administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "GET") return listProgrammeModules(programmeId);
    if (request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveModule(request, programmeId);
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 3).join("/") === "api/admin/board-members" &&
    isUuid(segments[3])
  ) {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Board administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "PATCH" || request.method === "DELETE") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return request.method === "PATCH"
        ? saveBoardMember(request, segments[3])
        : deleteBoardMember(segments[3]);
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 3).join("/") === "api/admin/programmes" &&
    isUuid(segments[3])
  ) {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Programme administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "PATCH") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveProgramme(request, segments[3]);
    }
  }

  if (
    segments.length === 4 &&
    segments.slice(0, 3).join("/") === "api/admin/modules" &&
    isUuid(segments[3])
  ) {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Module administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (request.method === "PATCH") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveModule(request, undefined, segments[3]);
    }
  }

  if (pathname === "/api/site-settings" && request.method === "GET") {
    try {
      const response = await getSiteSettings();
      return jsonResponse(response.status, await response.json(), {
        "Cache-Control": "public, max-age=60",
      });
    } catch (error) {
      safeLogFailure("Public website settings lookup", error);
      return jsonResponse(503, { error: "Website settings are temporarily unavailable." });
    }
  }

  if (segments.length === 2 && segments[0] === "api" && segments[1] === "locations") {
    if (request.method !== "GET") return jsonResponse(405, { error: "Method not allowed." });
    try {
      await ensureSchema();
      const result = await pool.query<LocationRow>(
        `SELECT id, city, region, address, description, image_url, is_active, sort_order
         FROM tgf_locations
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, lower(city) ASC`,
      );
      return jsonResponse(200, result.rows.map(serializeLocation));
    } catch (error) {
      safeLogFailure("Public location lookup", error);
      return jsonResponse(503, { error: "Locations are temporarily unavailable." });
    }
  }

  if (
    segments.length === 3 &&
    segments.slice(0, 2).join("/") === "api/live-classes" &&
    request.method === "GET" &&
    isUuid(segments[2])
  ) {
    try {
      const account = await getAccountForSession(request);
      if (!account || account.must_change_password) {
        return jsonResponse(401, { error: "Sign in and update your temporary password to join class." });
      }
      await ensureSchema();
      const liveClass = await pool.query<{ module_id: string; teacher_id: string; meeting_url: string }>(
        `SELECT l.module_id, l.teacher_id, l.meeting_url
         FROM tgf_live_classes l
         JOIN tgf_modules m ON m.id = l.module_id
         JOIN tgf_programmes p ON p.id = m.programme_id AND p.is_active = TRUE
         WHERE l.id = $1 AND l.is_active = TRUE`,
        [segments[2]],
      );
      if (!liveClass.rows[0]) return jsonResponse(404, { error: "This live class is unavailable." });
      const meeting = liveClass.rows[0];
      if (account.role === "learner") {
        const access = await getModuleAccess(meeting.module_id, account.id);
        if (!access || !access.enrolled || !access.is_released || !access.prerequisites_complete) {
          return jsonResponse(403, { error: "This live class is locked for your account." });
        }
      } else if (account.role !== "teacher" && account.role !== "administrator") {
        return jsonResponse(403, { error: "A teacher or enrolled learner account is required." });
      } else if (account.role === "teacher" && meeting.teacher_id !== account.id) {
        return jsonResponse(403, { error: "Only the assigned teacher can join this live class." });
      }
      return jsonResponse(200, { meetingUrl: meeting.meeting_url });
    } catch (error) {
      safeLogFailure("Live-class access check", error);
      return jsonResponse(503, { error: "Live-class access could not be verified." });
    }
  }

  if (segments.length === 3 && segments.slice(0, 2).join("/") === "api/admin") {
    const action = segments[2];

    if (action === "session" && request.method === "GET") {
      try {
        const administrator = await requireAdministrator(request);
        return jsonResponse(200, {
          authenticated: administrator !== null,
          role: administrator?.role ?? null,
        });
      } catch (error) {
        safeLogFailure("Admin session lookup", error);
        return jsonResponse(503, { error: "The admin session could not be verified." });
      }
    }

    if (action === "login" && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      if (!loginPassword || !sessionSecret) {
        return jsonResponse(503, { error: "Admin access is not configured on the server." });
      }
      if (isRateLimited(request)) {
        return jsonResponse(429, {
          error: "Too many sign-in attempts. Try again in 15 minutes.",
        });
      }
      try {
        const body = await readJson(request);
        const password = typeof body.password === "string" ? body.password : "";
        const actualHash = scryptSync(password.slice(0, 1024), passwordSalt, 64);
        if (password.length > 1024 || !timingSafeEqual(actualHash, expectedPasswordHash)) {
          recordFailedLogin(request);
          return jsonResponse(401, { error: "That password didn’t match. Please try again." });
        }
        const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        loginAttempts.delete(address);
        return jsonResponse(
          200,
          { authenticated: true },
          {
            "Set-Cookie": makeSessionCookie(
              issueSession("super_admin"),
              sessionLifetimeSeconds,
            ),
          },
        );
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? Number((error as { status: unknown }).status)
            : 400;
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "The sign-in request could not be completed.",
        });
      }
    }

    if (action === "logout" && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return jsonResponse(
        200,
        { authenticated: false },
        { "Set-Cookie": makeSessionCookie("", 0) },
      );
    }
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    if (!sessionSecret) {
      return jsonResponse(503, { error: "Secure sign-in is not configured on the server." });
    }
    if (isRateLimited(request)) {
      return jsonResponse(429, { error: "Too many sign-in attempts. Try again in 15 minutes." });
    }
    try {
      await ensureSchema();
      const body = await readJson(request);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (
        email.length > 254 ||
        password.length > 1024 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        recordFailedLogin(request);
        return jsonResponse(401, { error: "The email or password was not recognised." });
      }
      const result = await pool.query<UserRow>(
        `SELECT id, full_name, email, password_hash, role, subsidiary,
                is_frozen, must_change_password, created_at
         FROM tgf_users WHERE lower(email) = $1`,
        [email],
      );
      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        recordFailedLogin(request);
        return jsonResponse(401, { error: "The email or password was not recognised." });
      }
      if (user.is_frozen) {
        recordFailedLogin(request);
        return jsonResponse(403, {
          error: "This account is currently frozen. Contact your TGF Group administrator.",
        });
      }
      const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      loginAttempts.delete(address);
      return jsonResponse(
        200,
        { authenticated: true, mustChangePassword: user.must_change_password },
        { "Set-Cookie": makeSessionCookie(issueSession("user", user.id), sessionLifetimeSeconds) },
      );
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status: unknown }).status)
          : 400;
      if (status) {
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "The sign-in request could not be completed.",
        });
      }
      safeLogFailure("Account sign-in", error);
      return jsonResponse(503, { error: "Sign-in is temporarily unavailable." });
    }
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    return jsonResponse(
      200,
      { authenticated: false },
      { "Set-Cookie": makeSessionCookie("", 0) },
    );
  }

  if (pathname === "/api/dashboard/session" && request.method === "GET") {
    try {
      const account = await getAccountForSession(request);
      if (!account) {
        return jsonResponse(401, {
          error: "This account is no longer active. Sign in again or contact your administrator.",
        });
      }
      return jsonResponse(200, {
        authenticated: true,
        fullName: account.full_name,
        email: account.email,
        role: account.role,
        subsidiary: account.subsidiary,
        mustChangePassword: account.must_change_password,
      });
    } catch (error) {
      safeLogFailure("Dashboard session lookup", error);
      return jsonResponse(503, { error: "Your account could not be checked." });
    }
  }

  if (pathname === "/api/account/password" && request.method === "POST") {
    if (!hasSameOrigin(request)) {
      return jsonResponse(403, { error: "This request must come from the TGFVP website." });
    }
    const session = readSession(request);
    if (!session || session.type !== "user" || !session.userId) {
      return jsonResponse(401, { error: "Sign in with your TGF Group account to continue." });
    }
    try {
      const body = await readJson(request);
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 14 || password.length > 1024) {
        return jsonResponse(400, { error: "Your new password must be at least 14 characters long." });
      }
      await ensureSchema();
      const result = await pool.query<{ id: string }>(
        `UPDATE tgf_users
         SET password_hash = $2, must_change_password = FALSE, updated_at = NOW()
         WHERE id = $1 AND is_frozen = FALSE
         RETURNING id`,
        [session.userId, hashPassword(password)],
      );
      if (result.rowCount === 0) {
        return jsonResponse(403, {
          error: "This account is frozen or unavailable. Contact your administrator.",
        });
      }
      return jsonResponse(200, { passwordChanged: true });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status: unknown }).status)
          : 400;
      return jsonResponse(
        status === 400
          ? 400
          : status,
        { error: error instanceof Error ? error.message : "The password could not be changed." },
      );
    }
  }

  const isAdminLocationCollection =
    segments.length === 3 && segments.join("/") === "api/admin/locations";
  const isCloudinarySignature =
    segments.length === 3 && segments.join("/") === "api/admin/cloudinary-signature";
  const isAdminSiteSettings =
    segments.length === 3 && segments.join("/") === "api/admin/site-settings";
  const isAdminUsers = segments.length === 3 && segments.join("/") === "api/admin/users";
  if (
    isCloudinarySignature ||
    isAdminLocationCollection ||
    isAdminSiteSettings ||
    isAdminUsers ||
    segments[2] === "locations" ||
    segments[2] === "users"
  ) {
    if (!pathname.startsWith("/api/admin/")) {
      return jsonResponse(404, { error: "The requested action was not found." });
    }
    let administrator: UserSessionRow | null;
    try {
      administrator = await requireAdministrator(request);
    } catch (error) {
      safeLogFailure("Administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (!administrator) {
      return jsonResponse(403, { error: "An administrator account is required to continue." });
    }

    if (isCloudinarySignature && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      if (!isCloudinaryConfigured()) {
        return jsonResponse(503, {
          error: "Photo uploads are not configured. Set the Cloudinary environment variables first.",
        });
      }
      let uploadRequest: Record<string, unknown>;
      try {
        uploadRequest = await readJson(request);
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? Number((error as { status: unknown }).status)
            : 400;
        return jsonResponse(status, {
          error: error instanceof Error ? error.message : "The upload request is invalid.",
        });
      }
      const allowedFolders = ["tgfvp/locations", "tgfvp/flyers", "tgfvp/board"];
      const folder =
        typeof uploadRequest.folder === "string" && allowedFolders.includes(uploadRequest.folder)
          ? uploadRequest.folder
          : "tgfvp/locations";
      const timestamp = Math.floor(Date.now() / 1000);
      const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET as string;
      return jsonResponse(200, {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        uploadPreset,
        signature: createCloudinarySignature({
          folder,
          timestamp,
          uploadPreset,
          apiSecret: process.env.CLOUDINARY_API_SECRET as string,
        }),
      });
    }

    if (isAdminSiteSettings && request.method === "GET") {
      return getSiteSettings();
    }
    if (isAdminSiteSettings && request.method === "PATCH") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return updateSiteSettings(request, administrator.id);
    }

    if (isAdminUsers && request.method === "GET") return listUsers();
    if (isAdminUsers && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return createUser(request);
    }

    if (isAdminLocationCollection && request.method === "GET") {
      try {
        await ensureSchema();
        const result = await pool.query<LocationRow>(
          `SELECT id, city, region, address, description, image_url, is_active, sort_order
           FROM tgf_locations
           ORDER BY sort_order ASC, lower(city) ASC`,
        );
        return jsonResponse(200, result.rows.map(serializeLocation));
      } catch (error) {
        safeLogFailure("Admin location lookup", error);
        return jsonResponse(503, { error: "Locations are temporarily unavailable." });
      }
    }

    if (isAdminLocationCollection && request.method === "POST") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveLocation(request, "create");
    }
  }

  if (segments.length === 4 && segments.slice(0, 3).join("/") === "api/admin/locations") {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(segments[3])) {
      return jsonResponse(404, { error: "The requested location was not found." });
    }
    if (request.method === "PATCH") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return saveLocation(request, "update", segments[3]);
    }
    if (request.method === "DELETE") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      try {
        await ensureSchema();
        const result = await pool.query<{ id: string }>(
          "DELETE FROM tgf_locations WHERE id = $1 RETURNING id",
          [segments[3]],
        );
        if (result.rowCount === 0) {
          return jsonResponse(404, { error: "This location no longer exists." });
        }
        return jsonResponse(200, { deleted: true });
      } catch (error) {
        safeLogFailure("Location deletion", error);
        return jsonResponse(503, {
          error: "The location could not be deleted. Please try again.",
        });
      }
    }
  }

  if (segments.length === 4 && segments.slice(0, 3).join("/") === "api/admin/users") {
    try {
      if (!(await requireAdministrator(request))) {
        return jsonResponse(403, { error: "An administrator account is required to continue." });
      }
    } catch (error) {
      safeLogFailure("Administrator access check", error);
      return jsonResponse(503, { error: "Admin access could not be verified." });
    }
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(segments[3])) {
      return jsonResponse(404, { error: "The requested account was not found." });
    }
    if (request.method === "PATCH") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return updateUser(request, segments[3]);
    }
    if (request.method === "DELETE") {
      if (!hasSameOrigin(request)) {
        return jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      return deleteUser(segments[3]);
    }
  }

  return jsonResponse(404, { error: "The requested API endpoint was not found." });
}

async function saveLocation(
  request: Request,
  operation: "create" | "update",
  id?: string,
): Promise<Response> {
  try {
    await ensureSchema();
    const body = await readJson(request);
    const validated = validatedBody(body);
    if (validated.error) return jsonResponse(400, { error: validated.error });
    const { city, region, address, description, imageUrl, isActive, sortOrder } =
      validated.location as LocationInput;

    const result =
      operation === "create"
        ? await pool.query<LocationRow>(
            `INSERT INTO tgf_locations
               (city, region, address, description, image_url, is_active, sort_order, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING id, city, region, address, description, image_url, is_active, sort_order`,
            [city, region, address, description, imageUrl, isActive, sortOrder],
          )
        : await pool.query<LocationRow>(
            `UPDATE tgf_locations
             SET city = $2, region = $3, address = $4, description = $5, image_url = $6,
                 is_active = $7, sort_order = $8, updated_at = NOW()
             WHERE id = $1
             RETURNING id, city, region, address, description, image_url, is_active, sort_order`,
            [id, city, region, address, description, imageUrl, isActive, sortOrder],
          );
    if (result.rowCount === 0) {
      return jsonResponse(404, { error: "This location no longer exists." });
    }
    return jsonResponse(
      operation === "create" ? 201 : 200,
      serializeLocation(result.rows[0]),
    );
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      return jsonResponse(Number((error as { status: unknown }).status), {
        error: error instanceof Error ? error.message : "Check the location details and try again.",
      });
    }
    if (error && typeof error === "object" && "code" in error) {
      const code = String((error as { code: unknown }).code);
      if (code === "23505") {
        return jsonResponse(409, { error: "A location with this city name already exists." });
      }
    }
    safeLogFailure(`Location ${operation}`, error);
    return jsonResponse(503, { error: "The location could not be saved. Please try again." });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await handleRequest(request);
  } catch (error) {
    safeLogFailure("API request", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleRequest(request);
  } catch (error) {
    safeLogFailure("API request", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    return await handleRequest(request);
  } catch (error) {
    safeLogFailure("API request", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    return await handleRequest(request);
  } catch (error) {
    safeLogFailure("API request", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    return await handleRequest(request);
  } catch (error) {
    safeLogFailure("API request", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." });
  }
}
