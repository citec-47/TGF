import { randomUUID } from "node:crypto";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import {
  canonicalConversationUsers,
  validateDashboardTheme,
  validateWeeklyTimetable,
} from "./collaboration-validation.js";
import {
  authorizeLiveSessionJoin,
  canInitiallyPublish,
  isJoinWindowOpen,
} from "./live-session-validation.js";
import { assembleRecordingPartFile, saveRecordingChunkFile } from "./live-recording-storage.js";
import { validateMessageAttachment } from "./message-validation.js";

interface CollaborationAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_frozen: boolean;
  must_change_password: boolean;
  account_status?: string;
}

interface CollaborationServices {
  pool: Pool;
  ensureSchema: () => Promise<void>;
  getAccountForSession: (request: Request) => Promise<CollaborationAccount | null>;
  hasSameOrigin: (request: Request) => boolean;
  jsonResponse: (status: number, value: object, headers?: HeadersInit) => Response;
  safeLogFailure: (operation: string, error: unknown) => void;
  getMessageAttachmentMaxBytes: () => number;
  uploadPrivateCloudinaryFile: (
    file: File,
    userId: string,
    category: "message-attachments",
    validatedFile: { contentType: string; format: string; filename: string },
  ) => Promise<{ publicId: string; format: string }>;
  destroyPrivateCloudinaryAsset: (publicId: string) => Promise<void>;
  cloudinaryParameterSignature: (parameters: Record<string, string>) => string;
}

interface PeerConversationRow extends QueryResultRow {
  id: string;
  conversation_kind: "tutor" | "classmate";
  programme_id: string;
  programme_title: string;
  user_one_id: string;
  user_two_id: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  partner_role: string;
  last_message_at: Date | null;
  last_body: string | null;
  unread_count: string;
}

const MAX_CHAT_BODY_LENGTH = 2000;
const MAX_CHAT_FILES = 5;
const MAX_CHAT_TOTAL_BYTES = 100 * 1024 * 1024;
const ADMIN_EVENT_CHANNEL = "tgf_chat_admin";
const CAMEROON_TIMEZONE = "Africa/Douala";
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

function isActiveAccount(account: CollaborationAccount | null): account is CollaborationAccount {
  return Boolean(account && account.account_status === "active" &&
    !account.is_frozen && !account.must_change_password);
}

function channelForUser(userId: string): string {
  return `tgf_chat_${userId.replace(/-/g, "").toLowerCase()}`;
}

export async function publishCollaborationEvent(
  pool: Pool,
  recipient: string,
  eventType: string,
  relatedId = "",
): Promise<void> {
  const channel = recipient === "administrator" ? ADMIN_EVENT_CHANNEL : channelForUser(recipient);
  try {
    await pool.query("SELECT pg_notify($1, $2)", [
      channel,
      JSON.stringify({ type: eventType, relatedId }),
    ]);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "unexpected")
      : "unexpected";
    console.error(`Collaboration event delivery failed (error code: ${code}).`);
  }
}

