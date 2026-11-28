import { cpus } from "node:os";
import { Server as SocketIOServer } from "socket.io";
import { authenticateLiveClassCookie } from "./live-class-auth.js";
import { getLiveClassConfig, isLiveClassUuid } from "./live-class-validation.js";
import {
  listLiveSessionAttendees,
  markLiveSessionParticipantJoined,
  markLiveSessionParticipantLeft,
} from "./live-session-attendance.js";

const rooms = new Map();

function uniqueParticipants(room) {
  return [...room.participants.values()].map((participant) => ({
    id: participant.id,
    name: participant.name,
    role: participant.role,
    micAllowed: participant.micAllowed,
    microphoneOn: participant.microphoneOn,
    cameraOn: participant.cameraOn,
    screenOn: participant.screenOn,
    raisedHand: participant.raisedHand,
    profilePhotoUrl: participant.profilePhotoUrl,
    gender: participant.gender,
  }));
}

function findParticipant(socketId) {
  for (const [sessionId, room] of rooms) {
    const participant = room.participants.get(socketId);
    if (participant) return { sessionId, room, participant };
  }
  return null;
}

function syncParticipantState(io, sessionId, room, participant) {
  const producers = [...participant.producers.values()];
  participant.microphoneOn = producers.some((producer) =>
    producer.kind === "audio" && producer.appData.source === "microphone" && !producer.paused);
  participant.cameraOn = producers.some((producer) =>
    producer.kind === "video" && producer.appData.source === "camera" && !producer.paused);
  participant.screenOn = producers.some((producer) =>
    producer.kind === "video" && producer.appData.source === "screen" && !producer.paused);
  io.to(sessionId).emit(
    "live-class:participant-state",
    uniqueParticipants(room).find((entry) => entry.id === participant.id && entry.role === participant.role),
  );
}

