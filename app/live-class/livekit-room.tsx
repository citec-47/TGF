"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type Participant,
} from "livekit-client";

interface JoinResponse {
  role?: "teacher" | "learner" | "administrator";
  sessionId: string;
  roomName: string;
  programmeTitle: string;
  teacherName: string;
  teacherId: string;
  started?: boolean;
  startedAt?: string;
  startsAt?: string;
  waitingForTeacher?: boolean;
  serverUrl?: string;
  token?: string;
}

interface SessionAttendee {
  id: string;
  name: string;
  firstJoinedAt: string;
  attendanceSeconds: number;
}

interface ParticipantEntry {
  participant: Participant;
  local: boolean;
}

interface LiveClassChatMessage {
  id: string;
  senderId: string;
  name: string;
  email: string;
  profilePhotoUrl: string;
  role: "teacher" | "learner" | "administrator";
  body: string;
  createdAt: string;
}

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "failed" | "waiting";

async function postJson<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

async function requestJoin(url: string, body: object): Promise<JoinResponse> {
  return postJson<JoinResponse>(url, body);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "TGF";
}

function mergeChatMessages(
  current: LiveClassChatMessage[],
  incoming: LiveClassChatMessage[],
): LiveClassChatMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return Array.from(messages.values()).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function ChatAvatar({ message }: { message: LiveClassChatMessage }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!message.profilePhotoUrl || imageFailed) {
    return <span className="livekit-chat-avatar livekit-chat-avatar-fallback" aria-hidden="true">
      {initials(message.name)}
    </span>;
  }
  return (
    <img
      className="livekit-chat-avatar"
      src={message.profilePhotoUrl}
      alt=""
      onError={() => setImageFailed(true)}
    />
  );
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function VideoTrackView({
  participant,
  className,
  muted,
}: {
  participant: Participant;
  className: string;
  muted: boolean;
}) {
  const elementRef = useRef<HTMLVideoElement>(null);
  const track = participant.getTrackPublication(Track.Source.Camera)?.track;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return <video ref={elementRef} className={className} autoPlay playsInline muted={muted} />;
}

function ParticipantAudio({ participant, local }: ParticipantEntry) {
  const elementRef = useRef<HTMLAudioElement>(null);
  const track = local
    ? undefined
    : participant.getTrackPublication(Track.Source.Microphone)?.track;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return <audio ref={elementRef} autoPlay aria-hidden="true" />;
}