async function createNotification(
  services: CollaborationServices,
  recipient: string,
  notificationType: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const isAdministrator = recipient === "administrator";
  await services.pool.query(
    `INSERT INTO tgf_notifications (user_id, target_role, notification_type, title, body, data)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      isAdministrator ? null : recipient,
      isAdministrator ? "administrator" : null,
      notificationType,
      title.slice(0, 160),
      body.slice(0, 1000),
      JSON.stringify(data),
    ],
  );
  await publishCollaborationEvent(services.pool, recipient, "notification", "");
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw Object.assign(new Error("Enter valid request details."), { status: 400 });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Enter valid request details."), { status: 400 });
  }
  return value as Record<string, unknown>;
}

function errorResponse(
  services: CollaborationServices,
  operation: string,
  error: unknown,
  fallback: string,
): Response {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status: unknown }).status);
    if (status >= 400 && status <= 599) {
      return services.jsonResponse(status, {
        error: error instanceof Error ? error.message : fallback,
      });
    }
  }
  services.safeLogFailure(operation, error);
  return services.jsonResponse(503, { error: fallback });
}

async function notifyConversationParticipants(
  services: CollaborationServices,
  conversationId: string,
  eventType: string,
): Promise<void> {
  const participants = await services.pool.query<{ user_one_id: string; user_two_id: string }>(
    `SELECT user_one_id, user_two_id
     FROM tgf_peer_conversations WHERE id = $1`,
    [conversationId],
  );
  const row = participants.rows[0];
  if (!row) return;
  await Promise.all([
    publishCollaborationEvent(services.pool, row.user_one_id, eventType, conversationId),
    publishCollaborationEvent(services.pool, row.user_two_id, eventType, conversationId),
  ]);
}

async function openRealtimeStream(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const channel = account.role === "administrator"
    ? ADMIN_EVENT_CHANNEL
    : channelForUser(account.id);
  let client: PoolClient;
  try {
    client = await services.pool.connect();
    await client.query(`LISTEN "${channel}"`);
  } catch (error) {
    services.safeLogFailure("Collaboration event stream", error);
    return services.jsonResponse(503, { error: "Live updates are temporarily unavailable." });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    client.removeListener("notification", onNotification);
    try {
      await client.query("UNLISTEN *");
    } catch (error) {
      services.safeLogFailure("Collaboration event stream cleanup", error);
    } finally {
      client.release();
    }
  };
  const onNotification = (notification: { payload?: string }) => {
    if (!notification.payload) return;
    try {
      const event = JSON.parse(notification.payload) as { type?: string; relatedId?: string };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch (error) {
      services.safeLogFailure("Collaboration event stream payload", error);
    }
  };
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      client.on("notification", onNotification);
      controller.enqueue(encoder.encode(": connected\n\n"));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          void cleanup();
        }
      }, 20000);
    },
    cancel() {
      void cleanup();
    },
  });
  request.signal.addEventListener("abort", () => void cleanup(), { once: true });
  return new Response(stream, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function listChatContacts(
  account: CollaborationAccount,
  search: string,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "learner" && account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Student or teacher access is required." });
  }
  const searchValue = `%${search.slice(0, 100)}%`;
  if (account.role === "learner") {
    const [tutors, classmates] = await Promise.all([
      services.pool.query(
        `SELECT p.id AS programme_id, p.title AS programme_title,
                teacher.id AS user_id, teacher.full_name, teacher.email
         FROM tgf_enrollments enrollment
         JOIN tgf_programmes p ON p.id = enrollment.programme_id
         JOIN tgf_programme_teachers assignment ON assignment.programme_id = p.id
         JOIN tgf_users teacher ON teacher.id = assignment.teacher_id
           AND teacher.role = 'teacher' AND teacher.account_status = 'active'
           AND teacher.is_frozen = FALSE
         WHERE enrollment.user_id = $1 AND enrollment.approval_status = 'approved'
           AND ($2 = '%%' OR CONCAT_WS(' ', teacher.full_name, teacher.email, p.title) ILIKE $2)
         ORDER BY p.sort_order, lower(teacher.full_name)`,
        [account.id, searchValue],
      ),
      services.pool.query(
        `SELECT DISTINCT p.id AS programme_id, p.title AS programme_title,
                lower(p.title) AS programme_title_sort,
                classmate.id AS user_id, classmate.full_name, classmate.email,
                lower(classmate.full_name) AS person_name_sort
         FROM tgf_enrollments mine
         JOIN tgf_enrollments theirs ON theirs.programme_id = mine.programme_id
           AND theirs.user_id <> mine.user_id AND theirs.approval_status = 'approved'
         JOIN tgf_programmes p ON p.id = mine.programme_id
         JOIN tgf_users classmate ON classmate.id = theirs.user_id
           AND classmate.role = 'learner' AND classmate.account_status = 'active'
           AND classmate.is_frozen = FALSE
         WHERE mine.user_id = $1 AND mine.approval_status = 'approved'
           AND ($2 = '%%' OR CONCAT_WS(' ', classmate.full_name, classmate.email, p.title) ILIKE $2)
         ORDER BY programme_title_sort, person_name_sort`,
        [account.id, searchValue],
      ),
    ]);
    return services.jsonResponse(200, {
      administrator: { label: "Message Admin", href: "#student-support" },
      contacts: [
        ...tutors.rows.map((row) => ({
          kind: "tutor",
          userId: row.user_id,
          name: row.full_name,
          email: row.email,
          programmeId: row.programme_id,
          programmeTitle: row.programme_title,
          label: `Message Tutor · ${row.programme_title}`,
        })),
        ...classmates.rows.map((row) => ({
          kind: "classmate",
          userId: row.user_id,
          name: row.full_name,
          email: row.email,
          programmeId: row.programme_id,
          programmeTitle: row.programme_title,
          label: `Classmate · ${row.programme_title}`,
        })),
      ],
    });
  }

  const students = await services.pool.query(
    `SELECT DISTINCT p.id AS programme_id, p.title AS programme_title,
            lower(p.title) AS programme_title_sort,
            learner.id AS user_id, learner.full_name, learner.email,
            lower(learner.full_name) AS person_name_sort
     FROM tgf_programme_teachers assignment
     JOIN tgf_programmes p ON p.id = assignment.programme_id
     JOIN tgf_enrollments enrollment ON enrollment.programme_id = p.id
       AND enrollment.approval_status = 'approved'
     JOIN tgf_users learner ON learner.id = enrollment.user_id
       AND learner.role = 'learner' AND learner.account_status = 'active'
       AND learner.is_frozen = FALSE
     WHERE assignment.teacher_id = $1
       AND ($2 = '%%' OR CONCAT_WS(' ', learner.full_name, learner.email, p.title) ILIKE $2)
     ORDER BY programme_title_sort, person_name_sort`,
    [account.id, searchValue],
  );
  return services.jsonResponse(200, {
    administrator: { label: "Message Admin", href: "#teacher-support" },
    contacts: students.rows.map((row) => ({
      kind: "tutor",
      userId: row.user_id,
      name: row.full_name,
      email: row.email,
      programmeId: row.programme_id,
      programmeTitle: row.programme_title,
      label: `Student · ${row.programme_title}`,
    })),
  });
}

async function listPeerConversations(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const result = await services.pool.query<PeerConversationRow>(
    `SELECT conversation.id, conversation.conversation_kind, conversation.programme_id,
            programme.title AS programme_title, conversation.user_one_id, conversation.user_two_id,
            CASE WHEN conversation.user_one_id = $1 THEN conversation.user_two_id
                 ELSE conversation.user_one_id END AS partner_id,
            partner.full_name AS partner_name, partner.email AS partner_email, partner.role AS partner_role,
            conversation.last_message_at, latest.body AS last_body,
            COALESCE(unread.total, 0)::text AS unread_count
     FROM tgf_peer_conversations conversation
     JOIN tgf_programmes programme ON programme.id = conversation.programme_id
     JOIN tgf_users partner ON partner.id = CASE
       WHEN conversation.user_one_id = $1 THEN conversation.user_two_id
       ELSE conversation.user_one_id END
     LEFT JOIN LATERAL (
       SELECT message.body FROM tgf_peer_messages message
       WHERE message.conversation_id = conversation.id
       ORDER BY message.created_at DESC, message.id DESC LIMIT 1
     ) latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS total FROM tgf_peer_messages message
       LEFT JOIN tgf_peer_conversation_reads read_state
         ON read_state.conversation_id = conversation.id AND read_state.user_id = $1
       WHERE message.conversation_id = conversation.id AND message.sender_user_id <> $1
         AND message.created_at > COALESCE(read_state.read_at, '-infinity'::timestamptz)
     ) unread ON TRUE
     WHERE $1 IN (conversation.user_one_id, conversation.user_two_id)
     ORDER BY conversation.last_message_at DESC NULLS LAST, conversation.created_at DESC
     LIMIT 200`,
    [account.id],
  );
  return services.jsonResponse(200, {
    conversations: result.rows.map((row) => ({
      id: row.id,
      kind: row.conversation_kind,
      programmeId: row.programme_id,
      programmeTitle: row.programme_title,
      partnerId: row.partner_id,
      partnerName: row.partner_name,
      partnerEmail: row.partner_email,
      partnerRole: row.partner_role,
      lastMessage: row.last_body || "No messages yet",
      lastMessageAt: row.last_message_at,
      unreadCount: Number(row.unread_count),
    })),
  });
}

async function createPeerConversation(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const body = await readJson(request);
  const targetUserId = typeof body.userId === "string" ? body.userId : "";
  const programmeId = typeof body.programmeId === "string" ? body.programmeId : "";
  const kind = body.kind === "tutor" || body.kind === "classmate" ? body.kind : "";
  if (!isUuid(targetUserId) || !isUuid(programmeId) || !kind ||
      account.role === "administrator" || targetUserId === account.id) {
    return services.jsonResponse(400, { error: "Choose a valid course contact." });
  }
  const canonicalUsers = canonicalConversationUsers(account.id, targetUserId);
  if (!canonicalUsers) return services.jsonResponse(400, { error: "Choose another account." });

  let authorized = false;
  if (kind === "tutor") {
    const studentId = account.role === "learner" ? account.id : targetUserId;
    const teacherId = account.role === "teacher" ? account.id : targetUserId;
    const check = await services.pool.query(
      `SELECT 1
       FROM tgf_enrollments enrollment
       JOIN tgf_programme_teachers assignment
         ON assignment.programme_id = enrollment.programme_id
       JOIN tgf_users learner ON learner.id = enrollment.user_id
         AND learner.role = 'learner' AND learner.account_status = 'active'
         AND learner.is_frozen = FALSE
       JOIN tgf_users teacher ON teacher.id = assignment.teacher_id
         AND teacher.role = 'teacher' AND teacher.account_status = 'active'
         AND teacher.is_frozen = FALSE
       WHERE enrollment.user_id = $1 AND assignment.teacher_id = $2
         AND enrollment.programme_id = $3 AND enrollment.approval_status = 'approved'`,
      [studentId, teacherId, programmeId],
    );
    authorized = (check.rowCount || 0) > 0;
  } else if (account.role === "learner") {
    const check = await services.pool.query(
      `SELECT 1 FROM tgf_enrollments mine
       JOIN tgf_enrollments theirs ON theirs.programme_id = mine.programme_id
         AND theirs.user_id = $2 AND theirs.approval_status = 'approved'
       JOIN tgf_users classmate ON classmate.id = theirs.user_id
         AND classmate.role = 'learner' AND classmate.account_status = 'active'
         AND classmate.is_frozen = FALSE
       WHERE mine.user_id = $1 AND mine.programme_id = $3
         AND mine.approval_status = 'approved'`,
      [account.id, targetUserId, programmeId],
    );
    authorized = (check.rowCount || 0) > 0;
  }
  if (!authorized) {
    return services.jsonResponse(403, { error: "You cannot message this person for that course." });
  }

  const client = await services.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO tgf_peer_conversations
         (conversation_kind, programme_id, user_one_id, user_two_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (conversation_kind, programme_id, user_one_id, user_two_id) DO NOTHING
       RETURNING id`,
      [kind, programmeId, canonicalUsers[0], canonicalUsers[1], account.id],
    );
    const conversation = inserted.rows[0] || (await client.query<{ id: string }>(
      `SELECT id FROM tgf_peer_conversations
       WHERE conversation_kind = $1 AND programme_id = $2
         AND user_one_id = $3 AND user_two_id = $4`,
      [kind, programmeId, canonicalUsers[0], canonicalUsers[1]],
    )).rows[0];
    if (!conversation) throw new Error("The conversation could not be opened.");
    await client.query("COMMIT");
    return services.jsonResponse(200, { conversationId: conversation.id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPeerConversation(
  conversationId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const access = await services.pool.query(
    `SELECT conversation.id, conversation.conversation_kind, conversation.programme_id,
            programme.title AS programme_title,
            CASE WHEN conversation.user_one_id = $2 THEN other.id ELSE first.id END AS partner_id,
            CASE WHEN conversation.user_one_id = $2 THEN other.full_name ELSE first.full_name END AS partner_name,
            CASE WHEN conversation.user_one_id = $2 THEN other.email ELSE first.email END AS partner_email,
            CASE WHEN conversation.user_one_id = $2 THEN other.role ELSE first.role END AS partner_role
     FROM tgf_peer_conversations conversation
     JOIN tgf_programmes programme ON programme.id = conversation.programme_id
     JOIN tgf_users first ON first.id = conversation.user_one_id
     JOIN tgf_users other ON other.id = conversation.user_two_id
     WHERE conversation.id = $1 AND $2 IN (conversation.user_one_id, conversation.user_two_id)`,
    [conversationId, account.id],
  );
  if (!access.rows[0]) {
    return services.jsonResponse(404, { error: "This conversation is unavailable." });
  }

  await services.pool.query(
    `INSERT INTO tgf_peer_conversation_reads (conversation_id, user_id, read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET read_at = NOW()`,
    [conversationId, account.id],
  );
  const messages = await services.pool.query(
    `SELECT message.id, message.sender_user_id, message.sender_name, message.body,
            message.created_at,
            COALESCE(
              json_agg(json_build_object(
                'id', attachment.id,
                'fileName', attachment.original_filename,
                'contentType', attachment.content_type,
                'fileSize', attachment.file_size
              ) ORDER BY attachment.created_at)
              FILTER (WHERE attachment.id IS NOT NULL),
              '[]'::json
            ) AS attachments
     FROM tgf_peer_messages message
     LEFT JOIN tgf_peer_message_attachments attachment ON attachment.message_id = message.id
     WHERE message.conversation_id = $1
     GROUP BY message.id
     ORDER BY message.created_at DESC, message.id DESC
     LIMIT 500`,
    [conversationId],
  );
  const partnerRead = await services.pool.query<{ read_at: Date | null }>(
    `SELECT read_at FROM tgf_peer_conversation_reads
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, access.rows[0].partner_id],
  );
  const readAt = partnerRead.rows[0]?.read_at?.getTime() ?? 0;
  return services.jsonResponse(200, {
    conversation: {
      id: conversationId,
      kind: access.rows[0].conversation_kind,
      programmeId: access.rows[0].programme_id,
      programmeTitle: access.rows[0].programme_title,
      partnerId: access.rows[0].partner_id,
      partnerName: access.rows[0].partner_name,
      partnerEmail: access.rows[0].partner_email,
      partnerRole: access.rows[0].partner_role,
    },
    messages: messages.rows.reverse().map((message) => ({
      id: message.id,
      senderName: message.sender_name,
      body: message.body,
      createdAt: message.created_at,
      isOwn: message.sender_user_id === account.id,
      readStatus: message.sender_user_id === account.id
        ? readAt >= new Date(message.created_at).getTime() ? "Read" : "Sent"
        : null,
      attachments: (message.attachments || []).map((attachment: {
        id: string;
        fileName: string;
        contentType: string;
        fileSize: string | number;
      }) => ({
        ...attachment,
        fileSize: Number(attachment.fileSize),
        url: `/api/collaboration/chat/attachments/${encodeURIComponent(attachment.id)}`,
      })),
    })),
  });
}

async function sendPeerMessage(
  request: Request,
  conversationId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const uploaded: Array<{
    publicId: string;
    file: File;
    validated: { contentType: string; format: string; filename: string };
  }> = [];
  try {
    const maxBytes = services.getMessageAttachmentMaxBytes();
    const totalLimit = Math.min(maxBytes * MAX_CHAT_FILES, MAX_CHAT_TOTAL_BYTES);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > totalLimit + 512 * 1024) {
      return services.jsonResponse(413, { error: "The attachments exceed the message size limit." });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
      return services.jsonResponse(415, { error: "Send messages using the supported attachment form." });
    }
    const form = await request.formData();
    const bodyValue = form.get("body");
    const messageBody = typeof bodyValue === "string" ? bodyValue.trim() : "";
    if (messageBody.length > MAX_CHAT_BODY_LENGTH) {
      return services.jsonResponse(400, { error: "Messages must be 2,000 characters or fewer." });
    }
    const entries = form.getAll("attachments");
    if (entries.some((entry) => !(entry instanceof File))) {
      return services.jsonResponse(400, { error: "One or more attachments are invalid." });
    }
    const files = (entries as File[]).filter((file) => file.name.length > 0);
    if (files.length > MAX_CHAT_FILES) {
      return services.jsonResponse(400, { error: `Attach no more than ${MAX_CHAT_FILES} files per message.` });
    }
    if (!messageBody && files.length === 0) {
      return services.jsonResponse(400, { error: "Write a message or attach at least one file." });
    }
    if (files.reduce((total, file) => total + file.size, 0) > totalLimit) {
      return services.jsonResponse(413, { error: "The attachments exceed the message size limit." });
    }
    const validatedFiles = [];
    for (const file of files) {
      const validation = validateMessageAttachment({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        header: new Uint8Array(await file.slice(0, 512).arrayBuffer()),
        maxBytes,
      });
      if (typeof validation.error === "string") {
        return services.jsonResponse(400, { error: validation.error });
      }
      validatedFiles.push({
        file,
        validated: {
          contentType: validation.contentType,
          format: validation.format,
          filename: validation.filename,
        },
      });
    }
    const conversationAccess = await services.pool.query(
      `SELECT 1 FROM tgf_peer_conversations
       WHERE id = $1 AND $2 IN (user_one_id, user_two_id)`,
      [conversationId, account.id],
    );
    if (!conversationAccess.rowCount) {
      return services.jsonResponse(404, { error: "This conversation is unavailable." });
    }
    for (const { file, validated } of validatedFiles) {
      const asset = await services.uploadPrivateCloudinaryFile(
        file,
        account.id,
        "message-attachments",
        validated,
      );
      uploaded.push({ publicId: asset.publicId, file, validated });
    }

    const client = await services.pool.connect();
    try {
      await client.query("BEGIN");
      const message = await client.query<{ id: string }>(
        `INSERT INTO tgf_peer_messages
           (conversation_id, sender_user_id, sender_name, body)
         SELECT $1, $2, $3, $4
         WHERE EXISTS (
           SELECT 1 FROM tgf_peer_conversations
           WHERE id = $1 AND $2 IN (user_one_id, user_two_id)
         )
         RETURNING id`,
        [conversationId, account.id, account.full_name, messageBody],
      );
      if (!message.rowCount) {
        await client.query("ROLLBACK");
        return services.jsonResponse(404, { error: "This conversation is unavailable." });
      }
      for (const asset of uploaded) {
        await client.query(
          `INSERT INTO tgf_peer_message_attachments
             (message_id, cloudinary_public_id, original_filename, content_type, file_size, cloudinary_format)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            message.rows[0].id,
            asset.publicId,
            asset.validated.filename,
            asset.validated.contentType,
            asset.file.size,
            asset.validated.format,
          ],
        );
      }
      await client.query(
        `UPDATE tgf_peer_conversations SET last_message_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [conversationId],
      );
      await client.query(
        `INSERT INTO tgf_peer_conversation_reads (conversation_id, user_id, read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET read_at = NOW()`,
        [conversationId, account.id],
      );
      await client.query("COMMIT");
      uploaded.length = 0;
      let warning = "";
      try {
        await notifyConversationParticipants(services, conversationId, "chat-message");
      } catch (error) {
        services.safeLogFailure("Course message live update", error);
        warning = "Message sent, but live updates are temporarily unavailable.";
      }
      return services.jsonResponse(201, { sent: true, warning });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    for (const asset of uploaded) await services.destroyPrivateCloudinaryAsset(asset.publicId);
    return errorResponse(services, "Course message send", error, "The message could not be sent.");
  }
}

async function listTimetables(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!["administrator", "teacher", "learner"].includes(account.role)) {
    return services.jsonResponse(403, { error: "Dashboard access is required." });
  }
  const userId = isUuid(account.id) ? account.id : null;
  const result = await services.pool.query(
    `SELECT timetable.id, timetable.programme_id, programme.title AS programme_title,
            timetable.teacher_id, teacher.full_name AS teacher_name, timetable.status,
            timetable.timezone, timetable.rejection_reason, timetable.submitted_at,
            timetable.reviewed_at,
            COALESCE(
              json_agg(json_build_object(
                'id', slot.id,
                'weekday', slot.weekday,
                'startsAt', to_char(slot.starts_at, 'HH24:MI'),
                'endsAt', to_char(slot.ends_at, 'HH24:MI')
              ) ORDER BY slot.weekday, slot.starts_at)
              FILTER (WHERE slot.id IS NOT NULL),
              '[]'::json
            ) AS slots
     FROM tgf_course_timetables timetable
     JOIN tgf_programmes programme ON programme.id = timetable.programme_id
     JOIN tgf_users teacher ON teacher.id = timetable.teacher_id
     LEFT JOIN tgf_course_timetable_slots slot ON slot.timetable_id = timetable.id
     WHERE timetable.deleted_at IS NULL AND timetable.status <> 'superseded'
       AND programme.deleted_at IS NULL AND (
       $2 = 'administrator' OR
       ($2 = 'teacher' AND timetable.teacher_id = $1) OR
       ($2 = 'learner' AND timetable.status = 'approved' AND programme.is_active = TRUE AND EXISTS (
         SELECT 1 FROM tgf_enrollments enrollment
         WHERE enrollment.user_id = $1 AND enrollment.programme_id = timetable.programme_id
           AND enrollment.approval_status = 'approved'
       ))
     )
     GROUP BY timetable.id, programme.id, teacher.id
     ORDER BY CASE timetable.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
              timetable.submitted_at DESC`,
    [userId, account.role],
  );
  return services.jsonResponse(200, {
    timetables: result.rows.map((row) => ({
      id: row.id,
      programmeId: row.programme_id,
      programmeTitle: row.programme_title,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      status: row.status,
      timezone: row.timezone,
      rejectionReason: row.rejection_reason,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      slots: row.slots || [],
    })),
  });
}

async function deleteTimetable(
  request: Request,
  timetableId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "administrator") {
    return services.jsonResponse(403, { error: "Administrator access is required." });
  }
  if (!services.hasSameOrigin(request)) {
    return services.jsonResponse(403, { error: "This request must come from the TGFVP website." });
  }
  if (!isUuid(timetableId)) {
    return services.jsonResponse(404, { error: "This timetable was not found." });
  }
  const result = await services.pool.query<{ id: string }>(
    `UPDATE tgf_course_timetables
     SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [timetableId, account.id],
  );
  if (!result.rowCount) return services.jsonResponse(404, { error: "This timetable was not found." });
  return services.jsonResponse(200, { deleted: true });
}

async function updateTimetable(
  request: Request,
  timetableId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "administrator") {
    return services.jsonResponse(403, { error: "Administrator access is required." });
  }
  if (!services.hasSameOrigin(request)) {
    return services.jsonResponse(403, { error: "This request must come from the TGFVP website." });
  }
  if (!isUuid(timetableId)) {
    return services.jsonResponse(404, { error: "This timetable was not found." });
  }
  const body = await readJson(request);
  const validation = validateWeeklyTimetable(body);
  if (validation.error || !validation.timetable) {
    return services.jsonResponse(400, {
      error: validation.error || "Enter valid weekly timetable details.",
    });
  }

  const client = await services.pool.connect();
  let updated: {
    id: string;
    status: "pending" | "approved";
    teacher_id: string;
    programme_id: string;
    programme_title: string;
  } | null = null;
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      status: "pending" | "approved";
      teacher_id: string;
      programme_id: string;
      programme_title: string;
    }>(
      `SELECT timetable.status, timetable.teacher_id, timetable.programme_id,
              programme.title AS programme_title
       FROM tgf_course_timetables timetable
       JOIN tgf_programmes programme ON programme.id = timetable.programme_id
       WHERE timetable.id = $1 AND timetable.status IN ('pending', 'approved')
         AND timetable.deleted_at IS NULL AND programme.deleted_at IS NULL
       FOR UPDATE OF timetable`,
      [timetableId],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return services.jsonResponse(409, { error: "This timetable is no longer editable." });
    }
    const activeSession = await client.query(
      `SELECT 1
       FROM tgf_live_sessions session
       JOIN tgf_course_timetable_slots slot ON slot.id = session.timetable_slot_id
       WHERE slot.timetable_id = $1 AND session.started_at IS NOT NULL
         AND session.ended_at IS NULL
       LIMIT 1`,
      [timetableId],
    );
    if (activeSession.rowCount) {
      await client.query("ROLLBACK");
      return services.jsonResponse(409, { error: "This timetable cannot be edited while a class is live." });
    }

    updated = {
      id: "",
      status: current.rows[0].status,
      teacher_id: current.rows[0].teacher_id,
      programme_id: current.rows[0].programme_id,
      programme_title: current.rows[0].programme_title,
    };
    if (updated.status === "approved") {
      await client.query(
        `UPDATE tgf_course_timetables SET status = 'superseded'
         WHERE programme_id = $1 AND status = 'approved'`,
        [updated.programme_id],
      );
    } else {
      await client.query(
        `UPDATE tgf_course_timetables SET status = 'superseded'
         WHERE id = $1`,
        [timetableId],
      );
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO tgf_course_timetables
         (programme_id, teacher_id, status, timezone, reviewed_at, reviewed_by)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'approved' THEN NOW() ELSE NULL END,
               CASE WHEN $3 = 'approved' THEN $5 ELSE NULL END)
       RETURNING id`,
      [
        updated.programme_id,
        updated.teacher_id,
        updated.status,
        validation.timetable.timezone,
        isUuid(account.id) ? account.id : null,
      ],
    );
    updated.id = inserted.rows[0].id;
    for (const slot of validation.timetable.slots) {
      await client.query(
        `INSERT INTO tgf_course_timetable_slots
           (timetable_id, weekday, starts_at, ends_at)
         VALUES ($1, $2, $3::time, $4::time)`,
        [updated.id, slot.weekday, slot.startsAt, slot.endsAt],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!updated) throw new Error("The timetable edit did not produce an updated schedule.");
  let warning = "";
  try {
    await createNotification(
      services,
      updated.teacher_id,
      "timetable-updated",
      "Weekly timetable edited",
      `An administrator updated the weekly timetable for ${updated.programme_title}.`,
      { timetableId: updated.id, programmeId: updated.programme_id },
    );
    await publishCollaborationEvent(services.pool, updated.teacher_id, "timetable-updated", updated.id);
  } catch (error) {
    services.safeLogFailure("Tutor timetable edit notification", error);
    warning = "The timetable was saved, but the tutor notification could not be delivered.";
  }
  if (updated.status === "approved") {
    try {
      await notifyProgrammeStudents(
        services,
        updated.programme_id,
        "timetable-updated",
        "Course timetable updated",
        `The approved timetable for ${updated.programme_title} has changed.`,
        { timetableId: updated.id, programmeId: updated.programme_id },
      );
    } catch (error) {
      services.safeLogFailure("Student timetable edit notifications", error);
      warning = "The timetable was saved, but one or more student notifications could not be delivered.";
    }
  }
  return services.jsonResponse(200, {
    updated: true,
    timetableId: updated.id,
    programmeTitle: updated.programme_title,
    status: updated.status,
    warning,
  });
}

async function submitTimetable(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Teacher access is required." });
  }
  const body = await readJson(request);
  const programmeId = typeof body.programmeId === "string" ? body.programmeId : "";
  if (!isUuid(programmeId)) {
    return services.jsonResponse(400, { error: "Choose an assigned course." });
  }
  const validation = validateWeeklyTimetable(body);
  if (validation.error || !validation.timetable) {
    return services.jsonResponse(400, {
      error: validation.error || "Enter valid weekly timetable details.",
    });
  }
  const assignment = await services.pool.query(
    `SELECT 1 FROM tgf_programme_teachers assignment
     JOIN tgf_programmes programme ON programme.id = assignment.programme_id
     WHERE assignment.teacher_id = $1 AND assignment.programme_id = $2
       AND programme.is_active = TRUE`,
    [account.id, programmeId],
  );
  if (!assignment.rowCount) {
    return services.jsonResponse(403, { error: "You can only submit a timetable for an assigned course." });
  }

  const client = await services.pool.connect();
  let timetableId = "";
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE tgf_course_timetables SET status = 'superseded'
       WHERE programme_id = $1 AND teacher_id = $2 AND status = 'pending'`,
      [programmeId, account.id],
    );
    const timetable = await client.query<{ id: string }>(
      `INSERT INTO tgf_course_timetables (programme_id, teacher_id, timezone)
       VALUES ($1, $2, $3) RETURNING id`,
      [programmeId, account.id, validation.timetable.timezone],
    );
    timetableId = timetable.rows[0].id;
    for (const slot of validation.timetable.slots) {
      await client.query(
        `INSERT INTO tgf_course_timetable_slots
           (timetable_id, weekday, starts_at, ends_at)
         VALUES ($1, $2, $3::time, $4::time)`,
        [timetableId, slot.weekday, slot.startsAt, slot.endsAt],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  let warning = "";
  try {
    await createNotification(
      services,
      "administrator",
      "timetable-submitted",
      "Weekly timetable awaiting review",
      `${account.full_name} submitted a timetable for administrator approval.`,
      { timetableId, programmeId },
    );
  } catch (error) {
    services.safeLogFailure("Timetable submission notification", error);
    warning = "Timetable submitted, but the administrator notification could not be delivered.";
  }
  return services.jsonResponse(201, { submitted: true, timetableId, warning });
}

async function reviewTimetable(
  request: Request,
  timetableId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "administrator") {
    return services.jsonResponse(403, { error: "Administrator access is required." });
  }
  const body = await readJson(request);
  const action = body.action === "approve" || body.action === "reject" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!action || reason.length > 1000) {
    return services.jsonResponse(400, { error: "Choose approve or reject and enter a reason of 1,000 characters or fewer." });
  }
  const client = await services.pool.connect();
  let reviewed: { teacher_id: string; programme_id: string; programme_title: string } | null = null;
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      teacher_id: string;
      programme_id: string;
      programme_title: string;
    }>(
      `SELECT timetable.teacher_id, timetable.programme_id, programme.title AS programme_title
       FROM tgf_course_timetables timetable
       JOIN tgf_programmes programme ON programme.id = timetable.programme_id
       WHERE timetable.id = $1 AND timetable.status = 'pending'
         AND timetable.deleted_at IS NULL AND programme.deleted_at IS NULL
       FOR UPDATE OF timetable`,
      [timetableId],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return services.jsonResponse(409, { error: "This timetable is no longer awaiting review." });
    }
    reviewed = current.rows[0];
    if (action === "approve") {
      await client.query(
        `UPDATE tgf_course_timetables SET status = 'superseded'
         WHERE programme_id = $1 AND status = 'approved' AND id <> $2`,
        [current.rows[0].programme_id, timetableId],
      );
    }
    await client.query(
      `UPDATE tgf_course_timetables
       SET status = $2, rejection_reason = $3, reviewed_at = NOW(), reviewed_by = $4
       WHERE id = $1`,
      [timetableId, action === "approve" ? "approved" : "rejected", reason,
        isUuid(account.id) ? account.id : null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let warning = "";
  if (reviewed) {
    try {
      await createNotification(
        services,
        reviewed.teacher_id,
        action === "approve" ? "timetable-approved" : "timetable-rejected",
        action === "approve" ? "Weekly timetable approved" : "Weekly timetable declined",
        action === "approve"
          ? `Your timetable for ${reviewed.programme_title} is now visible to enrolled students.`
          : reason || `Your timetable for ${reviewed.programme_title} was declined.`,
        { timetableId, programmeId: reviewed.programme_id },
      );
    } catch (error) {
      services.safeLogFailure("Tutor timetable decision notification", error);
      warning = "The timetable decision was saved, but the tutor notification could not be delivered.";
    }
  }
  if (reviewed && action === "approve") {
    try {
      await notifyProgrammeStudents(
        services,
        reviewed.programme_id,
        "timetable-updated",
        "Course timetable updated",
        `The approved timetable for ${reviewed.programme_title} has changed.`,
        { timetableId, programmeId: reviewed.programme_id },
      );
    } catch (error) {
      services.safeLogFailure("Student timetable update notifications", error);
      warning = "The timetable was approved, but one or more student notifications could not be delivered.";
    }
  }
  return services.jsonResponse(200, {
    reviewed: true,
    status: action === "approve" ? "approved" : "rejected",
    warning,
  });
}

async function notifyProgrammeStudents(
  services: CollaborationServices,
  programmeId: string,
  notificationType: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const students = await services.pool.query<{ id: string }>(
    `SELECT enrollment.user_id AS id
     FROM tgf_enrollments enrollment
     JOIN tgf_users learner ON learner.id = enrollment.user_id
       AND learner.role = 'learner' AND learner.account_status = 'active'
       AND learner.is_frozen = FALSE
     WHERE enrollment.programme_id = $1 AND enrollment.approval_status = 'approved'`,
    [programmeId],
  );
  await Promise.all(students.rows.map((student) =>
    createNotification(services, student.id, notificationType, title, body, data)));
}

async function listScheduleOccurrences(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!["administrator", "teacher", "learner"].includes(account.role)) {
    return services.jsonResponse(403, { error: "Dashboard access is required." });
  }
  const userId = account.role === "administrator" ? null : account.id;
  const result = await services.pool.query(
    `SELECT timetable.id AS timetable_id, slot.id AS slot_id,
            programme.id AS programme_id, programme.title AS programme_title,
            timetable.teacher_id, teacher.full_name AS teacher_name,
            timetable.timezone, calendar.class_date::date AS class_date,
            ((calendar.class_date::date + slot.starts_at) AT TIME ZONE timetable.timezone) AS starts_at,
            ((calendar.class_date::date + slot.ends_at) AT TIME ZONE timetable.timezone) AS ends_at,
            session.id AS session_id, session.started_at, session.ended_at,
            session.recording_status, session.recording_url,
            attendance.first_joined_at, attendance.total_seconds, attendance.current_joined_at
     FROM tgf_course_timetables timetable
     JOIN tgf_course_timetable_slots slot ON slot.timetable_id = timetable.id
     JOIN tgf_programmes programme ON programme.id = timetable.programme_id AND programme.is_active = TRUE
     JOIN tgf_users teacher ON teacher.id = timetable.teacher_id
     CROSS JOIN LATERAL generate_series(
       (NOW() AT TIME ZONE timetable.timezone)::date - 35,
       (NOW() AT TIME ZONE timetable.timezone)::date + 62,
       INTERVAL '1 day'
     ) AS calendar(class_date)
     LEFT JOIN tgf_live_sessions session
       ON session.timetable_slot_id = slot.id AND session.class_date = calendar.class_date::date
     LEFT JOIN tgf_live_session_attendance attendance
       ON attendance.session_id = session.id AND attendance.user_id = $1
     WHERE timetable.deleted_at IS NULL AND programme.deleted_at IS NULL
       AND (timetable.status = 'approved' OR session.id IS NOT NULL)
       AND slot.weekday = EXTRACT(ISODOW FROM calendar.class_date)::smallint
       AND (
         $2 = 'administrator' OR
         ($2 = 'teacher' AND timetable.teacher_id = $1) OR
         ($2 = 'learner' AND EXISTS (
           SELECT 1 FROM tgf_enrollments enrollment
           WHERE enrollment.user_id = $1 AND enrollment.programme_id = timetable.programme_id
             AND enrollment.approval_status = 'approved'
         ))
       )
     ORDER BY starts_at, programme.title`,
    [userId, account.role],
  );
  const clock = await services.pool.query<{ server_now: Date }>("SELECT NOW() AS server_now");
  const serverNow = clock.rows[0]?.server_now || new Date();
  const now = serverNow.getTime();
  return services.jsonResponse(200, {
    serverNow: serverNow.toISOString(),
    occurrences: result.rows.map((row) => {
      const startsAt = new Date(row.starts_at);
      const endsAt = new Date(row.ends_at);
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      const endedAt = row.ended_at ? new Date(row.ended_at) : null;
      const attended = Boolean(row.first_joined_at);
      const inFuture = startsAt.getTime() > now;
      return {
        timetableId: row.timetable_id,
        slotId: row.slot_id,
        programmeId: row.programme_id,
        programmeTitle: row.programme_title,
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        timezone: row.timezone,
        classDate: String(row.class_date).slice(0, 10),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        sessionId: row.session_id,
        startedAt: startedAt?.toISOString() || null,
        endedAt: endedAt?.toISOString() || null,
        sessionStatus: endedAt ? "ended" : startedAt ? "live" : "scheduled",
        recordingStatus: row.recording_status || "pending",
        attendanceStatus: attended ? "present" : endsAt.getTime() > now ? "upcoming" : "absent",
        attendanceSeconds: Number(row.total_seconds || 0) +
          (row.current_joined_at ? Math.max(0, Math.floor((now - new Date(row.current_joined_at).getTime()) / 1000)) : 0),
      };
    }),
  });
}

