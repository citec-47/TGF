import { Server as SocketIOServer } from "socket.io";
import * as mediasoup from "mediasoup";
import {
  authenticateLiveClassUser,
  readLiveClassSocketTicket,
} from "./live-class-auth.js";
import { getLiveClassConfig, isLiveClassUuid } from "./live-class-validation.js";
import {
  listLiveSessionAttendees,
  markLiveSessionParticipantJoined,
  markLiveSessionParticipantLeft,
} from "./live-session-attendance.js";

const rooms = new Map();
const roomInitializations = new Map();
const debugEnabled = process.env.LIVE_CLASS_DEBUG === "true";

function logEvent(event, details = {}) {
  if (debugEnabled) console.info("[live-class]", event, details);
}

function uniqueParticipants(room) {
  const participants = new Map();
  for (const { id, name, role, micAllowed, cameraOn, raisedHand, profilePhotoUrl } of room.participants.values()) {
    participants.set(id, {
      id,
      name,
      role,
      micAllowed,
      cameraOn,
      raisedHand,
      profilePhotoUrl,
    });
  }
  return [...participants.values()];
}

export async function createLiveClassSfu(httpServer, pool) {
  const config = getLiveClassConfig();
  const allowedOrigins = new Set(config.webOrigins);
  const workerCount = Math.max(1, Math.min(2, (globalThis.navigator?.hardwareConcurrency || 2)));
  const workers = [];
  for (let index = 0; index < workerCount; index += 1) {
    const worker = await mediasoup.createWorker({
      logLevel: "warn",
      rtcMinPort: config.minPort,
      rtcMaxPort: config.maxPort,
    });
    worker.on("died", () => {
      console.error("Mediasoup worker stopped unexpectedly.");
    });
    workers.push(worker);
  }
  let workerIndex = 0;

  const io = new SocketIOServer(httpServer, {
    path: "/live-class/socket.io",
    cors: {
      origin: config.webOrigins,
      methods: ["GET", "POST"],
      credentials: false,
    },
    allowRequest(request, callback) {
      const origin = request.headers.origin;
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const requestHost = (request.headers["x-forwarded-host"] || request.headers.host || "")
          .split(",")[0]
          .trim();
        const forwardedProtocol = (request.headers["x-forwarded-proto"] || "")
          .split(",")[0]
          .trim();
        const protocol = forwardedProtocol
          ? `${forwardedProtocol}:`
          : request.socket.encrypted ? "https:" : "http:";
        const originUrl = new URL(origin);
        const sameOrigin = originUrl.host === requestHost && originUrl.protocol === protocol;
        callback(sameOrigin ? null : "Live-class origin is not allowed.", sameOrigin);
      } catch {
        callback("Live-class origin is not allowed.", false);
      }
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const ticket = readLiveClassSocketTicket(
      socket.handshake.auth?.socketTicket,
      { secret: process.env.SESSION_SECRET || "" },
    );
    if (!ticket) {
      next(new Error("Live-class authorization ticket is invalid or expired. Rejoin the class."));
      return;
    }
    socket.data.liveClassTicket = ticket;
    next();
  });

  async function getSessionRow(sessionId) {
    const result = await pool.query(
      `SELECT session.id, session.room_name, session.programme_id, session.teacher_id,
              session.started_at, session.ended_at, programme.title AS programme_title,
              teacher.full_name AS teacher_name
       FROM tgf_live_sessions session
       JOIN tgf_programmes programme ON programme.id = session.programme_id
         AND programme.is_active = TRUE AND programme.deleted_at IS NULL
       JOIN tgf_users teacher ON teacher.id = session.teacher_id
         AND teacher.role = 'teacher' AND teacher.account_status = 'active'
         AND teacher.is_frozen = FALSE
       WHERE session.id = $1`,
      [sessionId],
    );
    return result.rows[0] || null;
  }

  async function getChatMessages(sessionId, viewer) {
    const result = await pool.query(
      `SELECT message.id, message.sender_user_id, message.body, message.created_at,
              sender.full_name, sender.email,
              COALESCE(
                NULLIF(to_jsonb(sender)->>'profile_photo_url', ''),
                NULLIF(to_jsonb(sender)->>'teacher_profile_photo_url', ''),
                ''
              ) AS profile_photo_url,
              sender.role
       FROM tgf_live_session_chat_messages message
       JOIN tgf_users sender ON sender.id = message.sender_user_id
       WHERE message.session_id = $1
       ORDER BY message.created_at, message.id`,
      [sessionId],
    );
    const showAllEmails = process.env.LIVE_CLASS_CHAT_SHOW_STUDENT_EMAILS?.trim().toLowerCase() === "true";
    return result.rows.map((row) => ({
      id: row.id,
      senderId: row.sender_user_id,
      name: row.full_name,
      email: showAllEmails || viewer.role === "teacher" || viewer.role === "administrator" ||
        viewer.id === row.sender_user_id ? row.email : "",
      role: row.role,
      profilePhotoUrl: row.profile_photo_url || "",
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async function authorize(socket, sessionId) {
    const ticket = socket.data.liveClassTicket;
    if (!ticket || ticket.sessionId !== sessionId) {
      throw new Error("This live-class authorization ticket is for a different class. Rejoin the class.");
    }
    const user = await authenticateLiveClassUser(ticket.userId, pool);
    if (!user) throw new Error("Sign in to join this live class.");
    const session = await getSessionRow(sessionId);
    if (!session) throw new Error("This live class was not found.");
    if (session.ended_at) throw new Error("This class has ended.");

    if (user.role === "administrator") {
      return { user, session, role: "administrator" };
    }
    if (user.role === "teacher") {
      if (user.id !== session.teacher_id) throw new Error("Only the assigned teacher can join as teacher.");
      return { user, session, role: "teacher" };
    }
    if (user.role === "learner") {
      const enrollment = await pool.query(
        `SELECT 1
         FROM tgf_enrollments
         WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'`,
        [user.id, session.programme_id],
      );
      if (!enrollment.rowCount) throw new Error("You must be enrolled in this course.");
      return { user, session, role: "student" };
    }
    throw new Error("Student, teacher or administrator access is required.");
  }

  async function getRoom(sessionId) {
    let room = rooms.get(sessionId);
    if (room) return room;
    const pending = roomInitializations.get(sessionId);
    if (pending) return pending;
    const initialization = (async () => {
      const worker = workers[workerIndex % workers.length];
      workerIndex += 1;
      const router = await worker.createRouter({
        mediaCodecs: [
          { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
          { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: { xGoogleStartBitrate: 1000 } },
          { kind: "video", mimeType: "video/H264", clockRate: 90000, parameters: { packetizationMode: 1, profileLevelId: "42e01f" } },
        ],
      });
      room = {
        sessionId,
        router,
        participants: new Map(),
        started: false,
        teacherId: null,
      };
      rooms.set(sessionId, room);
      return room;
    })();
    roomInitializations.set(sessionId, initialization);
    try {
      return await initialization;
    } finally {
      roomInitializations.delete(sessionId);
    }
  }

  io.on("connection", (socket) => {
    socket.on("live-class:join", async (payload, ack) => {
      let sessionId;
      let attendanceStarted = false;
      let attendanceParticipantId;
      let participantRegistered = false;
      let roomJoined = false;
      try {
        sessionId = payload?.sessionId;
        if (!isLiveClassUuid(sessionId)) throw new Error("Choose a valid live class.");
        const authorization = await authorize(socket, sessionId);
        if ([...rooms.values()].reduce((count, candidate) =>
          count + (candidate.sessionId === sessionId ? candidate.participants.size : 0), 0) >= config.maxStudents + 1) {
          throw new Error("This live class is full.");
        }
        await socket.join(sessionId);
        roomJoined = true;
        if (!socket.connected) {
          await socket.leave(sessionId);
          return;
        }
        const room = await getRoom(sessionId);
        const currentSession = await getSessionRow(sessionId);
        if (!currentSession || currentSession.ended_at) throw new Error("This class has ended.");
        room.started = Boolean(currentSession.started_at);
        if (authorization.role === "teacher") room.teacherId = authorization.user.id;
        if (authorization.role === "student") {
          await markLiveSessionParticipantJoined(pool, sessionId, authorization.user.id);
          attendanceStarted = true;
          attendanceParticipantId = authorization.user.id;
        }
        const attendees = await listLiveSessionAttendees(pool, sessionId);
        const attendee = attendees.find(({ id }) => id === authorization.user.id);
        const micAllowed = authorization.role !== "student" || attendee?.microphoneAllowed === true;
        const chatMessages = await getChatMessages(sessionId, authorization.user);
        if (!socket.connected) {
          await socket.leave(sessionId);
          roomJoined = false;
          if (attendanceStarted) {
            await markLiveSessionParticipantLeft(pool, sessionId, authorization.user.id);
            attendanceStarted = false;
          }
          return;
        }
        room.participants.set(socket.id, {
          id: authorization.user.id,
          name: authorization.user.full_name,
          role: authorization.role,
          profilePhotoUrl: authorization.user.profile_photo_url || "",
          micAllowed,
          cameraOn: false,
          videoEnabled: true,
          raisedHand: false,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        });
        participantRegistered = true;
        ack?.({ ok: true, participantId: authorization.user.id, role: authorization.role, rtcCapabilities: room.router.rtpCapabilities,
          iceServers: config.iceServers, participants: uniqueParticipants(room), attendees,
          producers: [...room.participants.values()].flatMap((participant) =>
            [...participant.producers.values()]
              .filter((producer) => !producer.paused)
              .map((producer) => ({
                participantId: participant.id,
                producerId: producer.id,
                kind: producer.kind,
                name: participant.name,
                role: participant.role,
                source: producer.appData.source,
              }))),
          started: room.started, session: { programmeTitle: authorization.session.programme_title,
            teacherName: authorization.session.teacher_name }, chatMessages });
        logEvent("participant joined", {
          sessionId,
          participantId: authorization.user.id,
          role: authorization.role,
          started: room.started,
        });
        socket.to(sessionId).emit("live-class:participant-state", {
          id: authorization.user.id,
          name: authorization.user.full_name,
          role: authorization.role,
          profilePhotoUrl: authorization.user.profile_photo_url || "",
          micAllowed,
          cameraOn: false,
          raisedHand: false,
        });
        io.to(sessionId).emit("live-class:attendees", attendees);
      } catch (error) {
        if (roomJoined && !participantRegistered) {
          await socket.leave(sessionId);
        }
        if (attendanceStarted && !participantRegistered) {
          try {
            const participant = rooms.get(sessionId)?.participants.get(socket.id);
            if (!participant) {
              await markLiveSessionParticipantLeft(pool, sessionId, attendanceParticipantId);
            }
          } catch (cleanupError) {
            console.error("Could not clean up attendance after a failed class join.", cleanupError);
          }
        }
        ack?.({ ok: false, error: error instanceof Error ? error.message : "The live class could not be joined." });
      }
    });

    socket.on("live-class:create-transport", async (payload, ack) => {
      try {
        const participant = [...rooms.values()]
          .map((room) => room.participants.get(socket.id))
          .find(Boolean);
        if (!participant) throw new Error("Join the live class before creating media.");
        const sessionId = [...rooms.entries()].find(([, room]) => room.participants.has(socket.id))?.[0];
        const room = await getRoom(sessionId);
        const transport = await room.router.createWebRtcTransport({
          listenIps: [{ ip: config.listenIp, announcedIp: config.announcedIp || undefined }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          appData: { socketId: socket.id, direction: payload?.direction || "send" },
        });
        participant.transports.set(transport.id, transport);
        transport.on("routerclose", () => participant.transports.delete(transport.id));
        transport.on("icestatechange", (state) => {
          logEvent("ICE state", { sessionId, participantId: participant.id, direction: payload?.direction, state });
        });
        transport.on("dtlsstatechange", (state) => {
          logEvent("DTLS state", { sessionId, participantId: participant.id, direction: payload?.direction, state });
          if (state === "closed" || state === "failed") participant.transports.delete(transport.id);
        });
        ack?.({ ok: true, params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }, iceServers: config.iceServers });
        logEvent("transport created", { sessionId, participantId: participant.id, direction: payload?.direction });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media transport could not be created." });
      }
    });

    socket.on("live-class:connect-transport", async (payload, ack) => {
      try {
        const entry = [...rooms.values()].map((room) => ({
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        const transport = entry?.participant.transports.get(payload?.transportId);
        if (!transport) throw new Error("Media transport was not found.");
        await transport.connect({ dtlsParameters: payload.dtlsParameters });
        logEvent("transport connected", { participantId: entry.participant.id, transportId: transport.id });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media transport could not connect." });
      }
    });

    socket.on("live-class:produce", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        const transport = entry?.participant.transports.get(payload?.transportId);
        if (!transport) throw new Error("Send transport was not found.");
        if (payload.kind === "audio" && entry.participant.role !== "teacher" &&
            !entry.participant.micAllowed) {
          throw new Error("The tutor has muted your microphone.");
        }
        const producer = await transport.produce({
          kind: payload.kind,
          rtpParameters: payload.rtpParameters,
          paused: payload.kind === "video" && !entry.participant.videoEnabled,
          appData: {
            participantId: entry.participant.id,
            source: payload.kind === "video" && payload.source === "screen" ? "screen" : "camera",
          },
        });
        entry.participant.producers.set(producer.id, producer);
        logEvent("media produced", {
          sessionId: entry.sessionId,
          participantId: entry.participant.id,
          kind: payload.kind,
          producerId: producer.id,
        });
        const syncCameraState = () => {
          if (payload.kind !== "video") return;
          entry.participant.cameraOn = entry.participant.videoEnabled &&
            [...entry.participant.producers.values()].some((item) => item.kind === "video" && !item.paused);
          io.to(entry.sessionId).emit("live-class:participant-state",
            uniqueParticipants(entry.room).find((item) => item.id === entry.participant.id));
        };
        producer.observer.on("pause", syncCameraState);
        producer.observer.on("resume", syncCameraState);
        producer.observer.on("close", () => {
          entry.participant.producers.delete(producer.id);
          syncCameraState();
        });
        syncCameraState();
        socket.to(entry.sessionId).emit("live-class:new-producer", {
          participantId: entry.participant.id,
          producerId: producer.id,
          kind: payload.kind,
          name: entry.participant.name,
          role: entry.participant.role,
          source: producer.appData.source,
        });
        ack?.({ ok: true, producerId: producer.id });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Your media could not be shared." });
      }
    });

    socket.on("live-class:consume", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        if (!entry) throw new Error("Join the live class before consuming media.");
        const transport = entry.participant.transports.get(payload?.transportId);
        if (!transport) throw new Error("Receive transport was not found.");
        const producer = [...entry.room.participants.values()]
          .flatMap((participant) => [...participant.producers.values()])
          .find((candidate) => candidate.id === payload.producerId);
        if (!producer) throw new Error("The shared media was not found.");
        if (!entry.room.router.canConsume({ producerId: payload.producerId, rtpCapabilities: payload.rtpCapabilities })) {
          throw new Error("This media cannot be received.");
        }
        const consumer = await transport.consume({
          producerId: payload.producerId,
          rtpCapabilities: payload.rtpCapabilities,
          paused: producer.kind === "video" && !entry.participant.videoEnabled,
        });
        entry.participant.consumers.set(consumer.id, consumer);
        consumer.on("transportclose", () => entry.participant.consumers.delete(consumer.id));
        consumer.on("producerclose", () => entry.participant.consumers.delete(consumer.id));
        ack?.({ ok: true, params: {
          id: consumer.id,
          producerId: payload.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        } });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media could not be received." });
      }
    });

    socket.on("live-class:video-mode", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        if (!entry) throw new Error("Join the live class before changing video quality.");
        const enabled = payload?.enabled === true;
        entry.participant.videoEnabled = enabled;
        for (const producer of entry.participant.producers.values()) {
          if (producer.kind !== "video") continue;
          if (enabled && producer.paused) await producer.resume();
          else if (!enabled && !producer.paused) await producer.pause();
        }
        for (const consumer of entry.participant.consumers.values()) {
          if (consumer.kind !== "video") continue;
          if (enabled && consumer.paused) await consumer.resume();
          else if (!enabled && !consumer.paused) await consumer.pause();
        }
        entry.participant.cameraOn = enabled && [...entry.participant.producers.values()]
          .some((producer) => producer.kind === "video" && !producer.paused);
        io.to(entry.sessionId).emit("live-class:participant-state",
          uniqueParticipants(entry.room).find((participant) => participant.id === entry.participant.id));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Video quality could not be updated." });
      }
    });

    socket.on("live-class:raised-hand", (raised) => {
      for (const room of rooms.values()) {
        const participant = room.participants.get(socket.id);
        if (!participant) continue;
        participant.raisedHand = Boolean(raised);
        io.to(room.sessionId).emit("live-class:participant-state", uniqueParticipants(room)
          .find((item) => item.id === participant.id));
      }
    });

    socket.on("live-class:chat-published", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        if (!entry) throw new Error("Join the live class before sending chat.");
        if (!isLiveClassUuid(payload?.messageId)) throw new Error("The chat message ID is invalid.");
        const result = await pool.query(
          `SELECT message.id, message.sender_user_id, message.body, message.created_at,
                  sender.full_name, sender.email,
                  COALESCE(
                    NULLIF(to_jsonb(sender)->>'profile_photo_url', ''),
                    NULLIF(to_jsonb(sender)->>'teacher_profile_photo_url', ''),
                    ''
                  ) AS profile_photo_url,
                  sender.role
           FROM tgf_live_session_chat_messages message
           JOIN tgf_users sender ON sender.id = message.sender_user_id
           WHERE message.id = $1 AND message.session_id = $2`,
          [payload.messageId, entry.sessionId],
        );
        const row = result.rows[0];
        if (!row || row.sender_user_id !== entry.participant.id) {
          throw new Error("Only the message sender can share it with the class.");
        }
        const showAllEmails = process.env.LIVE_CLASS_CHAT_SHOW_STUDENT_EMAILS?.trim().toLowerCase() === "true";
        for (const [targetSocket, recipient] of entry.room.participants.entries()) {
          io.to(targetSocket).emit("live-class:chat", {
            id: row.id,
            senderId: row.sender_user_id,
            name: row.full_name,
            email: showAllEmails || recipient.role === "teacher" ||
              recipient.role === "administrator" || recipient.id === row.sender_user_id ? row.email : "",
            role: row.role,
            profilePhotoUrl: row.profile_photo_url || "",
            body: row.body,
            createdAt: new Date(row.created_at).toISOString(),
          });
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "The chat message could not be shared." });
      }
    });

    socket.on("live-class:mute", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
        })).find(({ room }) => {
          const role = room.participants.get(socket.id)?.role;
          return role === "teacher" || role === "administrator";
        });
        if (!entry) throw new Error("Only the teacher or an administrator can control microphones.");
        const targetId = payload?.participantId;
        const allow = payload?.allow === true;
        if (targetId !== "all" && !isLiveClassUuid(targetId)) {
          throw new Error("Choose a valid student or all students.");
        }
        const participants = [...entry.room.participants.entries()]
          .filter(([, participant]) => participant.role === "student" &&
            (targetId === "all" || participant.id === targetId));
        if (targetId !== "all" && participants.length === 0) {
          throw new Error("That student is no longer connected to this class.");
        }
        if (targetId === "all") {
          await pool.query(
            `UPDATE tgf_live_session_attendance
             SET microphone_allowed = $2
             WHERE session_id = $1 AND participant_role = 'learner'`,
            [entry.sessionId, allow],
          );
        } else {
          await pool.query(
            `UPDATE tgf_live_session_attendance
             SET microphone_allowed = $3
             WHERE session_id = $1 AND user_id = $2 AND participant_role = 'learner'`,
            [entry.sessionId, targetId, allow],
          );
        }
        for (const [targetSocket, participant] of participants) {
          participant.micAllowed = allow;
          if (!allow) {
            for (const producer of participant.producers.values()) {
              if (producer.kind === "audio" && !producer.paused) await producer.pause();
            }
          }
          io.to(targetSocket).emit("live-class:microphone", {
            allowed: allow,
            message: allow ? "Teacher unmuted you" : "Teacher muted you",
          });
        }
        io.to(entry.sessionId).emit("live-class:participants", uniqueParticipants(entry.room));
        logEvent("microphone permission changed", { sessionId: entry.sessionId, targetId, allow });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Microphone control failed." });
      }
    });

    socket.on("live-class:microphone-self", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
          participant: room.participants.get(socket.id),
        })).find(({ participant }) => participant);
        if (!entry) throw new Error("Join the live class before changing your microphone.");
        if (typeof payload?.enabled !== "boolean") throw new Error("Choose whether your microphone is on.");
        if (entry.participant.role === "student" && !entry.participant.micAllowed) {
          throw new Error("The tutor has muted your microphone.");
        }
        for (const producer of entry.participant.producers.values()) {
          if (producer.kind !== "audio") continue;
          if (payload.enabled && producer.paused) await producer.resume();
          else if (!payload.enabled && !producer.paused) await producer.pause();
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "The microphone state could not be updated." });
      }
    });

    socket.on("live-class:start", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].find(([, room]) => room.participants.get(socket.id)?.role === "teacher");
        if (!entry) throw new Error("Only the assigned teacher can start this class.");
        const session = await pool.query(
          `SELECT started_at, ended_at
           FROM tgf_live_sessions
           WHERE id = $1`,
          [entry[0]],
        );
        if (!session.rows[0]?.started_at || session.rows[0].ended_at) {
          throw new Error("Start the class from the classroom controls first.");
        }
        entry[1].started = true;
        io.to(entry[0]).emit("live-class:started", { started: true });
        logEvent("class started", { sessionId: entry[0] });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "The class could not be started." });
      }
    });

    socket.on("live-class:end", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].find(([, room]) => room.participants.get(socket.id)?.role === "teacher");
        if (!entry) throw new Error("Only the assigned teacher can end this class.");
        const participant = entry[1].participants.get(socket.id);
        const result = await pool.query(
          `SELECT teacher_id, ended_at
           FROM tgf_live_sessions
           WHERE id = $1`,
          [entry[0]],
        );
        const session = result.rows[0];
        if (!session || session.teacher_id !== participant.id || !session.ended_at) {
          throw new Error("End the class from the classroom controls before notifying participants.");
        }
        entry[1].started = false;
        io.to(entry[0]).emit("live-class:ended", { ended: true });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "The class could not be ended." });
      }
    });

    socket.on("disconnect", async () => {
      for (const [sessionId, room] of rooms.entries()) {
        const participant = room.participants.get(socket.id);
        if (!participant) continue;
        for (const consumer of participant.consumers.values()) consumer.close();
        for (const producer of participant.producers.values()) producer.close();
        for (const transport of participant.transports.values()) transport.close();
        room.participants.delete(socket.id);
        io.to(sessionId).emit("live-class:participants", uniqueParticipants(room));
        logEvent("participant disconnected", { sessionId, participantId: participant.id, role: participant.role });
        if (participant.role === "student" &&
            ![...room.participants.values()].some((item) => item.id === participant.id && item.role === "student")) {
          try {
            await markLiveSessionParticipantLeft(pool, sessionId, participant.id);
            io.to(sessionId).emit("live-class:attendees", await listLiveSessionAttendees(pool, sessionId));
          } catch (error) {
            console.error("Could not save live-class attendance after disconnect.", error);
          }
        }
        if (room.participants.size === 0) {
          room.router.close();
          rooms.delete(sessionId);
        }
        break;
      }
    });
  });

  return {
    close: async () => {
      await new Promise((resolve) => io.close(resolve));
      for (const worker of workers) worker.close();
    },
  };
}