export async function createLiveClassSfu(httpServer, pool) {
  const config = getLiveClassConfig();
  if (!config.enabled) return null;

  const { createWorker } = await import("mediasoup");
  const workerCount = Math.max(1, Math.min(2, cpus().length));
  const workers = [];
  try {
    for (let index = 0; index < workerCount; index += 1) {
      const worker = await createWorker({
        logLevel: "warn",
        rtcMinPort: config.minPort,
        rtcMaxPort: config.maxPort,
      });
      worker.on("died", () => {
        console.error("A live-class media worker stopped unexpectedly.");
      });
      workers.push(worker);
    }
  } catch (error) {
    for (const worker of workers) worker.close();
    throw error;
  }

  const io = new SocketIOServer(httpServer, {
    path: "/live-class/socket.io",
    cors: false,
    transports: ["websocket", "polling"],
  });
  let workerIndex = 0;

  async function getSessionRow(sessionId) {
    const result = await pool.query(
      `SELECT session.id, session.room_name, session.programme_id, session.teacher_id,
              session.started_at, session.ended_at, session.class_status,
              programme.title AS programme_title, teacher.full_name AS teacher_name
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
    if (!user || user.must_change_password) throw new Error("Sign in with an active account to join this class.");
    const session = await getSessionRow(sessionId);
    if (!session) throw new Error("This live class was not found.");
    if (session.ended_at || session.class_status === "ended" || session.class_status === "cancelled") {
      throw new Error("This class has ended.");
    }
    if (session.class_status !== "live" || !session.started_at) {
      throw new Error("Wait for the tutor to start this class.");
    }
    if (user.role === "teacher") {
      if (user.id !== session.teacher_id) throw new Error("Only the assigned tutor can join this class.");
      return { user, session, role: "teacher", micAllowed: true };
    }
    if (user.role === "learner") {
      const enrollment = await pool.query(
        `SELECT 1
         FROM tgf_enrollments
         WHERE user_id = $1 AND programme_id = $2 AND approval_status = 'approved'`,
        [user.id, session.programme_id],
      );
      if (!enrollment.rowCount) throw new Error("You must be enrolled in this course.");
      return {
        user,
        session,
        role: "student",
        micAllowed: false,
      };
    }
    throw new Error("Student or tutor access is required.");
  }

  async function getRoom(session) {
    let room = rooms.get(session.id);
    if (room) return room;
    const worker = workers[workerIndex % workers.length];
    workerIndex += 1;
    const router = await worker.createRouter({
      mediaCodecs: [
        { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
        { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: { xGoogleStartBitrate: 1000 } },
        {
          kind: "video",
          mimeType: "video/H264",
          clockRate: 90000,
          parameters: { packetizationMode: 1, profileLevelId: "42e01f" },
        },
      ],
    });
    room = {
      sessionId: session.id,
      router,
      participants: new Map(),
      started: session.class_status === "live" || Boolean(session.started_at),
    };
    rooms.set(session.id, room);
    return room;
  }

  io.on("connection", (socket) => {
    socket.on("live-class:join", async (payload, ack) => {
      let sessionId = "";
      let studentAttendanceStarted = false;
      let studentId = "";
      let joinedRoom = null;
      let joinedParticipant = null;
      try {
        sessionId = payload?.sessionId;
        if (!isLiveClassUuid(sessionId)) throw new Error("Choose a valid live class.");
        if (findParticipant(socket.id)) throw new Error("This connection has already joined a live class.");
        const authorization = await authorize(socket, sessionId);
        const room = await getRoom(authorization.session);
        joinedRoom = room;
        const participantCount = [...room.participants.values()]
          .filter((participant) => participant.role === "student").length;
        if (authorization.role === "student" && participantCount >= config.maxStudents) {
          throw new Error("This live class is full.");
        }
        if (authorization.role === "student") {
          await markLiveSessionParticipantJoined(pool, sessionId, authorization.user.id);
          studentAttendanceStarted = true;
          studentId = authorization.user.id;
        }

        const participant = {
          id: authorization.user.id,
          name: authorization.user.full_name,
          role: authorization.role,
          profilePhotoUrl: authorization.user.profile_photo_url || "",
          gender: authorization.user.gender || "unspecified",
          micAllowed: authorization.micAllowed,
          microphoneOn: false,
          cameraOn: false,
          screenOn: false,
          raisedHand: false,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };
        joinedParticipant = participant;
        room.participants.set(socket.id, participant);
        await socket.join(sessionId);

        ack?.({
          ok: true,
          participantId: participant.id,
          role: participant.role,
          microphoneAllowed: participant.micAllowed,
          rtcCapabilities: room.router.rtpCapabilities,
          iceServers: config.iceServers,
          participants: uniqueParticipants(room),
          attendees: await listLiveSessionAttendees(pool, sessionId),
          producers: [...room.participants.values()].flatMap((entry) =>
            [...entry.producers.values()]
              .filter((producer) => !producer.closed && !producer.paused)
              .map((producer) => ({
                participantId: entry.id,
                producerId: producer.id,
                kind: producer.kind,
                name: entry.name,
                role: entry.role,
                source: producer.appData.source,
              }))),
          started: room.started,
          session: {
            programmeTitle: authorization.session.programme_title,
            teacherName: authorization.session.teacher_name,
          },
        });
        socket.to(sessionId).emit("live-class:participant-state", uniqueParticipants(room)
          .find((entry) => entry.id === participant.id && entry.role === participant.role));
        io.to(sessionId).emit("live-class:participants", uniqueParticipants(room));
        io.to(sessionId).emit("live-class:attendees", await listLiveSessionAttendees(pool, sessionId));
      } catch (error) {
        if (joinedRoom && joinedParticipant) {
          joinedRoom.participants.delete(socket.id);
          for (const resource of [
            ...joinedParticipant.producers.values(),
            ...joinedParticipant.consumers.values(),
            ...joinedParticipant.transports.values(),
          ]) {
            if (!resource.closed) resource.close();
          }
          if (joinedRoom.participants.size === 0) {
            joinedRoom.router.close();
            rooms.delete(sessionId);
          }
        }
        if (studentAttendanceStarted) {
          try {
            await markLiveSessionParticipantLeft(pool, sessionId, studentId);
          } catch (cleanupError) {
            console.error("Could not clean up attendance after a failed class join.", cleanupError);
          }
        }
        ack?.({
          ok: false,
          error: error instanceof Error ? error.message : "The live class could not be joined.",
        });
      }
    });

    socket.on("live-class:create-transport", async (payload, ack) => {
      try {
        const entry = findParticipant(socket.id);
        if (!entry) throw new Error("Join the live class before creating media.");
        if (payload?.direction !== "send" && payload?.direction !== "receive") {
          throw new Error("Choose a valid media direction.");
        }
        const transport = await entry.room.router.createWebRtcTransport({
          listenIps: [{ ip: config.listenIp, announcedIp: config.announcedIp || undefined }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          appData: { socketId: socket.id, direction: payload.direction },
        });
        entry.participant.transports.set(transport.id, transport);
        transport.on("routerclose", () => entry.participant.transports.delete(transport.id));
        transport.on("dtlsstatechange", (state) => {
          if (state === "closed" || state === "failed") entry.participant.transports.delete(transport.id);
        });
        ack?.({
          ok: true,
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            iceServers: config.iceServers,
          },
        });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media transport could not be created." });
      }
    });

    socket.on("live-class:connect-transport", async (payload, ack) => {
      try {
        const entry = findParticipant(socket.id);
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
        const entry = findParticipant(socket.id);
        const transport = entry?.participant.transports.get(payload?.transportId);
        if (!entry || !transport) throw new Error("Join the class and create a send transport first.");
        if (payload.kind !== "audio" && payload.kind !== "video") throw new Error("This media type is not supported.");
        const source = payload.source === "screen"
          ? "screen"
          : payload.kind === "video" ? "camera" : "microphone";
        if (source === "microphone" && !entry.participant.micAllowed) {
          throw new Error("The tutor has muted your microphone.");
        }
        if (source === "screen" && entry.participant.role !== "teacher") {
          throw new Error("Only the tutor can share a screen.");
        }
        const producer = await transport.produce({
          kind: payload.kind,
          rtpParameters: payload.rtpParameters,
          appData: { participantId: entry.participant.id, source },
        });
        entry.participant.producers.set(producer.id, producer);
        const updateState = () => {
          if (entry.room.participants.get(socket.id) === entry.participant) {
            syncParticipantState(io, entry.sessionId, entry.room, entry.participant);
          }
        };
        producer.observer.on("pause", updateState);
        producer.observer.on("resume", updateState);
        producer.observer.on("close", () => {
          entry.participant.producers.delete(producer.id);
          updateState();
        });
        updateState();
        socket.to(entry.sessionId).emit("live-class:new-producer", {
          participantId: entry.participant.id,
          producerId: producer.id,
          kind: producer.kind,
          name: entry.participant.name,
          role: entry.participant.role,
          source,
        });
        ack?.({ ok: true, producerId: producer.id });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Your media could not be shared." });
      }
    });

    socket.on("live-class:consume", async (payload, ack) => {
      try {
        const entry = findParticipant(socket.id);
        if (!entry) throw new Error("Join the live class before receiving media.");
        const transport = entry.participant.transports.get(payload?.transportId);
        if (!transport) throw new Error("Receive transport was not found.");
        const producer = [...entry.room.participants.values()]
          .flatMap((participant) => [...participant.producers.values()])
          .find((candidate) => candidate.id === payload?.producerId);
        if (!producer) throw new Error("The shared media was not found.");
        if (!entry.room.router.canConsume({
          producerId: producer.id,
          rtpCapabilities: payload.rtpCapabilities,
        })) {
          throw new Error("This media cannot be received by your browser.");
        }
        const consumer = await transport.consume({
          producerId: producer.id,
          rtpCapabilities: payload.rtpCapabilities,
          paused: true,
          appData: { source: producer.appData.source },
        });
        entry.participant.consumers.set(consumer.id, consumer);
        consumer.on("transportclose", () => entry.participant.consumers.delete(consumer.id));
        consumer.on("producerclose", () => entry.participant.consumers.delete(consumer.id));
        ack?.({
          ok: true,
          params: {
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            appData: consumer.appData,
          },
        });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media could not be received." });
      }
    });

    socket.on("live-class:resume-consumer", async (payload, ack) => {
      try {
        const entry = findParticipant(socket.id);
        const consumer = entry?.participant.consumers.get(payload?.consumerId);
        if (!consumer) throw new Error("The media stream is no longer available.");
        await consumer.resume();
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Media could not be resumed." });
      }
    });

    socket.on("live-class:video-mode", async (payload, ack) => {
      try {
        const entry = findParticipant(socket.id);
        if (!entry) throw new Error("Join the live class before changing your camera.");
        const enabled = payload?.enabled === true;
        for (const producer of entry.participant.producers.values()) {
          if (producer.kind !== "video" || producer.appData.source !== "camera") continue;
          if (enabled && producer.paused) await producer.resume();
          else if (!enabled && !producer.paused) await producer.pause();
        }
        syncParticipantState(io, entry.sessionId, entry.room, entry.participant);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Your camera could not be updated." });
      }
    });

    socket.on("live-class:raised-hand", (raised) => {
      const entry = findParticipant(socket.id);
      if (!entry) return;
      entry.participant.raisedHand = Boolean(raised);
      io.to(entry.sessionId).emit("live-class:participants", uniqueParticipants(entry.room));
    });

    socket.on("live-class:mute", async (payload, ack) => {
      try {
        const teacherEntry = findParticipant(socket.id);
        if (!teacherEntry || teacherEntry.participant.role !== "teacher") {
          throw new Error("Only the assigned tutor can control student microphones.");
        }
        const targetId = payload?.participantId;
        const allowed = payload?.allow === true;
        if (targetId !== "all" && !isLiveClassUuid(targetId)) {
          throw new Error("Choose a student and whether to allow their microphone.");
        }
        const targets = [...teacherEntry.room.participants.entries()]
          .filter(([, participant]) => participant.role === "student" &&
            (targetId === "all" || participant.id === targetId));
        if (targetId !== "all" && !targets.length) throw new Error("That student is not currently in class.");
        for (const [socketId, participant] of targets) {
          participant.micAllowed = allowed;
          await pool.query(
            `UPDATE tgf_live_session_attendance
             SET microphone_allowed = $3
             WHERE session_id = $1 AND user_id = $2 AND participant_role = 'learner'`,
            [teacherEntry.sessionId, participant.id, allowed],
          );
          for (const producer of participant.producers.values()) {
            if (producer.kind !== "audio" || producer.appData.source !== "microphone") continue;
            if (allowed && producer.paused) await producer.resume();
            else if (!allowed && !producer.paused) await producer.pause();
          }
          io.to(socketId).emit("live-class:microphone", {
            allowed,
            message: allowed ? "Your microphone is enabled by the tutor." : "Your microphone was muted by the tutor.",
          });
        }
        io.to(teacherEntry.sessionId).emit("live-class:participants", uniqueParticipants(teacherEntry.room));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : "Microphone control failed." });
      }
    });

    socket.on("disconnect", async () => {
      const entry = findParticipant(socket.id);
      if (!entry) return;
      for (const resource of [
        ...entry.participant.producers.values(),
        ...entry.participant.consumers.values(),
        ...entry.participant.transports.values(),
      ]) {
        if (!resource.closed) resource.close();
      }
      entry.room.participants.delete(socket.id);
      io.to(entry.sessionId).emit("live-class:participants", uniqueParticipants(entry.room));
      if (entry.participant.role === "student") {
        try {
          await markLiveSessionParticipantLeft(pool, entry.sessionId, entry.participant.id);
          io.to(entry.sessionId).emit(
            "live-class:attendees",
            await listLiveSessionAttendees(pool, entry.sessionId),
          );
        } catch (error) {
          console.error("Could not save live-class attendance after disconnect.", error);
        }
      }
      if (entry.room.participants.size === 0) {
        entry.room.router.close();
        rooms.delete(entry.sessionId);
      }
    });
  });

  return io;
}