async function listRecordings(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const userId = account.role === "administrator" ? null : account.id;
  const result = await services.pool.query(
    `SELECT session.id, session.class_date, session.recording_status,
            session.recording_error, session.started_at,
            COALESCE(recording.duration_seconds, 0) AS recording_duration_seconds,
            programme.id AS programme_id, programme.title AS programme_title,
            teacher.id AS teacher_id, teacher.full_name AS teacher_name
     FROM tgf_live_sessions session
     JOIN tgf_programmes programme ON programme.id = session.programme_id
     JOIN tgf_users teacher ON teacher.id = session.teacher_id
     LEFT JOIN tgf_live_recordings recording ON recording.session_id = session.id
     WHERE (
       $2 = 'administrator' OR
       ($2 = 'teacher' AND session.teacher_id = $1) OR
       ($2 = 'learner' AND session.recording_status = 'ready' AND EXISTS (
         SELECT 1 FROM tgf_enrollments enrollment
         WHERE enrollment.user_id = $1 AND enrollment.programme_id = session.programme_id
           AND enrollment.approval_status = 'approved'
       ))
     )
       AND ($2 <> 'administrator' OR session.recording_hidden_from_admin_at IS NULL)
     ORDER BY session.class_date DESC, COALESCE(session.started_at, session.created_at) DESC
     LIMIT 500`,
    [userId, account.role],
  );
  return services.jsonResponse(200, {
    recordings: result.rows.map((row) => ({
      sessionId: row.id,
      classDate: String(row.class_date).slice(0, 10),
      recordingStatus: row.recording_status,
      recordingError: row.recording_error,
      programmeId: row.programme_id,
      programmeTitle: row.programme_title,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      startsAt: row.started_at,
      durationSeconds: Number(row.recording_duration_seconds || 0),
      playbackUrl: row.recording_status === "ready"
        ? `/api/collaboration/sessions/${encodeURIComponent(row.id)}/video`
        : "",
    })),
  });
}

