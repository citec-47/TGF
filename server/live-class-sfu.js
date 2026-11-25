import { Server as SocketIOServer } from "socket.io";
import * as mediasoup from "mediasoup";
import { authenticateLiveClassCookie } from "./live-class-auth.js";
import { getLiveClassConfig, isLiveClassUuid } from "./live-class-validation.js";
import {
  listLiveSessionAttendees,
  markLiveSessionParticipantJoined,
  markLiveSessionParticipantLeft,
} from "./live-session-attendance.js";

const rooms = new Map();

function uniqueParticipants(room) {
  return [...room.participants.values()]
    .map(({ id, name, role, micAllowed, cameraOn, raisedHand, profilePhotoUrl }) => ({
      id,
      name,
      role,
      micAllowed,
      cameraOn,
      raisedHand,
      profilePhotoUrl,
    }));
}

export async function createLiveClassSfu(httpServer, pool) {
  const config = getLiveClassConfig();
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
    cors: false,
    transports: ["websocket", "polling"],
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

  async function authorize(socket, sessionId) {
    const user = await authenticateLiveClassCookie(
      socket.handshake.headers.cookie,
      pool,
      { secret: process.env.SESSION_SECRET || "", production: process.env.NODE_ENV === "production" },
    );
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
  }

  io.on("connection", (socket) => {
    socket.on("live-class:join", async (payload, ack) => {
      let sessionId;
      let attendanceStarted = false;
      let attendanceParticipantId;
      let participantRegistered = false;
      try {
        sessionId = payload?.sessionId;
        if (!isLiveClassUuid(sessionId)) throw new Error("Choose a valid live class.");
        const authorization = await authorize(socket, sessionId);
        if ([...rooms.values()].reduce((count, candidate) =>
          count + (candidate.sessionId === sessionId ? candidate.participants.size : 0), 0) >= config.maxStudents + 1) {
          throw new Error("This live class is full.");
        }
        const room = await getRoom(sessionId);
        if (authorization.session.started_at && !room.started) {
          room.started = true;
        }
        if (authorization.role === "teacher") room.teacherId = authorization.user.id;
        if (authorization.role === "student") {
          await markLiveSessionParticipantJoined(pool, sessionId, authorization.user.id);
          attendanceStarted = true;
          attendanceParticipantId = authorization.user.id;
        }
        const attendees = await listLiveSessionAttendees(pool, sessionId);
        await socket.join(sessionId);
        if (!socket.connected) {
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
          micAllowed: authorization.role === "teacher",
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
            teacherName: authorization.session.teacher_name } });
        socket.to(sessionId).emit("live-class:participant-state", {
          id: authorization.user.id,
          name: authorization.user.full_name,
          role: authorization.role,
          profilePhotoUrl: authorization.user.profile_photo_url || "",
          micAllowed: authorization.role === "teacher",
          cameraOn: false,
          raisedHand: false,
        });
        io.to(sessionId).emit("live-class:attendees", attendees);
      } catch (error) {
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
        transport.on("dtlsstatechange", (state) => {
          if (state === "closed" || state === "failed") participant.transports.delete(transport.id);
        });
        ack?.({ ok: true, params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        } });
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
          throw new Error("Teacher unmuted you.");
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

    socket.on("live-class:chat", (payload) => {
      const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, 500) : "";
      if (!body) return;
      for (const room of rooms.values()) {
        const participant = room.participants.get(socket.id);
        if (!participant) continue;
        const message = {
          participantId: participant.id,
          name: participant.name,
          role: participant.role,
          profilePhotoUrl: participant.profilePhotoUrl || "",
          body,
        };
        io.to(room.sessionId).emit("live-class:chat", message);
        break;
      }
    });

    socket.on("live-class:mute", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].map(([sessionId, room]) => ({
          sessionId,
          room,
        })).find(({ room }) => room.participants.get(socket.id)?.role === "teacher");
        if (!entry) throw new Error("Only the teacher can control microphones.");
        const targetId = payload?.participantId;
        const allow = payload?.allow === true;
        for (const participant of entry.room.participants.values()) {
          if (targetId !== "all" && participant.id !== targetId) continue;
          participant.micAllowed = allow;
          const targetSocket = [...entry.room.participants.entries()]
            .find(([, item]) => item === participant)?.[0];
          io.to(targetSocket).emit("live-class:microphone", {
            allowed: allow,
            message: allow ? "Teacher unmuted you" : "Teacher muted you",
          });
        }
        io.to(entry.sessionId).emit("live-class:participants", uniqueParticipants(entry.room));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Microphone control failed." });
      }
    });

    socket.on("live-class:start", async (payload, ack) => {
      try {
        const entry = [...rooms.entries()].find(([, room]) => room.participants.get(socket.id)?.role === "teacher");
        if (!entry) throw new Error("Only the assigned teacher can start this class.");
        entry[1].started = true;
        await pool.query(
          `UPDATE tgf_live_sessions
           SET started_at = COALESCE(started_at, NOW()), recording_status = 'recording', updated_at = NOW()
           WHERE id = $1 AND ended_at IS NULL`,
          [entry[0]],
        );
        io.to(entry[0]).emit("live-class:started", { started: true });
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
        room.participants.delete(socket.id);
        io.to(sessionId).emit("live-class:participants", uniqueParticipants(room));
        if (participant.role === "student" &&
            ![...room.participants.values()].some((item) => item.id === participant.id && item.role === "student")) {
          try {
            await markLiveSessionParticipantLeft(pool, sessionId, participant.id);
            io.to(sessionId).emit("live-class:attendees", await listLiveSessionAttendees(pool, sessionId));
          } catch (error) {
            console.error("Could not save live-class attendance after disconnect.", error);
          }
        }
        break;
      }
    });
  });

  return io;
}