export default function LiveKitClassRoom() {
  const search = useSearchParams();
  const sessionIdParam = search.get("sessionId") || "";
  const slotId = search.get("slotId") || "";
  const classDate = search.get("date") || "";
  const retryUrl = useRef("");
  const retryBody = useRef<object>({});
  const roomRef = useRef<Room | null>(null);
  const cameraWantedRef = useRef(true);
  const audioOnlyRef = useRef(false);
  const reconnectTimerRef = useRef<number>(0);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [info, setInfo] = useState<JoinResponse | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [chatMessages, setChatMessages] = useState<LiveClassChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [failedChatMessage, setFailedChatMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const isTeacher = info?.role === "teacher";
  const isAdministrator = info?.role === "administrator";
  const dashboardUrl = isTeacher ? "/teacher" : isAdministrator ? "/admin" : "/student";
  const joinUrl = sessionIdParam
    ? `/api/collaboration/live-sessions/${encodeURIComponent(sessionIdParam)}/join`
    : `/api/collaboration/sessions/${encodeURIComponent(slotId)}/join`;
  const joinBody = sessionIdParam ? {} : { classDate };
  retryUrl.current = joinUrl;
  retryBody.current = joinBody;

  useEffect(() => {
    const messages = chatMessagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    let cancelled = false;
    let intentionalDisconnect = false;
    let attendanceActive = false;
    let attendanceSessionId = "";
    let waitTimer = 0;
    let attendanceTimer = 0;
    let room: Room | null = null;
    const postAttendance = async (
      sessionId: string,
      action: "join" | "leave",
      keepalive = false,
    ) => {
      const response = await fetch(
        `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/attendance/${action}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          keepalive,
        },
      );
      if (!response.ok && action === "join") {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "Your attendance could not be recorded.");
      }
    };

    const refreshAttendees = async (sessionId: string) => {
      try {
        const response = await fetch(
          `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/attendance`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!response.ok) return;
        const result = await response.json() as { attendees?: SessionAttendee[] };
        if (!cancelled) setAttendees(result.attendees || []);
      } catch {
        if (!cancelled) setNotice("Attendance updates are temporarily unavailable.");
      }
    };

    const refreshChat = async (sessionId: string) => {
      try {
        const response = await fetch(
          `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/chat`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const result = await response.json() as {
          messages?: LiveClassChatMessage[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Chat history could not be loaded.");
        if (!cancelled) {
          setChatMessages((current) => mergeChatMessages(current, result.messages || []));
          setChatError("");
        }
      } catch (chatLoadError) {
        if (!cancelled) {
          setChatError(chatLoadError instanceof Error
            ? chatLoadError.message
            : "Chat history could not be loaded.");
        }
      }
    };

    const refreshChatMessage = async (sessionId: string, messageId: string) => {
      try {
        const response = await fetch(
          `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/chat/${encodeURIComponent(messageId)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const result = await response.json() as {
          message?: LiveClassChatMessage;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "A new chat message could not be loaded.");
        if (!cancelled && result.message) {
          setChatMessages((current) => mergeChatMessages(current, [result.message!]));
        }
      } catch (chatLoadError) {
        if (!cancelled) {
          setChatError(chatLoadError instanceof Error
            ? chatLoadError.message
            : "A new chat message could not be loaded.");
        }
      }
    };

    const connect = async () => {
      setConnecting(true);
      setConnectionStatus("connecting");
      setError("");
      try {
        const credentials = await requestJoin(joinUrl, joinBody);
        if (cancelled) return;
        setInfo(credentials);
        setStarted(Boolean(credentials.started));
        void refreshChat(credentials.sessionId);
        if (credentials.waitingForTeacher) {
          setConnecting(false);
          setConnectionStatus("waiting");
          setNotice("Your tutor has not started the class yet. This page will join automatically when the class begins.");
          waitTimer = window.setTimeout(() => void connect(), 3000);
          return;
        }
        if (!credentials.serverUrl || !credentials.token) {
          throw new Error("The video service returned incomplete connection details.");
        }

        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        if (process.env.NODE_ENV !== "production") {
          console.debug("[live-class] joining room", {
            sessionId: credentials.sessionId,
            roomName: credentials.roomName,
            role: credentials.role,
          });
        }
        const refreshParticipants = () => {
          if (!room || cancelled) return;
          const nextParticipants = [
            { participant: room.localParticipant, local: true },
            ...Array.from(room.remoteParticipants.values())
              .map((participant) => ({ participant, local: false })),
          ];
          setParticipants(nextParticipants);
          setCameraOn(room.localParticipant.isCameraEnabled);
          setMicrophoneOn(room.localParticipant.isMicrophoneEnabled);
          if (credentials.role === "learner" && credentials.started) {
            const teacherPresent = nextParticipants.some(({ participant }) =>
              participant.identity === credentials.teacherId);
            if (!teacherPresent) {
              setNotice("Your tutor is temporarily offline. The class remains active and will reconnect automatically.");
            } else if (!notice && !audioOnly) {
              setNotice("");
            }
          }
        };
        for (const event of [
          RoomEvent.TrackSubscribed,
          RoomEvent.TrackUnsubscribed,
          RoomEvent.TrackPublished,
          RoomEvent.TrackUnpublished,
          RoomEvent.LocalTrackPublished,
          RoomEvent.LocalTrackUnpublished,
          RoomEvent.TrackMuted,
          RoomEvent.TrackUnmuted,
          RoomEvent.ConnectionQualityChanged,
        ]) {
          room.on(event, () => {
            if (process.env.NODE_ENV !== "production") {
              console.debug("[live-class] media event", {
                sessionId: credentials.sessionId,
                roomName: credentials.roomName,
                event,
              });
            }
            refreshParticipants();
          });
        }
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] participant joined", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
              identity: participant.identity,
            });
          }
          refreshParticipants();
          if (credentials.role === "teacher" || credentials.role === "administrator") {
            void refreshAttendees(credentials.sessionId);
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] participant left", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
              identity: participant.identity,
            });
          }
          refreshParticipants();
          if (credentials.role === "teacher" || credentials.role === "administrator") {
            void refreshAttendees(credentials.sessionId);
          }
        });
        room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
          if (cancelled || participant !== room?.localParticipant) return;
          if (quality === ConnectionQuality.Poor) {
            if (!audioOnlyRef.current) {
              cameraWantedRef.current = room.localParticipant.isCameraEnabled;
            }
            audioOnlyRef.current = true;
            setAudioOnly(true);
            setNotice("Slow network detected. Switching to audio-only; video will return automatically when the connection improves.");
            if (room.localParticipant.isCameraEnabled) {
              void room.localParticipant.setCameraEnabled(false).catch((cameraError: unknown) => {
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[live-class] camera could not switch off for poor network", cameraError);
                }
                if (!cancelled) setNotice("Your connection is slow and the camera could not switch off automatically.");
              });
            }
          } else if (quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent) {
            audioOnlyRef.current = false;
            setAudioOnly(false);
            if (cameraWantedRef.current && credentials.role !== "administrator") {
              void room.localParticipant.setCameraEnabled(true).catch((cameraError: unknown) => {
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[live-class] camera could not recover after network improvement", cameraError);
                }
                if (!cancelled) setNotice("Your network recovered. Turn your camera on again if it did not resume.");
              });
            }
            setNotice((current) => current.includes("Slow network detected") ? "" : current);
          }
        });
        room.on(RoomEvent.Reconnecting, () => {
          if (!cancelled) {
            setConnected(false);
            setConnectionStatus("reconnecting");
            setNotice("Connection interrupted. Reconnecting to the live class…");
          }
        });
        room.on(RoomEvent.SignalReconnecting, () => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] signaling reconnecting", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
            });
          }
        });
        room.on(RoomEvent.SignalConnected, () => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] signaling connected", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
            });
          }
        });
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] connection state", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
              state,
            });
          }
        });
        room.on(RoomEvent.Reconnected, () => {
          if (!cancelled) {
            setConnected(true);
            setConnectionStatus("connected");
            setNotice("");
            refreshParticipants();
            void refreshChat(credentials.sessionId);
          }
        });
        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (cancelled || topic !== "tgf-live-class-chat") return;
          try {
            const event = JSON.parse(new TextDecoder().decode(payload)) as { messageId?: unknown };
            if (typeof event.messageId === "string" &&
                /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(event.messageId)) {
              void refreshChatMessage(credentials.sessionId, event.messageId);
            }
          } catch (chatEventError) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[live-class] ignored invalid chat event", chatEventError);
            }
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          if (cancelled || intentionalDisconnect) return;
          setConnected(false);
          setConnectionStatus("reconnecting");
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] room disconnected", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
            });
          }
          void requestJoin(retryUrl.current, retryBody.current).then((status) => {
            if (!cancelled && status.waitingForTeacher) {
              setStarted(false);
              setConnectionStatus("waiting");
              setNotice("The class is waiting for your tutor to restart it.");
            } else if (!cancelled) {
              setNotice("Connection interrupted. Reconnecting automatically...");
              window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = window.setTimeout(() => {
                if (!cancelled) setRetryKey((key) => key + 1);
              }, 5000);
            }
          }).catch((disconnectError: unknown) => {
            if (cancelled) return;
            const message = disconnectError instanceof Error ? disconnectError.message : "";
            if (message.toLowerCase().includes("ended")) {
              setEnded(true);
              setNotice("");
            } else {
              setNotice("Connection interrupted. Reconnecting automatically...");
              window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = window.setTimeout(() => {
                if (!cancelled) setRetryKey((key) => key + 1);
              }, 5000);
            }
          });
        });

        await room.connect(credentials.serverUrl, credentials.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setConnected(true);
        setConnecting(false);
        setConnectionStatus("connected");
        setNotice("");
        refreshParticipants();
        void refreshChat(credentials.sessionId);
        if (credentials.role === "learner") {
          await postAttendance(credentials.sessionId, "join");
          attendanceActive = true;
          attendanceSessionId = credentials.sessionId;
        }
        if (credentials.role !== "administrator") {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            setNotice("Camera permission is unavailable. You can still listen and use the microphone.");
          }
        }
        if (credentials.role === "teacher" || credentials.role === "administrator") {
          void refreshAttendees(credentials.sessionId);
          attendanceTimer = window.setInterval(
            () => void refreshAttendees(credentials.sessionId),
            5000,
          );
        }
      } catch (connectError) {
        if (cancelled) return;
        if (room) {
          intentionalDisconnect = true;
          try {
            await room.disconnect();
          } catch (disconnectError) {
            console.error("LiveKit room cleanup failed after connection error.", disconnectError);
          }
          room = null;
          roomRef.current = null;
        }
        const message = connectError instanceof Error ? connectError.message : "The class could not be joined.";
        if (message.toLowerCase().includes("ended")) {
          setEnded(true);
          setConnecting(false);
          return;
        }
        setError(message);
        setConnectionStatus("failed");
        setConnecting(false);
      }
    };

    void connect();
    const onPageHide = () => {
      if (attendanceActive) {
        void postAttendance(attendanceSessionId, "leave", true).catch((attendanceError) => {
          if (!cancelled) setNotice("Attendance could not be updated after leaving.");
          else console.error("Could not update live-class attendance after leaving.", attendanceError);
        });
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.clearTimeout(waitTimer);
      window.clearTimeout(reconnectTimerRef.current);
      window.clearInterval(attendanceTimer);
      window.removeEventListener("pagehide", onPageHide);
      if (attendanceActive) {
        void postAttendance(attendanceSessionId, "leave", true).catch(() => {
          if (!cancelled) setNotice("Attendance could not be updated after leaving.");
        });
      }
      intentionalDisconnect = true;
      if (roomRef.current === room) roomRef.current = null;
      void room?.disconnect();
    };
  }, [joinUrl, sessionIdParam, classDate, retryKey]);

  async function sendChatMessage(body: string, clientMessageId = crypto.randomUUID()) {
    if (!info?.sessionId || !connected || !started || chatSending) return;
    setChatSending(true);
    setChatError("");
    try {
      const result = await postJson<{ message: LiveClassChatMessage }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/chat`,
        { clientMessageId, body },
      );
      setChatMessages((current) => mergeChatMessages(current, [result.message]));
      setChatDraft("");
      setFailedChatMessage(null);
    } catch (sendError) {
      setFailedChatMessage({ id: clientMessageId, body });
      setChatError(sendError instanceof Error ? sendError.message : "Your message could not be sent.");
    } finally {
      setChatSending(false);
    }
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room || !connected || isAdministrator) return;
    setBusy(true);
    try {
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);
      setCameraOn(room.localParticipant.isCameraEnabled);
      cameraWantedRef.current = room.localParticipant.isCameraEnabled;
      audioOnlyRef.current = false;
      setAudioOnly(false);
      setNotice("");
    } catch {
      setNotice("Camera permission is unavailable. Check your browser permissions and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room || !connected || isAdministrator) return;
    setBusy(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
      setMicrophoneOn(room.localParticipant.isMicrophoneEnabled);
      setNotice("");
    } catch {
      setNotice("Microphone permission is unavailable. Check your browser permissions and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startClass() {
    if (!info?.sessionId) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ started: boolean }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`,
        {},
      );
      setStarted(result.started);
      setConnectionStatus("connected");
      setNotice("Class started. Recording is being saved privately.");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "The class could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function endClass() {
    if (!info?.sessionId) return;
    setBusy(true);
    setError("");
    try {
      await postJson(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/end`,
        {},
      );
      setEnded(true);
      setConnected(false);
      setNotice("Class ended. The private recording will appear in My Live Classes when processing finishes.");
      await roomRef.current?.disconnect();
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "The class could not be ended.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveClass() {
    const room = roomRef.current;
    try {
      if (info?.sessionId && info.role === "learner") {
        await fetch(
          `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/attendance/leave`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            keepalive: true,
          },
        );
      }
    } finally {
      await room?.disconnect();
      window.location.href = dashboardUrl;
    }
  }

  const teacherEntry = participants.find(({ participant }) =>
    participant.identity === info?.teacherId);
  const studentEntries = participants.filter(({ participant }) =>
    participant.identity !== info?.teacherId);

  return (
    <section className="livekit-room" aria-label="Live class">
      <header className="livekit-header">
        <div>
          <p className="eyebrow"><span /> TGFVP live classroom</p>
          <h1>{info?.programmeTitle || "Live class"}</h1>
          <p className="admin-intro">
            {info?.startsAt ? new Date(info.startsAt).toLocaleString() : "On-demand live class"}
            {info?.teacherName ? ` · Tutor: ${info.teacherName}` : ""}
          </p>
        </div>
        <div className="livekit-header-actions">
          {!ended && <span
            className={`livekit-connection-status is-${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            <span />
            {connectionStatus === "waiting"
              ? "Waiting for tutor"
              : connectionStatus[0].toUpperCase() + connectionStatus.slice(1)}
          </span>}
          {audioOnly && <span className="livekit-recording-badge is-starting"><span /> Audio-only</span>}
          {started && !ended && <span className="livekit-recording-badge is-starting">
            <span /> Recording automatically
          </span>}
          {isTeacher && !ended && !started && (
            <button className="button button-dark" type="button" onClick={() => void startClass()} disabled={busy || !connected}>
              Start class
            </button>
          )}
          {isTeacher && !ended && started && (
            <button className="button button-danger" type="button" onClick={() => void endClass()} disabled={busy}>
              End class
            </button>
          )}
          <button className="button button-quiet" type="button" onClick={() => void leaveClass()}>
            Leave class
          </button>
        </div>
      </header>

      {connecting && <p className="admin-intro" role="status">Connecting to class…</p>}
      {error && (
        <div>
          <p className="admin-message is-error" role="alert">{error}</p>
          <button
            className="button button-dark"
            type="button"
            onClick={() => {
              setInfo(null);
              setParticipants([]);
              setConnected(false);
              setConnectionStatus("connecting");
              setEnded(false);
              setRetryKey((key) => key + 1);
            }}
          >Retry connection</button>
        </div>
      )}
      {notice && <p className="livekit-recording-notice" role="status">{notice}</p>}
      {ended && <p className="livekit-waiting-room" role="status">
        <span><strong>Class has ended.</strong> Return to your dashboard when you are ready.</span>
      </p>}

      {!ended && <div className="livekit-controls">
        <button className="button button-dark" type="button" onClick={() => void toggleMicrophone()} disabled={!connected || busy || isAdministrator}>
          {microphoneOn ? "Mute microphone" : "Unmute microphone"}
        </button>
        <button className="button button-dark" type="button" onClick={() => void toggleCamera()} disabled={!connected || busy || isAdministrator}>
          {cameraOn ? "Turn camera off" : "Turn camera on"}
        </button>
      </div>}

      {!ended && <div className="livekit-layout livekit-managed-layout">
        <section className="livekit-main-view" aria-label="Tutor main view">
          {teacherEntry?.participant.isCameraEnabled
            ? <VideoTrackView
              participant={teacherEntry.participant}
              className="livekit-main-video livekit-teacher-video"
              muted={teacherEntry.local}
            />
            : <div className="livekit-main-placeholder">
              <span className="livekit-teacher-avatar">
                {initials(info?.teacherName || "Tutor")}
              </span>
              <strong>{info?.teacherName || "Tutor"}</strong>
              <span>{started ? "Tutor camera is off" : "Waiting for the tutor to start the class"}</span>
            </div>}
          {participants.map((entry) => (
            <ParticipantAudio
              key={entry.participant.identity}
              participant={entry.participant}
              local={entry.local}
            />
          ))}
        </section>

        <aside className="livekit-sidebar livekit-managed-sidebar">
          <section className="livekit-roster" aria-label="Class participants">
            <h2>Students in class <span>{studentEntries.length}</span></h2>
            {studentEntries.length === 0
              ? <p className="livekit-attendance-empty">Students will appear here when they join.</p>
              : <div className="livekit-student-row livekit-side-strip">
                {studentEntries.map(({ participant, local }) => (
                  <article className="livekit-student-tile" key={participant.identity}>
                    <div className="livekit-student-video-frame">
                      {participant.isCameraEnabled
                        ? <VideoTrackView
                          participant={participant}
                          className="livekit-student-video"
                          muted={local}
                        />
                        : <span className="livekit-student-avatar">
                          {initials(participant.name || participant.identity)}
                        </span>}
                    </div>
                    <strong>{participant.name || participant.identity}</strong>
                    <small>{participant.isMicrophoneEnabled ? "Microphone on" : "Muted"}</small>
                  </article>
                ))}
              </div>}

            {(isTeacher || isAdministrator) && <>
              <h3 className="livekit-attendance-heading">
                Attended this session <span>{attendees.length}</span>
              </h3>
              {attendees.length === 0
                ? <p className="livekit-attendance-empty">No students have joined this class yet.</p>
                : <ul className="livekit-attendance-list">
                  {attendees.map((attendee) => {
                    const present = studentEntries.some(({ participant }) =>
                      participant.identity === attendee.id);
                    return (
                      <li key={attendee.id}>
                        <strong>{attendee.name}</strong>
                        <small>{present ? "In class" : `Attended ${formatDuration(attendee.attendanceSeconds)}`}</small>
                        <time dateTime={attendee.firstJoinedAt}>
                          Joined {new Intl.DateTimeFormat(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(attendee.firstJoinedAt))}
                        </time>
                      </li>
                    );
                  })}
                </ul>}
            </>}
          </section>

          <section className="livekit-chat" aria-label="Class chat">
            <header>
              <h2>Class chat</h2>
              <p>Messages are visible to everyone in this class.</p>
            </header>
            <div className="livekit-chat-messages" role="log" aria-live="polite" ref={chatMessagesRef}>
              {chatMessages.length === 0 && (
                <p className="livekit-chat-empty">No messages yet. Start the conversation.</p>
              )}
              {chatMessages.map((message) => {
                const isMine = message.senderId === roomRef.current?.localParticipant.identity;
                return (
                  <article
                    className={`livekit-chat-message${isMine ? " is-mine" : ""}`}
                    key={message.id}
                  >
                    <div className="livekit-chat-person">
                      <ChatAvatar message={message} />
                      <div>
                        <strong>
                          {message.name}
                          {message.role === "teacher" && <span className="livekit-chat-tutor-badge">Tutor</span>}
                          {message.role === "administrator" && <span className="livekit-chat-tutor-badge">Admin</span>}
                        </strong>
                        {message.email && <small>{message.email}</small>}
                      </div>
                    </div>
                    <p>{message.body}</p>
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </article>
                );
              })}
            </div>
            {chatError && <p className="livekit-chat-error" role="alert">{chatError}</p>}
            {failedChatMessage && (
              <button
                className="livekit-chat-retry"
                type="button"
                disabled={chatSending}
                onClick={() => void sendChatMessage(failedChatMessage.body, failedChatMessage.id)}
              >
                Retry sending message
              </button>
            )}
            <form
              className="livekit-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (chatDraft.trim()) void sendChatMessage(chatDraft.trim());
              }}
            >
              <label className="sr-only" htmlFor="livekit-chat-input">Message the class</label>
              <input
                id="livekit-chat-input"
                type="text"
                value={chatDraft}
                maxLength={2000}
                placeholder={started ? "Write a message…" : "Chat opens when the class starts"}
                onChange={(event) => setChatDraft(event.target.value)}
                disabled={!connected || !started || chatSending}
              />
              <button
                className="button button-dark"
                type="submit"
                disabled={!connected || !started || chatSending || !chatDraft.trim()}
              >
                {chatSending ? "Sending…" : "Send"}
              </button>
            </form>
          </section>
        </aside>
      </div>}
    </section>
  );
}