async function dismissFailedRecording(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "administrator") {
    return services.jsonResponse(403, { error: "An administrator account is required to delete this failed recording." });
  }
  const result = await services.pool.query(
    `UPDATE tgf_live_sessions
     SET recording_hidden_from_admin_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND recording_status = 'failed'
       AND recording_hidden_from_admin_at IS NULL
     RETURNING id`,
    [sessionId],
  );
  if (!result.rowCount) {
    const existing = await services.pool.query<{ id: string; recording_status: string }>(
      "SELECT id, recording_status FROM tgf_live_sessions WHERE id = $1",
      [sessionId],
    );
    if (!existing.rows[0]) {
      return services.jsonResponse(404, { error: "This failed class recording was not found." });
    }
    if (existing.rows[0].recording_status !== "failed") {
      return services.jsonResponse(409, { error: "Only failed class recordings can be deleted from this list." });
    }
    return services.jsonResponse(200, { deleted: true });
  }
  await publishCollaborationEvent(services.pool, "administrator", "recording-dismissed", sessionId);
  return services.jsonResponse(200, { deleted: true });
}

async function joinScheduledSession(
  request: Request,
  slotId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const body = await readJson(request);
  const classDate = typeof body.classDate === "string" ? body.classDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
    return services.jsonResponse(400, { error: "Choose a valid class date." });
  }
  const schedule = await services.pool.query<{
    timetable_id: string;
    programme_id: string;
    programme_title: string;
    teacher_id: string;
    teacher_name: string;
    starts_at: Date;
    ends_at: Date;
    server_now: Date;
  }>(
    `SELECT timetable.id AS timetable_id, programme.id AS programme_id,
            programme.title AS programme_title, timetable.teacher_id,
            teacher.full_name AS teacher_name,
            (( $2::date + slot.starts_at) AT TIME ZONE timetable.timezone) AS starts_at,
            (( $2::date + slot.ends_at) AT TIME ZONE timetable.timezone) AS ends_at,
            NOW() AS server_now
     FROM tgf_course_timetable_slots slot
     JOIN tgf_course_timetables timetable ON timetable.id = slot.timetable_id
       AND timetable.status = 'approved'
     JOIN tgf_programmes programme ON programme.id = timetable.programme_id
       AND programme.is_active = TRUE
     JOIN tgf_users teacher ON teacher.id = timetable.teacher_id
       AND teacher.role = 'teacher' AND teacher.account_status = 'active'
       AND teacher.is_frozen = FALSE
     WHERE slot.id = $1 AND slot.weekday = EXTRACT(ISODOW FROM $2::date)::smallint`,
    [slotId, classDate],
  );
  const slot = schedule.rows[0];
  if (!slot) return services.jsonResponse(404, { error: "This timetable slot is unavailable." });
  let enrolled = false;
  if (account.role === "learner") {
    const enrollment = await services.pool.query(
      `SELECT 1 FROM tgf_enrollments
       WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'`,
      [account.id, slot.programme_id],
    );
    enrolled = Boolean(enrollment.rowCount);
  }
  const authorization = authorizeLiveSessionJoin({
    role: account.role,
    userId: account.id,
    teacherId: slot.teacher_id,
    enrolled,
  });
  if (!authorization.allowed ||
      (authorization.role !== "teacher" && authorization.role !== "learner" &&
       authorization.role !== "administrator")) {
    const message = account.role === "learner"
      ? "You must be enrolled in this course to join."
      : account.role === "teacher"
        ? "Only the assigned tutor can join this class."
        : "Student, tutor, or administrator access is required.";
    return services.jsonResponse(authorization.status, { error: message });
  }
  if (!isJoinWindowOpen(
    slot.server_now.getTime(),
    slot.starts_at.getTime(),
    slot.ends_at.getTime(),
  )) {
    return services.jsonResponse(403, { error: "This class can be joined 15 minutes before it starts and until it ends." });
  }

  const roomName = `tgf-live-${randomUUID()}`;
  const sessionResult = await services.pool.query<{
    id: string;
    room_name: string;
    started_at: Date | null;
    ended_at: Date | null;
    recording_status: string;
  }>(
    `INSERT INTO tgf_live_sessions
       (timetable_slot_id, programme_id, teacher_id, class_date, room_name)
     VALUES ($1, $4, $5, $2::date, $3)
     ON CONFLICT (timetable_slot_id, class_date)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, room_name, started_at, ended_at, recording_status`,
    [slotId, classDate, roomName, slot.programme_id, slot.teacher_id],
  );
  let session = sessionResult.rows[0];
  if (session.ended_at) {
    return services.jsonResponse(410, { error: "This class has ended." });
  }
  if (authorization.role === "learner" && !session.started_at) {
    if (session.recording_status === "failed") {
      return services.jsonResponse(503, {
        error: "The tutor could not start the automatic class recording. Please wait for the tutor to resolve it.",
      });
    }
    return services.jsonResponse(200, {
      waitingForTeacher: true,
      sessionId: session.id,
      roomName: session.room_name,
      programmeTitle: slot.programme_title,
      teacherName: slot.teacher_name,
      teacherId: slot.teacher_id,
      started: Boolean(session.started_at),
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      serverNow: slot.server_now,
    });
  }
  return services.jsonResponse(200, {
    transport: "mediasoup",
    socketPath: "/live-class/socket.io",
    role: authorization.role,
    sessionId: session.id,
    roomName: session.room_name,
    programmeTitle: slot.programme_title,
    teacherName: slot.teacher_name,
    teacherId: slot.teacher_id,
    started: Boolean(session.started_at),
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    serverNow: slot.server_now,
  });
}

function isBrowserRecordingConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

async function listTeacherLiveGroups(
  programmeId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Teacher access is required to manage live-class groups." });
  }
  const assignment = await services.pool.query(
    `SELECT 1
     FROM tgf_programme_teachers assignment
     JOIN tgf_programmes programme ON programme.id = assignment.programme_id
     WHERE assignment.teacher_id = $1 AND assignment.programme_id = $2
       AND programme.is_active = TRUE AND programme.deleted_at IS NULL`,
    [account.id, programmeId],
  );
  if (!assignment.rowCount) {
    return services.jsonResponse(403, { error: "You can only manage groups for an assigned course." });
  }
  const [students, groups] = await Promise.all([
    services.pool.query<{ id: string; full_name: string; email: string }>(
      `SELECT learner.id, learner.full_name, learner.email
       FROM tgf_users learner
       WHERE learner.role = 'learner' AND learner.account_status = 'active'
         AND learner.is_frozen = FALSE
         AND EXISTS (
           SELECT 1 FROM tgf_enrollments enrollment
           WHERE enrollment.user_id = learner.id
             AND enrollment.programme_id = $1
             AND enrollment.approval_status = 'approved'
         )
       ORDER BY lower(learner.full_name), learner.id`,
      [programmeId],
    ),
    services.pool.query<{ id: string; name: string; member_ids: string[] }>(
      `SELECT live_group.id, live_group.name,
              COALESCE((
                SELECT jsonb_agg(group_member.user_id::text ORDER BY lower(learner.full_name))
                FROM tgf_live_class_group_members group_member
                JOIN tgf_users learner ON learner.id = group_member.user_id
                  AND learner.role = 'learner' AND learner.account_status = 'active'
                  AND learner.is_frozen = FALSE
                WHERE group_member.group_id = live_group.id
                  AND EXISTS (
                    SELECT 1 FROM tgf_enrollments enrollment
                    WHERE enrollment.user_id = group_member.user_id
                      AND enrollment.programme_id = live_group.programme_id
                      AND enrollment.approval_status = 'approved'
                  )
              ), '[]'::jsonb) AS member_ids
       FROM tgf_live_class_groups live_group
       WHERE live_group.teacher_id = $1 AND live_group.programme_id = $2
       ORDER BY lower(live_group.name), live_group.created_at`,
      [account.id, programmeId],
    ),
  ]);
  return services.jsonResponse(200, {
    students: students.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
    })),
    groups: groups.rows.map((row) => ({
      id: row.id,
      name: row.name,
      memberIds: row.member_ids,
    })),
  });
}

async function saveTeacherLiveGroup(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Teacher access is required to manage live-class groups." });
  }
  const body = await readJson(request);
  const programmeId = typeof body.programmeId === "string" ? body.programmeId : "";
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isUuid(programmeId)) {
    return services.jsonResponse(400, { error: "Choose an assigned course." });
  }
  if (groupId && !isUuid(groupId)) {
    return services.jsonResponse(400, { error: "Choose a valid saved group." });
  }
  if (name.length < 2 || name.length > 80) {
    return services.jsonResponse(400, { error: "Enter a group name between 2 and 80 characters." });
  }
  if (!Array.isArray(body.memberIds) || body.memberIds.length === 0 || body.memberIds.length > 200 ||
      body.memberIds.some((id) => typeof id !== "string" || !isUuid(id))) {
    return services.jsonResponse(400, { error: "Select between 1 and 200 eligible students." });
  }
  const memberIds = body.memberIds as string[];
  if (new Set(memberIds).size !== memberIds.length) {
    return services.jsonResponse(400, { error: "Each student can only be selected once." });
  }

  const client = await services.pool.connect();
  try {
    await client.query("BEGIN");
    const assignment = await client.query(
      `SELECT programme.id
       FROM tgf_programme_teachers assignment
       JOIN tgf_programmes programme ON programme.id = assignment.programme_id
       WHERE assignment.teacher_id = $1 AND assignment.programme_id = $2
         AND programme.is_active = TRUE AND programme.deleted_at IS NULL
       FOR SHARE OF assignment, programme`,
      [account.id, programmeId],
    );
    if (!assignment.rowCount) {
      await client.query("ROLLBACK");
      return services.jsonResponse(403, { error: "You can only manage groups for an assigned course." });
    }

    const eligibleMembers = await client.query<{ id: string }>(
      `SELECT learner.id
       FROM unnest($2::uuid[]) AS selected(user_id)
       JOIN tgf_users learner ON learner.id = selected.user_id
         AND learner.role = 'learner' AND learner.account_status = 'active'
         AND learner.is_frozen = FALSE
       WHERE EXISTS (
         SELECT 1 FROM tgf_enrollments enrollment
         WHERE enrollment.user_id = learner.id
           AND enrollment.programme_id = $1
           AND enrollment.approval_status = 'approved'
       )
       ORDER BY learner.id
       FOR SHARE OF learner`,
      [programmeId, memberIds],
    );
    if (eligibleMembers.rowCount !== memberIds.length) {
      await client.query("ROLLBACK");
      return services.jsonResponse(400, {
        error: "Groups can include only active, approved students enrolled in this course.",
      });
    }

    let savedGroupId = groupId;
    if (groupId) {
      const updated = await client.query<{ id: string }>(
        `UPDATE tgf_live_class_groups
         SET name = $4, updated_at = NOW()
         WHERE id = $1 AND teacher_id = $2 AND programme_id = $3
         RETURNING id`,
        [groupId, account.id, programmeId, name],
      );
      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return services.jsonResponse(404, { error: "This saved group could not be found." });
      }
      savedGroupId = updated.rows[0].id;
    } else {
      const created = await client.query<{ id: string }>(
        `INSERT INTO tgf_live_class_groups (teacher_id, programme_id, name)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [account.id, programmeId, name],
      );
      savedGroupId = created.rows[0].id;
    }
    await client.query(
      `DELETE FROM tgf_live_class_group_members WHERE group_id = $1`,
      [savedGroupId],
    );
    await client.query(
      `INSERT INTO tgf_live_class_group_members (group_id, user_id)
       SELECT $1, selected.user_id
       FROM unnest($2::uuid[]) AS selected(user_id)`,
      [savedGroupId, memberIds],
    );
    await client.query("COMMIT");
    return services.jsonResponse(groupId ? 200 : 201, {
      groupId: savedGroupId,
      name,
      memberIds,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error &&
        String((error as { code: unknown }).code) === "23505") {
      return services.jsonResponse(409, { error: "A group with this name already exists for the selected course." });
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listLiveSessions(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher" && account.role !== "learner") {
    return services.jsonResponse(403, { error: "Teacher or learner access is required." });
  }
  const result = await services.pool.query<{
    id: string;
    programme_title: string;
    teacher_name: string;
    group_name: string | null;
    started_at: Date | null;
    ended_at: Date | null;
    invited_count: number;
  }>(
    `SELECT session.id, programme.title AS programme_title,
            teacher.full_name AS teacher_name, live_group.name AS group_name,
            session.started_at, session.ended_at,
            (SELECT COUNT(*)::int FROM tgf_live_session_invites invite
             WHERE invite.session_id = session.id) AS invited_count
     FROM tgf_live_sessions session
     JOIN tgf_programmes programme ON programme.id = session.programme_id
       AND programme.is_active = TRUE AND programme.deleted_at IS NULL
     JOIN tgf_users teacher ON teacher.id = session.teacher_id
       AND teacher.role = 'teacher' AND teacher.account_status = 'active'
       AND teacher.is_frozen = FALSE
     LEFT JOIN tgf_live_class_groups live_group ON live_group.id = session.group_id
     WHERE session.timetable_slot_id IS NULL
       AND session.ended_at IS NULL
       AND (
         ($2 = 'teacher' AND session.teacher_id = $1) OR
         ($2 = 'learner' AND
          (session.started_at IS NOT NULL OR session.created_at >= NOW() - INTERVAL '48 hours')
          AND EXISTS (
           SELECT 1
           FROM tgf_live_session_invites invite
           JOIN tgf_enrollments enrollment
             ON enrollment.user_id = invite.user_id
            AND enrollment.programme_id = session.programme_id
            AND enrollment.approval_status = 'approved'
           WHERE invite.session_id = session.id AND invite.user_id = $1
         ))
       )
     ORDER BY session.created_at DESC
     LIMIT 100`,
    [account.id, account.role],
  );
  return services.jsonResponse(200, {
    sessions: result.rows.map((row) => ({
      sessionId: row.id,
      programmeTitle: row.programme_title,
      teacherName: row.teacher_name,
      groupName: row.group_name,
      startedAt: row.started_at?.toISOString() || null,
      endedAt: row.ended_at?.toISOString() || null,
      invitedCount: Number(row.invited_count),
    })),
  });
}

async function createInstantSession(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only a teacher can start a live class." });
  }
  const body = await readJson(request);
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  if (!isUuid(groupId)) {
    return services.jsonResponse(400, { error: "Choose one of your saved student groups." });
  }
  const sessionId = randomUUID();
  const roomName = `tgf-live-${randomUUID()}`;
  const client = await services.pool.connect();
  let invitedStudents: string[] = [];
  let programmeTitle = "";
  try {
    await client.query("BEGIN");
    const groupResult = await client.query<{ programme_id: string; programme_title: string }>(
      `SELECT live_group.programme_id, programme.title AS programme_title
       FROM tgf_live_class_groups live_group
       JOIN tgf_programme_teachers assignment
         ON assignment.programme_id = live_group.programme_id
        AND assignment.teacher_id = live_group.teacher_id
       JOIN tgf_programmes programme
         ON programme.id = live_group.programme_id
        AND programme.is_active = TRUE AND programme.deleted_at IS NULL
       WHERE live_group.id = $1 AND live_group.teacher_id = $2
       FOR SHARE OF live_group, assignment, programme`,
      [groupId, account.id],
    );
    const group = groupResult.rows[0];
    if (!group) {
      await client.query("ROLLBACK");
      return services.jsonResponse(403, { error: "Choose a group saved for one of your assigned courses." });
    }
    programmeTitle = group.programme_title;
    const members = await client.query<{ user_id: string }>(
      `SELECT group_member.user_id
       FROM tgf_live_class_group_members group_member
       JOIN tgf_enrollments enrollment
         ON enrollment.user_id = group_member.user_id
        AND enrollment.programme_id = $2
        AND enrollment.approval_status = 'approved'
       JOIN tgf_users learner ON learner.id = group_member.user_id
         AND learner.role = 'learner' AND learner.account_status = 'active'
         AND learner.is_frozen = FALSE
       WHERE group_member.group_id = $1
       ORDER BY group_member.user_id
       FOR SHARE OF group_member, enrollment, learner`,
      [groupId, group.programme_id],
    );
    if (!members.rowCount) {
      await client.query("ROLLBACK");
      return services.jsonResponse(409, { error: "This group has no currently eligible students. Update the group and try again." });
    }
    invitedStudents = members.rows.map((row) => row.user_id);
    await client.query(
      `INSERT INTO tgf_live_sessions
         (id, timetable_slot_id, programme_id, teacher_id, group_id, class_date, room_name)
       VALUES ($1, NULL, $2, $3, $4, (NOW() AT TIME ZONE 'Africa/Douala')::date, $5)`,
      [sessionId, group.programme_id, account.id, groupId, roomName],
    );
    await client.query(
      `INSERT INTO tgf_live_session_invites (session_id, user_id)
       SELECT $1, selected.user_id
       FROM unnest($2::uuid[]) AS selected(user_id)`,
      [sessionId, invitedStudents],
    );
    await client.query(
      `INSERT INTO tgf_notifications
         (user_id, target_role, notification_type, title, body, data)
       SELECT invite.user_id, NULL, 'live-class-invitation',
              'Live class invitation',
              $2,
              jsonb_build_object('liveSessionId', $3::text, 'programmeId', $4::text)
       FROM tgf_live_session_invites invite
       WHERE invite.session_id = $1`,
      [
        sessionId,
        `${account.full_name} has invited you to a live class for ${group.programme_title}. Open the class from your dashboard; you can wait there until the tutor starts.`,
        sessionId,
        group.programme_id,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await Promise.all(invitedStudents.map((studentId) =>
    publishCollaborationEvent(services.pool, studentId, "notification")));
  return services.jsonResponse(201, {
    sessionId,
    roomName,
    programmeTitle,
    teacherName: account.full_name,
    invitedCount: invitedStudents.length,
  });
}

async function joinInstantSession(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(sessionId)) return services.jsonResponse(404, { error: "This live class was not found." });
  const result = await services.pool.query<{
    room_name: string;
    programme_id: string;
    programme_title: string;
    teacher_id: string;
    teacher_name: string;
    started_at: Date | null;
    ended_at: Date | null;
    recording_status: string;
    server_now: Date;
  }>(
    `SELECT session.room_name, session.programme_id, programme.title AS programme_title,
            session.teacher_id, teacher.full_name AS teacher_name,
            session.started_at, session.ended_at, session.recording_status,
            NOW() AS server_now
     FROM tgf_live_sessions session
     JOIN tgf_programmes programme ON programme.id = session.programme_id
       AND programme.is_active = TRUE AND programme.deleted_at IS NULL
     JOIN tgf_users teacher ON teacher.id = session.teacher_id
       AND teacher.role = 'teacher' AND teacher.account_status = 'active'
       AND teacher.is_frozen = FALSE
     WHERE session.id = $1 AND session.timetable_slot_id IS NULL`,
    [sessionId],
  );
  const session = result.rows[0];
  if (!session) return services.jsonResponse(404, { error: "This live class is unavailable." });
  if (session.ended_at) return services.jsonResponse(410, { error: "This class has ended." });

  let enrolled = false;
  let invited = false;
  if (account.role === "learner") {
    const access = await services.pool.query<{ enrolled: boolean; invited: boolean }>(
      `SELECT
         EXISTS (
           SELECT 1 FROM tgf_enrollments
           WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'
         ) AS enrolled,
         EXISTS (
           SELECT 1 FROM tgf_live_session_invites
           WHERE session_id = $3 AND user_id = $1
         ) AS invited`,
      [account.id, session.programme_id, sessionId],
    );
    enrolled = Boolean(access.rows[0]?.enrolled);
    invited = Boolean(access.rows[0]?.invited);
  }
  const authorization = authorizeLiveSessionJoin({
    role: account.role,
    userId: account.id,
    teacherId: session.teacher_id,
    enrolled,
    invited,
  });
  if (!authorization.allowed ||
      (authorization.role !== "teacher" && authorization.role !== "learner" &&
       authorization.role !== "administrator")) {
    const message = account.role === "learner"
      ? "You must be invited to this class and enrolled in the course to join."
      : account.role === "teacher"
        ? "Only the assigned tutor can join this class."
        : "Student, tutor, or administrator access is required.";
    return services.jsonResponse(authorization.status, { error: message });
  }
  if (authorization.role === "learner" &&
      (!session.started_at || session.recording_status !== "recording")) {
    if (session.recording_status === "failed") {
      return services.jsonResponse(503, {
        error: "The tutor could not start the browser recording. Please wait for the tutor to resolve it.",
      });
    }
    return services.jsonResponse(200, {
      waitingForTeacher: true,
      sessionId,
      roomName: session.room_name,
      programmeTitle: session.programme_title,
      teacherName: session.teacher_name,
      teacherId: session.teacher_id,
      serverNow: session.server_now,
    });
  }

  return services.jsonResponse(200, {
    transport: "mediasoup",
    socketPath: "/live-class/socket.io",
    role: authorization.role,
    sessionId,
    roomName: session.room_name,
    programmeTitle: session.programme_title,
    teacherName: session.teacher_name,
    teacherId: session.teacher_id,
    started: Boolean(session.started_at),
    startsAt: session.started_at?.toISOString() || session.server_now.toISOString(),
    serverNow: session.server_now.toISOString(),
  });
}

async function beginLiveSession(
  sessionId: string,
  roomName: string,
  services: CollaborationServices,
): Promise<Date | null> {
  const result = await services.pool.query<{ started_at: Date }>(
    `UPDATE tgf_live_sessions
     SET started_at = COALESCE(started_at, NOW()),
         recording_status = 'recording', recording_error = '', updated_at = NOW()
     WHERE id = $1 AND room_name = $2 AND ended_at IS NULL
       AND recording_status IN ('pending', 'recording')
     RETURNING started_at`,
    [sessionId, roomName],
  );
  const startedAt = result.rows[0]?.started_at;
  if (!startedAt) return null;
  await publishCollaborationEvent(services.pool, "administrator", "recording-started", sessionId);
  return startedAt;
}

async function startLiveSession(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the assigned tutor can start this class." });
  }
  const sessionResult = await services.pool.query<{
    room_name: string;
    teacher_id: string;
    started_at: Date | null;
    ended_at: Date | null;
    recording_status: string;
  }>(
    `SELECT session.room_name, session.teacher_id, session.started_at, session.ended_at,
            session.recording_status
     FROM tgf_live_sessions session
     LEFT JOIN tgf_course_timetable_slots slot ON slot.id = session.timetable_slot_id
     LEFT JOIN tgf_course_timetables timetable ON timetable.id = slot.timetable_id
     WHERE session.id = $1 AND
       (session.timetable_slot_id IS NULL OR timetable.status = 'approved')`,
    [sessionId],
  );
  const session = sessionResult.rows[0];
  if (!session) return services.jsonResponse(404, { error: "This live class is unavailable." });
  if (session.teacher_id !== account.id) {
    return services.jsonResponse(403, { error: "Only the assigned tutor can start this class." });
  }
  if (session.ended_at) return services.jsonResponse(409, { error: "This class has already ended." });
  const startedAt = await beginLiveSession(sessionId, session.room_name, services);
  if (!startedAt) {
    return services.jsonResponse(409, { error: "This class could not be started. Please try again." });
  }
  return services.jsonResponse(200, { started: true, startedAt });
}

async function endLiveSession(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the assigned tutor can end this class." });
  }
  const client = await services.pool.connect();
  let invitedStudents: string[] = [];
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query<{
      teacher_id: string;
      ended_at: Date | null;
    }>(
      `SELECT session.teacher_id, session.ended_at
       FROM tgf_live_sessions session
       WHERE session.id = $1
       FOR UPDATE`,
      [sessionId],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return services.jsonResponse(404, { error: "This live class is unavailable." });
    }
    if (session.teacher_id !== account.id) {
      await client.query("ROLLBACK");
      return services.jsonResponse(403, { error: "Only the assigned tutor can end this class." });
    }
    const inviteResult = await client.query<{ user_id: string }>(
      "SELECT user_id FROM tgf_live_session_invites WHERE session_id = $1",
      [sessionId],
    );
    invitedStudents = inviteResult.rows.map((row) => row.user_id);
    if (!session.ended_at) {
      await client.query(
        `UPDATE tgf_live_sessions
         SET ended_at = NOW(),
             recording_status = CASE
               WHEN recording_status IN ('recording', 'failed') THEN 'uploading'
               WHEN recording_status = 'pending' THEN 'failed'
               ELSE recording_status
             END,
             recording_error = CASE
               WHEN recording_status = 'pending' THEN 'The lesson ended before browser recording started.'
               WHEN recording_status IN ('recording', 'failed') THEN ''
               ELSE recording_error
             END,
             updated_at = NOW()
         WHERE id = $1 AND teacher_id = $2`,
        [sessionId, account.id],
      );
    }
    await client.query(
      `DELETE FROM tgf_notifications
       WHERE notification_type = 'live-class-invitation'
         AND data ->> 'liveSessionId' = $1`,
      [sessionId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await Promise.all([account.id, ...invitedStudents].map((recipient) =>
    publishCollaborationEvent(services.pool, recipient, "notification")));
  return services.jsonResponse(200, { ended: true });
}

async function updateParticipantMicrophone(
  request: Request,
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the class tutor can manage microphones." });
  }
  const body = await readJson(request);
  const participantId = typeof body.userId === "string" ? body.userId : "";
  const allowMicrophone = body.allowMicrophone;
  if ((participantId !== "all" && !isUuid(participantId)) || typeof allowMicrophone !== "boolean") {
    return services.jsonResponse(400, { error: "Choose a student and whether to allow their microphone." });
  }
  const sessionQuery = await services.pool.query<{ teacher_id: string; programme_id: string }>(
    `SELECT teacher_id, programme_id
     FROM tgf_live_sessions
     WHERE id = $1`,
    [sessionId],
  );
  const session = sessionQuery.rows[0];
  if (!session) return services.jsonResponse(404, { error: "This live class is unavailable." });
  if (account.role === "teacher" && account.id !== session.teacher_id) {
    return services.jsonResponse(403, { error: "Only the assigned tutor can manage this class." });
  }
  let updated = 0;
  if (participantId === "all") {
    updated = await services.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM tgf_enrollments
       WHERE programme_id = $1 AND approval_status = 'approved'`,
      [session.programme_id],
    ).then((result) => Number(result.rows[0]?.count || 0));
  } else {
    if (!isUuid(participantId)) {
      return services.jsonResponse(400, { error: "Choose a valid student." });
    }
    const enrolled = await services.pool.query(
      `SELECT 1 FROM tgf_enrollments
       WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'`,
      [participantId, session.programme_id],
    );
    if (!enrolled.rowCount) {
      return services.jsonResponse(403, { error: "Only an enrolled student can be unmuted." });
    }
    updated += 1;
  }
  return services.jsonResponse(200, { updated });
}

async function markParticipantJoined(
  roomName: string,
  participantId: string,
  services: CollaborationServices,
): Promise<void> {
  const session = await services.pool.query<{
    session_id: string;
    programme_id: string;
    teacher_id: string;
  }>(
    `SELECT session.id AS session_id, session.programme_id, session.teacher_id
     FROM tgf_live_sessions session
     LEFT JOIN tgf_course_timetable_slots slot ON slot.id = session.timetable_slot_id
     LEFT JOIN tgf_course_timetables timetable ON timetable.id = slot.timetable_id
     WHERE session.room_name = $1`,
    [roomName],
  );
  const row = session.rows[0];
  if (!row || !isUuid(participantId)) return;
  const participant = await services.pool.query<{
    role: string;
    account_status: string;
    is_frozen: boolean;
  }>(
    `SELECT role, account_status, is_frozen FROM tgf_users WHERE id = $1`,
    [participantId],
  );
  const user = participant.rows[0];
  if (!user || user.account_status !== "active" || user.is_frozen) return;
  if (user.role === "teacher" && participantId === row.teacher_id) {
    return;
  }
  if (user.role !== "learner") return;
  const enrollment = await services.pool.query(
    `SELECT 1 FROM tgf_enrollments
     WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'`,
    [participantId, row.programme_id],
  );
  if (!enrollment.rowCount) return;
  await services.pool.query(
    `INSERT INTO tgf_live_session_attendance
       (session_id, user_id, first_joined_at, current_joined_at, last_left_at, total_seconds)
     VALUES ($1, $2, NOW(), NOW(), NULL, 0)
     ON CONFLICT (session_id, user_id) DO UPDATE SET
       current_joined_at = COALESCE(tgf_live_session_attendance.current_joined_at, NOW()),
       last_left_at = NULL`,
    [row.session_id, participantId],
  );
}

async function markParticipantLeft(
  roomName: string,
  participantId: string,
  services: CollaborationServices,
): Promise<void> {
  if (!isUuid(participantId)) return;
  await services.pool.query(
    `UPDATE tgf_live_session_attendance attendance
     SET total_seconds = attendance.total_seconds +
           GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - attendance.current_joined_at)))::integer),
         current_joined_at = NULL, last_left_at = NOW()
     FROM tgf_live_sessions session
     WHERE session.id = attendance.session_id AND session.room_name = $1
       AND attendance.user_id = $2 AND attendance.current_joined_at IS NOT NULL`,
    [roomName, participantId],
  );
}

async function handleLiveKitWebhook(
  _request: Request,
  services: CollaborationServices,
): Promise<Response> {
  return services.jsonResponse(410, { error: "LiveKit webhooks are not used by the mediasoup live-class server." });
}

async function failRecording(
  sessionId: string,
  reason: string,
  services: CollaborationServices,
): Promise<void> {
  await services.pool.query(
    `UPDATE tgf_live_sessions
     SET recording_status = 'failed', recording_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [sessionId, reason.slice(0, 1000)],
  );
  await createNotification(
    services,
    "administrator",
    "recording-failed",
    "A class recording failed",
    reason,
    { sessionId },
  );
}

async function createRecordingReadyNotification(
  services: CollaborationServices,
  sessionId: string,
  recipientKey: string,
  userId: string | null,
  targetRole: "administrator" | null,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const client = await services.pool.connect();
  try {
    await client.query("BEGIN");
    const distribution = await client.query(
      `INSERT INTO tgf_live_recording_distributions
         (session_id, recipient_key, user_id, target_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, recipient_key) DO NOTHING
       RETURNING session_id`,
      [sessionId, recipientKey, userId, targetRole],
    );
    if (distribution.rowCount) {
      await client.query(
        `INSERT INTO tgf_notifications (user_id, target_role, notification_type, title, body, data)
         VALUES ($1, $2, 'recording-ready', $3, $4, $5::jsonb)`,
        [userId, targetRole, title, body, JSON.stringify(data)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function distributeCompletedRecording(
  sessionId: string,
  session: {
    programme_id: string;
    programme_title: string;
    teacher_id: string;
    teacher_name: string;
  },
  services: CollaborationServices,
): Promise<void> {
  const students = await services.pool.query<{ id: string }>(
    `SELECT enrollment.user_id AS id
     FROM tgf_enrollments enrollment
     JOIN tgf_users learner ON learner.id = enrollment.user_id
       AND learner.role = 'learner' AND learner.account_status = 'active'
       AND learner.is_frozen = FALSE
     WHERE enrollment.programme_id = $1 AND enrollment.approval_status = 'approved'`,
    [session.programme_id],
  );
  const data = { sessionId, programmeId: session.programme_id };
  await Promise.all(students.rows.map((student) =>
    createRecordingReadyNotification(
      services,
      sessionId,
      student.id,
      student.id,
      null,
      "A class recording is ready",
      `The ${session.programme_title} class recording is now available.`,
      data,
    )));
  await createRecordingReadyNotification(
    services,
    sessionId,
    session.teacher_id,
    session.teacher_id,
    null,
    "Your class recording is ready",
    `The ${session.programme_title} recording is available in My Live Classes.`,
    data,
  );
  await createRecordingReadyNotification(
    services,
    sessionId,
    "administrator",
    null,
    "administrator",
    "A class recording is ready",
    `${session.programme_title} · taught by ${session.teacher_name}.`,
    data,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePrivateCloudinaryRecording(
  value: unknown,
  expectedPublicId: string,
): { secureUrl: string; format: "mp4" | "webm" } | null {
  if (!isRecord(value)) return null;
  const format = typeof value.format === "string" ? value.format.toLowerCase() : "";
  if (value.public_id !== expectedPublicId ||
      value.resource_type !== "video" ||
      value.type !== "authenticated" ||
      typeof value.secure_url !== "string" ||
      typeof value.bytes !== "number" ||
      value.bytes <= 0 ||
      (format !== "mp4" && format !== "webm")) {
    return null;
  }
  try {
    const secureUrl = new URL(value.secure_url);
    if (secureUrl.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return {
    secureUrl: value.secure_url,
    format,
  };
}

async function createBrowserRecordingSignature(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the assigned tutor can upload this recording." });
  }
  const session = await services.pool.query<{
    teacher_id: string;
    ended_at: Date | null;
    recording_status: string;
  }>(
    `SELECT teacher_id, ended_at, recording_status
     FROM tgf_live_sessions WHERE id = $1`,
    [sessionId],
  );
  const row = session.rows[0];
  if (!row) return services.jsonResponse(404, { error: "This class recording was not found." });
  if (row.teacher_id !== account.id) {
    return services.jsonResponse(403, { error: "Only the assigned tutor can upload this recording." });
  }
  if (!row.ended_at || !["uploading", "failed"].includes(row.recording_status)) {
    return services.jsonResponse(409, { error: "This class is not ready to accept a browser recording." });
  }
  if (!isBrowserRecordingConfigured()) {
    return services.jsonResponse(503, { error: "Cloudinary recording storage is not configured." });
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  const publicId = `tgfvp/recordings/${sessionId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = {
    overwrite: "true",
    public_id: publicId,
    timestamp,
    type: "authenticated",
  };
  return services.jsonResponse(200, {
    apiKey,
    cloudName,
    overwrite: parameters.overwrite,
    publicId,
    signature: services.cloudinaryParameterSignature(parameters),
    timestamp,
    type: parameters.type,
  });
}

async function completeBrowserRecording(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the assigned tutor can complete this recording." });
  }
  const sessionResult = await services.pool.query<{
    programme_id: string;
    teacher_id: string;
    programme_title: string;
    teacher_name: string;
    recording_status: string;
    ended_at: Date | null;
  }>(
    `SELECT session.programme_id, session.teacher_id,
            programme.title AS programme_title, teacher.full_name AS teacher_name,
            session.recording_status, session.ended_at
     FROM tgf_live_sessions session
     JOIN tgf_programmes programme ON programme.id = session.programme_id
     JOIN tgf_users teacher ON teacher.id = session.teacher_id
     WHERE session.id = $1`,
    [sessionId],
  );
  const session = sessionResult.rows[0];
  if (!session) return services.jsonResponse(404, { error: "This class recording was not found." });
  if (session.teacher_id !== account.id) {
    return services.jsonResponse(403, { error: "Only the assigned tutor can complete this recording." });
  }
  if (!session.ended_at || !["uploading", "failed", "ready"].includes(session.recording_status)) {
    return services.jsonResponse(409, { error: "This class is not ready to complete a browser recording." });
  }
  if (!isBrowserRecordingConfigured()) {
    return services.jsonResponse(503, { error: "Cloudinary recording storage is not configured." });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  const publicId = `tgfvp/recordings/${sessionId}`;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  let uploaded: { secureUrl: string; format: "mp4" | "webm" } | null;
  try {
    const asset: unknown = await cloudinary.api.resource(publicId, {
      resource_type: "video",
      type: "authenticated",
    });
    uploaded = parsePrivateCloudinaryRecording(asset, publicId);
  } catch (error) {
    services.safeLogFailure("Browser recording verification", error);
    return services.jsonResponse(503, { error: "Cloudinary could not verify the uploaded recording. Retry the upload." });
  }
  if (!uploaded) {
    return services.jsonResponse(422, { error: "Cloudinary did not return a valid private video recording." });
  }

  const saved = await services.pool.query(
    `UPDATE tgf_live_sessions
     SET recording_status = 'ready', recording_url = $2, cloudinary_public_id = $3,
         recording_format = $4, recording_error = '',
         recording_hidden_from_admin_at = NULL, updated_at = NOW()
     WHERE id = $1 AND teacher_id = $5 AND ended_at IS NOT NULL
       AND recording_status IN ('uploading', 'failed', 'ready')
     RETURNING id`,
    [sessionId, uploaded.secureUrl, publicId, uploaded.format, account.id],
  );
  if (!saved.rowCount) {
    return services.jsonResponse(409, { error: "The class recording could not be saved." });
  }
  await distributeCompletedRecording(sessionId, session, services);
  await publishCollaborationEvent(services.pool, session.teacher_id, "recording-ready", sessionId);
  await publishCollaborationEvent(services.pool, "administrator", "recording-ready", sessionId);
  return services.jsonResponse(200, { ready: true });
}

async function failBrowserRecording(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (account.role !== "teacher") {
    return services.jsonResponse(403, { error: "Only the assigned tutor can report this recording." });
  }
  const session = await services.pool.query<{
    teacher_id: string;
    ended_at: Date | null;
    recording_status: string;
  }>(
    `SELECT teacher_id, ended_at, recording_status
     FROM tgf_live_sessions WHERE id = $1`,
    [sessionId],
  );
  const row = session.rows[0];
  if (!row) return services.jsonResponse(404, { error: "This class recording was not found." });
  if (row.teacher_id !== account.id) {
    return services.jsonResponse(403, { error: "Only the assigned tutor can report this recording." });
  }
  if (!row.ended_at || row.recording_status === "ready") {
    return services.jsonResponse(409, { error: "This class recording cannot be marked as failed." });
  }
  if (row.recording_status !== "failed") {
    await failRecording(
      sessionId,
      "The browser recording upload failed. Retry it from the tutor's live-class page while that page remains open.",
      services,
    );
  }
  return services.jsonResponse(200, { failed: true });
}

async function servePeerAttachment(
  request: Request,
  attachmentId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(attachmentId)) return services.jsonResponse(404, { error: "This attachment was not found." });
  const attachment = await services.pool.query<{
    public_id: string;
    file_name: string;
    content_type: string;
    format: string;
    user_one_id: string;
    user_two_id: string;
  }>(
    `SELECT attachment.cloudinary_public_id AS public_id,
            attachment.original_filename AS file_name, attachment.content_type,
            attachment.cloudinary_format AS format,
            conversation.user_one_id, conversation.user_two_id
     FROM tgf_peer_message_attachments attachment
     JOIN tgf_peer_messages message ON message.id = attachment.message_id
     JOIN tgf_peer_conversations conversation ON conversation.id = message.conversation_id
     WHERE attachment.id = $1`,
    [attachmentId],
  );
  const file = attachment.rows[0];
  if (!file) return services.jsonResponse(404, { error: "This attachment was not found." });
  if (account.id !== file.user_one_id && account.id !== file.user_two_id) {
    return services.jsonResponse(403, { error: "You are not a participant in this conversation." });
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
    return services.jsonResponse(503, { error: "Private message storage is not configured." });
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = {
    public_id: file.public_id,
    format: file.format,
    type: "authenticated",
    timestamp,
    expires_at: String(Math.floor(Date.now() / 1000) + 60),
  };
  const query = new URLSearchParams({
    ...parameters,
    api_key: apiKey,
    signature: services.cloudinaryParameterSignature(parameters),
  });
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const upstream = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw/download?${query}`,
    { headers, signal: AbortSignal.timeout(30000), redirect: "follow" },
  );
  if (!upstream.ok || !upstream.body) {
    services.safeLogFailure("Course attachment download", new Error(`Storage returned ${upstream.status}`));
    return services.jsonResponse(503, { error: "This attachment is temporarily unavailable." });
  }
  const safeName = file.file_name.replace(/[^\x20-\x7e]|[\r\n"\\]/g, "_").slice(0, 120);
  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${safeName}"`,
    "Content-Type": file.content_type,
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function serveRecording(
  request: Request,
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(sessionId)) return services.jsonResponse(404, { error: "This recording was not found." });
  const userId = account.role === "administrator" ? null : account.id;
  const access = await services.pool.query<{
    public_id: string;
    format: string;
    programme_id: string;
    teacher_id: string;
  }>(
    `SELECT session.cloudinary_public_id AS public_id,
            session.recording_format AS format,
            session.programme_id, session.teacher_id
     FROM tgf_live_sessions session
     WHERE session.id = $1 AND session.recording_status = 'ready'
       AND session.recording_url <> ''
       AND (
         $3 = 'administrator' OR
         ($3 = 'teacher' AND session.teacher_id = $2) OR
         ($3 = 'learner' AND EXISTS (
           SELECT 1 FROM tgf_enrollments enrollment
           WHERE enrollment.user_id = $2 AND enrollment.programme_id = session.programme_id
             AND enrollment.approval_status = 'approved'
         ))
       )`,
    [sessionId, userId, account.role],
  );
  const recording = access.rows[0];
  if (!recording) return services.jsonResponse(404, { error: "This recording is unavailable for your account." });
  if (recording.format !== "mp4" && recording.format !== "webm") {
    return services.jsonResponse(503, { error: "This recording format is not supported." });
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
    return services.jsonResponse(503, { error: "Recording storage is not configured." });
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = {
    public_id: recording.public_id,
    format: recording.format,
    type: "authenticated",
    timestamp,
    expires_at: String(Math.floor(Date.now() / 1000) + 60),
  };
  const query = new URLSearchParams({
    ...parameters,
    api_key: apiKey,
    signature: services.cloudinaryParameterSignature(parameters),
  });
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const upstream = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/video/download?${query}`,
    { headers, signal: AbortSignal.timeout(30000), redirect: "follow" },
  );
  if (!upstream.ok || !upstream.body) {
    services.safeLogFailure("Class recording playback", new Error(`Storage returned ${upstream.status}`));
    return services.jsonResponse(503, { error: "This recording is temporarily unavailable." });
  }
  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": recording.format === "webm" ? "video/webm" : "video/mp4",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function listNotifications(
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  const userId = account.role === "administrator" ? null : account.id;
  const result = await services.pool.query(
    `SELECT id, notification_type, title, body, data, created_at, read_at,
            COUNT(*) FILTER (WHERE read_at IS NULL) OVER ()::text AS unread_count
     FROM tgf_notifications
     WHERE read_at IS NULL
       AND (user_id = $1 OR (target_role = 'administrator' AND $2 = 'administrator'))
       AND NOT (
         notification_type = 'live-class-invitation'
         AND EXISTS (
           SELECT 1
           FROM tgf_live_sessions ended_session
           WHERE ended_session.id::text = tgf_notifications.data ->> 'liveSessionId'
             AND ended_session.ended_at IS NOT NULL
         )
       )
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, account.role],
  );
  return services.jsonResponse(200, {
    notifications: result.rows.map((row) => ({
      id: row.id,
      type: row.notification_type,
      title: row.title,
      body: row.body,
      data: row.data,
      createdAt: row.created_at,
      readAt: row.read_at,
    })),
    unreadCount: Number(result.rows[0]?.unread_count || 0),
  });
}

async function deleteNotification(
  notificationId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(notificationId)) return services.jsonResponse(404, { error: "This notification was not found." });
  const userId = account.role === "administrator" ? null : account.id;
  const result = await services.pool.query(
    `DELETE FROM tgf_notifications
     WHERE id = $1 AND (
       user_id = $2 OR (target_role = 'administrator' AND $3 = 'administrator')
     )
     RETURNING id`,
    [notificationId, userId, account.role],
  );
  if (!result.rowCount) return services.jsonResponse(404, { error: "This notification was not found." });
  return services.jsonResponse(200, { deleted: true });
}

async function updateDashboardPreferences(
  request: Request,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(account.id)) {
    return services.jsonResponse(403, { error: "Personal dashboard preferences require an individual account." });
  }
  if (!["teacher", "learner", "administrator"].includes(account.role)) {
    return services.jsonResponse(403, { error: "Dashboard access is required." });
  }
  if (request.method === "GET") {
    const result = await services.pool.query<{ theme: string }>(
      `SELECT theme FROM tgf_user_dashboard_preferences WHERE user_id = $1`,
      [account.id],
    );
    return services.jsonResponse(200, { theme: result.rows[0]?.theme || "light" });
  }
  if (request.method !== "PUT") {
    return services.jsonResponse(405, { error: "Method not allowed." });
  }
  const body = await readJson(request);
  const validation = validateDashboardTheme(body.theme);
  if (validation.error || !validation.theme) {
    return services.jsonResponse(400, {
      error: validation.error || "Choose light or dark mode.",
    });
  }
  await services.pool.query(
    `INSERT INTO tgf_user_dashboard_preferences (user_id, theme, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       theme = EXCLUDED.theme, updated_at = NOW()`,
    [account.id, validation.theme],
  );
  return services.jsonResponse(200, { theme: validation.theme });
}

function getRecordingPartMinutes(): number {
  const value = Number(process.env.RECORDING_PART_MINUTES || 15);
  return Number.isInteger(value) && value >= 1 && value <= 60 ? value : 15;
}

function getRecordingDirectory(sessionId: string): string {
  const root = path.resolve(process.env.LIVE_CLASS_RECORDING_DIR || "./var/live-recordings");
  return path.join(root, sessionId);
}

async function recordingSessionForTeacher(
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
) {
  if (account.role !== "teacher" || !isUuid(account.id)) {
    return null;
  }
  const result = await services.pool.query<{
    id: string;
    teacher_id: string;
    programme_id: string;
    course_title: string;
    class_date: string;
    started_at: Date;
  }>(
    `SELECT session.id, session.teacher_id, session.programme_id,
            programme.title AS course_title,
            COALESCE(session.class_date, (NOW() AT TIME ZONE 'Africa/Douala')::date)::text AS class_date,
            COALESCE(session.started_at, NOW()) AS started_at
     FROM tgf_live_sessions session
     JOIN tgf_programmes programme ON programme.id = session.programme_id
     WHERE session.id = $1 AND session.teacher_id = $2`,
    [sessionId, account.id],
  );
  return result.rows[0] || null;
}

async function receiveRecordingChunk(
  request: Request,
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(sessionId)) return services.jsonResponse(404, { error: "This live class was not found." });
  const session = await recordingSessionForTeacher(sessionId, account, services);
  if (!session) return services.jsonResponse(403, { error: "Only the assigned teacher can upload this recording." });
  const form = await request.formData();
  const blob = form.get("chunk");
  const elapsedSeconds = Number(form.get("elapsedSeconds") || 0);
  const chunkNumber = Number(form.get("chunkNumber"));
  if (!(blob instanceof Blob) || blob.size === 0) {
    return services.jsonResponse(400, { error: "A non-empty recording chunk is required." });
  }
  if (!Number.isSafeInteger(chunkNumber) || chunkNumber < 1 || chunkNumber > 1_000_000) {
    return services.jsonResponse(400, { error: "The recording chunk number is invalid." });
  }
  if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds < 0 ||
      elapsedSeconds > getRecordingPartMinutes() * 60 * 100) {
    return services.jsonResponse(400, { error: "The recording time is invalid." });
  }
  const partNumber = Math.max(1, Math.floor(elapsedSeconds / (getRecordingPartMinutes() * 60)) + 1);
  const directory = getRecordingDirectory(sessionId);

  const recordingResult = await services.pool.query<{ id: string }>(
    `INSERT INTO tgf_live_recordings
       (session_id, programme_id, teacher_id, course_title, class_date, started_at, upload_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::date, $6::timestamptz, 'recording')
     ON CONFLICT (session_id) DO UPDATE SET updated_at = NOW(), upload_status = 'recording'
     RETURNING id`,
    [sessionId, session.programme_id, session.teacher_id, session.course_title,
      session.class_date, session.started_at],
  );
  const recordingId = recordingResult.rows[0]?.id;
  if (!recordingId) throw new Error("The live recording could not be initialized.");

  await saveRecordingChunkFile(directory, chunkNumber, Buffer.from(await blob.arrayBuffer()));

  await services.pool.query(
    `INSERT INTO tgf_live_recording_chunks
       (recording_id, chunk_number, part_number, elapsed_seconds, file_size_bytes)
     VALUES ($1::uuid, $2::integer, $3::smallint, $4::integer, $5::bigint)
     ON CONFLICT (recording_id, chunk_number) DO NOTHING`,
    [recordingId, chunkNumber, partNumber, elapsedSeconds, blob.size],
  );
  await services.pool.query(
    `INSERT INTO tgf_live_recording_parts
       (recording_id, part_number, part_title, upload_status)
       SELECT $1::uuid, $2::integer,
              $3::text || ' - Part ' || $2::integer::text,
            'pending'
     WHERE EXISTS (SELECT 1 FROM tgf_live_recordings WHERE id = $1::uuid)
     ON CONFLICT (recording_id, part_number) DO UPDATE SET updated_at = NOW()`,
    [recordingId, partNumber, `${session.course_title} - ${session.class_date}`],
  );
  return services.jsonResponse(200, { received: true, partNumber, chunkNumber });
}

async function finalizeRecording(
  request: Request,
  sessionId: string,
  account: CollaborationAccount,
  services: CollaborationServices,
): Promise<Response> {
  if (!isUuid(sessionId)) return services.jsonResponse(404, { error: "This live class was not found." });
  const session = await recordingSessionForTeacher(sessionId, account, services);
  if (!session) return services.jsonResponse(403, { error: "Only the assigned teacher can finalize this recording." });

  const lockClient = await services.pool.connect();
  let lockAcquired = false;
  try {
    await lockClient.query("SELECT pg_advisory_lock(hashtextextended($1::text, 0))", [sessionId]);
    lockAcquired = true;
    const recordingResult = await services.pool.query<{ id: string; upload_status: string }>(
      `SELECT id, upload_status FROM tgf_live_recordings WHERE session_id = $1`,
      [sessionId],
    );
    if (recordingResult.rows[0]?.upload_status === "ready") {
      return services.jsonResponse(200, { uploaded: true, parts: [] });
    }
    return await finalizeRecordingParts(sessionId, session, services, recordingResult.rows[0] || null);
  } finally {
    try {
      if (lockAcquired) {
        await lockClient.query("SELECT pg_advisory_unlock(hashtextextended($1::text, 0))", [sessionId]);
      }
    } finally {
      lockClient.release();
    }
  }
}

async function finalizeRecordingParts(
  sessionId: string,
  session: NonNullable<Awaited<ReturnType<typeof recordingSessionForTeacher>>>,
  services: CollaborationServices,
  recording: { id: string; upload_status: string } | null,
): Promise<Response> {
  if (!recording) {
    return services.jsonResponse(409, { error: "No recording chunks were received from this class." });
  }
  await services.pool.query(
    `UPDATE tgf_live_recordings
     SET upload_status = 'uploading', ended_at = NOW(),
         duration_seconds = GREATEST(duration_seconds, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::integer)),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId],
  );

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  if (!cloudName || !apiKey || !apiSecret) {
    await services.pool.query(
      `UPDATE tgf_live_recordings SET upload_status = 'failed',
         last_error = 'Cloudinary is not configured.', updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId],
    );
    return services.jsonResponse(503, { error: "Cloudinary is not configured. Recording chunks remain available." });
  }

  const directory = getRecordingDirectory(sessionId);
  const recordingId = recording.id;
  const parts = await services.pool.query<{ part_number: number; part_title: string }>(
    `SELECT part_number, part_title
     FROM tgf_live_recording_parts
     WHERE recording_id = $1
     ORDER BY part_number`,
    [recordingId],
  );
  const uploadedParts: Array<{ partNumber: number; url: string }> = [];
  for (const part of parts.rows) {
    const filePath = path.join(directory, `part-${part.part_number}.webm`);
    try {
      const chunks = await services.pool.query<{ chunk_number: number }>(
        `SELECT chunk_number
         FROM tgf_live_recording_chunks
         WHERE recording_id = $1 AND part_number = $2
         ORDER BY chunk_number`,
        [recordingId, part.part_number],
      );
      if (chunks.rowCount) {
        await assembleRecordingPartFile(
          directory,
          part.part_number,
          chunks.rows.map((chunk) => chunk.chunk_number),
        );
      }
      const file = await stat(filePath);
      if (!file.isFile() || file.size === 0) throw new Error("The recording part is empty.");
      let uploaded: { secure_url?: string; public_id?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const publicId = `tgfvp/live-classes/${sessionId}/part-${part.part_number}`;
          uploaded = await cloudinary.uploader.upload_large(filePath, {
            resource_type: "video",
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            chunk_size: 5 * 1024 * 1024,
            filename_override: `${part.part_title}.webm`,
            tags: ["tgfvp", "live-class", session.course_title],
          }) as unknown as { secure_url?: string; public_id?: string };
          break;
        } catch (uploadError) {
          if (attempt === 2) throw uploadError;
          await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        }
      }
      if (!uploaded?.secure_url) throw new Error("Cloudinary did not return a secure recording URL.");
      await services.pool.query(
        `UPDATE tgf_live_recording_parts
         SET secure_url = $3, cloudinary_public_id = $4, file_size_bytes = $5,
             upload_status = 'ready', last_error = '', updated_at = NOW()
         WHERE recording_id = $1 AND part_number = $2`,
        [recordingId, part.part_number, uploaded.secure_url, uploaded.public_id || "",
          file.size],
      );
      uploadedParts.push({ partNumber: part.part_number, url: uploaded.secure_url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The recording part could not be uploaded.";
      await services.pool.query(
        `UPDATE tgf_live_recording_parts
         SET upload_status = 'failed', last_error = $3, updated_at = NOW()
         WHERE recording_id = $1 AND part_number = $2`,
        [recordingId, part.part_number, message.slice(0, 1000)],
      );
    }
  }

  const allPartsReady = uploadedParts.length === parts.rows.length;
  await services.pool.query(
    `UPDATE tgf_live_recordings
     SET upload_status = $2, updated_at = NOW(),
         last_error = CASE WHEN $2 = 'failed' THEN 'One or more recording parts failed to upload.' ELSE '' END
     WHERE session_id = $1`,
    [sessionId, allPartsReady ? "ready" : "failed"],
  );

  if (allPartsReady) {
    await rm(directory, { recursive: true, force: true });
  }
  return services.jsonResponse(allPartsReady ? 200 : 502, allPartsReady
    ? { uploaded: true, parts: uploadedParts }
    : { uploaded: false, parts: uploadedParts, error: "One or more recording parts failed to upload." });
}

export async function handleCollaborationRequest(
  request: Request,
  services: CollaborationServices,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "collaboration") return null;

  const isWebhook = pathname === "/api/collaboration/livekit/webhook";
  if (isWebhook && request.method !== "POST") {
    return services.jsonResponse(405, { error: "Method not allowed." });
  }
  if (!isWebhook && (request.method === "POST" || request.method === "PUT") &&
      !services.hasSameOrigin(request)) {
    return services.jsonResponse(403, { error: "This request must come from the TGFVP website." });
  }

  try {
    await services.ensureSchema();
    if (isWebhook) return await handleLiveKitWebhook(request, services);

    const account = await services.getAccountForSession(request);
    if (!isActiveAccount(account)) {
      return services.jsonResponse(401, { error: "Sign in with an active account to continue." });
    }

    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "recording-chunk" &&
        request.method === "POST") {
      return await receiveRecordingChunk(request, segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "recording-finalize" &&
        request.method === "POST") {
      return await finalizeRecording(request, segments[3], account, services);
    }

    if (pathname === "/api/collaboration/events" && request.method === "GET") {
      return openRealtimeStream(request, account, services);
    }
    if (pathname === "/api/collaboration/chat/contacts" && request.method === "GET") {
      const search = new URL(request.url).searchParams.get("search")?.trim() || "";
      return await listChatContacts(account, search, services);
    }
    if (pathname === "/api/collaboration/chat/conversations" && request.method === "GET") {
      return await listPeerConversations(account, services);
    }
    if (pathname === "/api/collaboration/chat/conversations" && request.method === "POST") {
      return await createPeerConversation(request, account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 4).join("/") === "api/collaboration/chat/conversations" &&
        request.method === "GET" && isUuid(segments[4])) {
      return await getPeerConversation(segments[4], account, services);
    }
    if (segments.length === 6 &&
        segments.slice(0, 4).join("/") === "api/collaboration/chat/conversations" &&
        segments[5] === "messages" && request.method === "POST" && isUuid(segments[4])) {
      return await sendPeerMessage(request, segments[4], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 4).join("/") === "api/collaboration/chat/attachments" &&
        request.method === "GET") {
      return await servePeerAttachment(request, segments[4], account, services);
    }
    if (pathname === "/api/collaboration/timetable") {
      if (request.method === "GET") return await listTimetables(account, services);
      if (request.method === "POST") return await submitTimetable(request, account, services);
      return services.jsonResponse(405, { error: "Method not allowed." });
    }
    if (segments.length === 4 &&
        segments.slice(0, 3).join("/") === "api/collaboration/timetable" &&
        (request.method === "DELETE" || request.method === "PUT")) {
      return request.method === "DELETE"
        ? await deleteTimetable(request, segments[3], account, services)
        : await updateTimetable(request, segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/timetable" &&
        segments[4] === "review" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This timetable was not found." });
      return await reviewTimetable(request, segments[3], account, services);
    }
    if (pathname === "/api/collaboration/schedule" && request.method === "GET") {
      return await listScheduleOccurrences(account, services);
    }
    if (pathname === "/api/collaboration/recordings" && request.method === "GET") {
      return await listRecordings(account, services);
    }
    if (segments.length === 4 &&
        segments.slice(0, 3).join("/") === "api/collaboration/recordings" &&
        request.method === "DELETE") {
      if (!services.hasSameOrigin(request)) {
        return services.jsonResponse(403, { error: "This request must come from the TGFVP website." });
      }
      if (!isUuid(segments[3])) {
        return services.jsonResponse(404, { error: "This failed class recording was not found." });
      }
      return await dismissFailedRecording(segments[3], account, services);
    }
    if (pathname === "/api/collaboration/notifications" && request.method === "GET") {
      return await listNotifications(account, services);
    }
    if (pathname === "/api/collaboration/preferences") {
      return await updateDashboardPreferences(request, account, services);
    }
    if (pathname === "/api/collaboration/live-sessions" && request.method === "GET") {
      return await listLiveSessions(account, services);
    }
    if (pathname === "/api/collaboration/live-sessions" && request.method === "POST") {
      return await createInstantSession(request, account, services);
    }
    if (pathname === "/api/collaboration/live-groups" && request.method === "GET") {
      const programmeId = new URL(request.url).searchParams.get("programmeId") || "";
      if (!isUuid(programmeId)) return services.jsonResponse(400, { error: "Choose an assigned course." });
      return await listTeacherLiveGroups(programmeId, account, services);
    }
    if (pathname === "/api/collaboration/live-groups" && request.method === "POST") {
      return await saveTeacherLiveGroup(request, account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/live-sessions" &&
        segments[4] === "join" && request.method === "POST") {
      return await joinInstantSession(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/notifications" &&
        segments[4] === "read" && request.method === "POST") {
      return await deleteNotification(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "join" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This timetable slot was not found." });
      return await joinScheduledSession(request, segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "start" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await startLiveSession(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "recording-signature" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await createBrowserRecordingSignature(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "recording-complete" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await completeBrowserRecording(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "recording-failed" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await failBrowserRecording(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "end" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await endLiveSession(segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "microphone" && request.method === "POST") {
      if (!isUuid(segments[3])) return services.jsonResponse(404, { error: "This live class was not found." });
      return await updateParticipantMicrophone(request, segments[3], account, services);
    }
    if (segments.length === 5 &&
        segments.slice(0, 3).join("/") === "api/collaboration/sessions" &&
        segments[4] === "video" && request.method === "GET") {
      return await serveRecording(request, segments[3], account, services);
    }
    if (pathname.startsWith("/api/collaboration/")) {
      return services.jsonResponse(405, { error: "Method not allowed or route not found." });
    }
    return null;
  } catch (error) {
    return errorResponse(services, "Collaboration API", error, "The collaboration request could not be completed.");
  }
}
