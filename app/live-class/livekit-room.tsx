"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
} from "livekit-client";
import {
  LIVE_CLASS_CHAT_TOPIC,
  LIVE_CLASS_CONTROL_TOPIC,
} from "../../lib/live-class-events.js";

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
  microphoneAllowed?: boolean;
  recordingAvailable?: boolean;
  serverUrl?: string;
  token?: string;
}

interface SessionAttendee {
  id: string;
  name: string;
  firstJoinedAt: string;
  attendanceSeconds: number;
  role: "learner" | "teacher" | "administrator";
  microphoneAllowed: boolean;
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
const PARTICIPANTS_PER_PAGE = 6;

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

function participantRole(participant: Participant): string {
  try {
    const metadata = JSON.parse(participant.metadata || "") as { role?: unknown };
    return typeof metadata.role === "string" ? metadata.role : "";
  } catch {
    return "";
  }
}

function connectionQualityLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
    case ConnectionQuality.Good:
      return "Good network";
    case ConnectionQuality.Poor:
      return "Weak network";
    case ConnectionQuality.Lost:
      return "Reconnecting";
    default:
      return "Network status unknown";
  }
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
  source = Track.Source.Camera,
}: {
  participant: Participant;
  className: string;
  muted: boolean;
  source?: Track.Source;
}) {
  const elementRef = useRef<HTMLVideoElement>(null);
  const track = participant.getTrackPublication(source)?.track;

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

function ParticipantAudio({
  participant,
  local,
  source = Track.Source.Microphone,
}: ParticipantEntry & { source?: Track.Source }) {
  const elementRef = useRef<HTMLAudioElement>(null);
  const track = local
    ? undefined
    : participant.getTrackPublication(source)?.track;

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
  const manualAudioOnlyRef = useRef(false);
  const reconnectTimerRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef(0);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [info, setInfo] = useState<JoinResponse | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [microphonePermissions, setMicrophonePermissions] = useState<Record<string, boolean>>({});
  const [activeSpeakerId, setActiveSpeakerId] = useState("");
  const [pinnedParticipantId, setPinnedParticipantId] = useState("");
  const [participantPage, setParticipantPage] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
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
    let waitingRefreshTimer = 0;
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
        if (!response.ok) {
          throw new Error("Attendance could not be refreshed.");
        }
        if (!cancelled) {
          const nextAttendees = result.attendees || [];
          setAttendees(nextAttendees);
          setMicrophonePermissions(Object.fromEntries(
            nextAttendees.map(({ id, microphoneAllowed }) => [id, microphoneAllowed]),
          ));
        }
      } catch (attendanceError) {
        if (!cancelled) {
          setNotice(attendanceError instanceof Error
            ? attendanceError.message
            : "Attendance updates are temporarily unavailable. The class connection will continue.");
        }
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
        setRecordingAvailable(credentials.recordingAvailable ?? null);
        void refreshChat(credentials.sessionId);
        if (!credentials.serverUrl || !credentials.token) {
          throw new Error("The live video service returned incomplete connection details. Contact your administrator.");
        }

        let roomConnected = false;
        let startSignalReceived = false;
        let attendanceRequestPending = false;
        const recordAttendance = async () => {
          if (cancelled || attendanceActive || attendanceRequestPending ||
              credentials.role !== "learner") return;
          attendanceRequestPending = true;
          try {
            await postAttendance(credentials.sessionId, "join");
            attendanceActive = true;
            attendanceSessionId = credentials.sessionId;
          } finally {
            attendanceRequestPending = false;
          }
        };
        const activateClass = async (recordingIsAvailable?: boolean) => {
          startSignalReceived = true;
          window.clearInterval(waitingRefreshTimer);
          setStarted(true);
          setInfo((current) => current ? { ...current, started: true } : current);
          if (recordingIsAvailable !== undefined) setRecordingAvailable(recordingIsAvailable);
          setConnectionStatus("connected");
          setNotice("");
          void refreshChat(credentials.sessionId);
          if (roomConnected) {
            try {
              await recordAttendance();
            } catch (attendanceError) {
              if (!cancelled) {
                setError(attendanceError instanceof Error
                  ? attendanceError.message
                  : "Your attendance could not be recorded.");
              }
            }
          }
        };

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
          setScreenSharing(room.localParticipant.isScreenShareEnabled);
          if (credentials.role === "learner" && credentials.started) {
            const teacherPresent = nextParticipants.some(({ participant }) =>
              participant.identity === credentials.teacherId);
            if (!teacherPresent) {
              setNotice("Your tutor is temporarily offline. The class remains active and will reconnect automatically.");
            } else {
              setNotice((current) => current.includes("temporarily offline") ? "" : current);
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
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const nextSpeakerId = speakers[0]?.identity || "";
          setActiveSpeakerId(nextSpeakerId);
          if (process.env.NODE_ENV !== "production") {
            console.debug("[live-class] active speaker", {
              sessionId: credentials.sessionId,
              roomName: credentials.roomName,
              identity: nextSpeakerId || null,
            });
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
          } else if ((quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent) &&
              !manualAudioOnlyRef.current) {
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
            reconnectAttemptsRef.current = 0;
            setConnected(true);
            setConnectionStatus(startSignalReceived ? "connected" : "waiting");
            setNotice("");
            refreshParticipants();
            void refreshChat(credentials.sessionId);
          }
        });
        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (cancelled) return;
          try {
            const event = JSON.parse(new TextDecoder().decode(payload)) as {
              type?: unknown;
              sessionId?: unknown;
              messageId?: unknown;
              userId?: unknown;
              microphoneAllowed?: unknown;
              recordingAvailable?: unknown;
            };
            if (topic === LIVE_CLASS_CHAT_TOPIC &&
                typeof event.messageId === "string" &&
                /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(event.messageId)) {
              void refreshChatMessage(credentials.sessionId, event.messageId);
              return;
            }
            if (topic !== LIVE_CLASS_CONTROL_TOPIC ||
                event.sessionId !== credentials.sessionId) return;
            if (event.type === "started") {
              void activateClass(typeof event.recordingAvailable === "boolean"
                ? event.recordingAvailable
                : undefined);
            } else if (event.type === "attendance-updated" &&
                (credentials.role === "teacher" || credentials.role === "administrator")) {
              void refreshAttendees(credentials.sessionId);
            } else if (event.type === "microphone" &&
                typeof event.userId === "string" &&
                typeof event.microphoneAllowed === "boolean") {
              setMicrophonePermissions((current) => ({
                ...current,
                [event.userId as string]: event.microphoneAllowed as boolean,
              }));
              if (event.userId === credentials.teacherId) return;
              if (event.userId === room?.localParticipant.identity) {
                setInfo((current) => current
                  ? { ...current, microphoneAllowed: event.microphoneAllowed as boolean }
                  : current);
                setNotice(event.microphoneAllowed
                  ? "Your tutor has allowed your microphone."
                  : "Your tutor has muted your microphone.");
              }
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
          setParticipants([]);
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
              const delay = Math.min(30_000, 1000 * (2 ** reconnectAttemptsRef.current));
              reconnectAttemptsRef.current += 1;
              reconnectTimerRef.current = window.setTimeout(() => {
                if (!cancelled) setRetryKey((key) => key + 1);
              }, delay);
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
              const delay = Math.min(30_000, 1000 * (2 ** reconnectAttemptsRef.current));
              reconnectAttemptsRef.current += 1;
              reconnectTimerRef.current = window.setTimeout(() => {
                if (!cancelled) setRetryKey((key) => key + 1);
              }, delay);
            }
          });
        });

        await room.connect(credentials.serverUrl, credentials.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setConnected(true);
        roomConnected = true;
        setConnecting(false);
        setConnectionStatus(credentials.started || startSignalReceived ? "connected" : "waiting");
        setNotice(credentials.started || startSignalReceived
          ? ""
          : "Connected to the classroom. Your tutor has not started the lesson yet.");
        refreshParticipants();
        void refreshChat(credentials.sessionId);
        if (credentials.role === "learner" && credentials.started) await recordAttendance();
        if (credentials.role === "learner" && !credentials.started) {
          waitingRefreshTimer = window.setInterval(async () => {
            if (cancelled || startSignalReceived) return;
            try {
              const latest = await requestJoin(joinUrl, joinBody);
              if (latest.started) await activateClass(latest.recordingAvailable);
            } catch (statusError) {
              if (!cancelled && statusError instanceof Error &&
                  statusError.message.toLowerCase().includes("ended")) {
                setEnded(true);
                setNotice("");
              }
            }
          }, 10_000);
        }
        if (credentials.role === "learner") {
          try {
            const currentStatus = await requestJoin(joinUrl, joinBody);
            if (cancelled) return;
            setInfo(currentStatus);
            setRecordingAvailable(currentStatus.recordingAvailable ?? null);
            setMicrophonePermissions((current) => ({
              ...current,
              [room?.localParticipant.identity || ""]: Boolean(currentStatus.microphoneAllowed),
            }));
            if (currentStatus.started) {
              await activateClass(currentStatus.recordingAvailable);
            }
          } catch (statusError) {
            if (!cancelled) {
              setNotice(statusError instanceof Error
                ? `Connected, but couldn't confirm the class status: ${statusError.message}`
                : "Connected, but couldn't confirm the class status. It will retry automatically.");
            }
          }
        }
        if (credentials.role !== "administrator") {
          try {
            await room.localParticipant.setCameraEnabled(true, {
              resolution: credentials.role === "teacher"
                ? VideoPresets.h720.resolution
                : VideoPresets.h360.resolution,
            });
          } catch (cameraError) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[live-class] camera unavailable; joining without video", cameraError);
            }
            setNotice("Camera permission is unavailable. You can still join with audio.");
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
      window.clearInterval(waitingRefreshTimer);
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
      const enableCamera = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(enableCamera, {
        resolution: info?.role === "teacher"
          ? VideoPresets.h720.resolution
          : VideoPresets.h360.resolution,
      });
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
    const userId = room.localParticipant.identity;
    const microphoneAllowed = microphonePermissions[userId] ?? info?.microphoneAllowed ?? false;
    if (info?.role === "learner" && !microphoneAllowed) {
      setNotice("Your tutor has muted your microphone. Ask them to allow you to speak.");
      return;
    }
    setBusy(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
      setMicrophoneOn(room.localParticipant.isMicrophoneEnabled);
      setNotice("");
    } catch (microphoneError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[live-class] microphone permission failed", microphoneError);
      }
      setNotice("Microphone access was denied or blocked. Check your browser permissions and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || !connected || !isTeacher) return;
    setBusy(true);
    try {
      await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled);
      setScreenSharing(room.localParticipant.isScreenShareEnabled);
      setNotice("");
    } catch (shareError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[live-class] screen sharing failed", shareError);
      }
      setNotice("Screen sharing was denied or is unavailable in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAudioOnly() {
    const room = roomRef.current;
    if (!room || !connected || isAdministrator) return;
    const nextAudioOnly = !audioOnly;
    manualAudioOnlyRef.current = nextAudioOnly;
    audioOnlyRef.current = nextAudioOnly;
    setAudioOnly(nextAudioOnly);
    if (nextAudioOnly) {
      cameraWantedRef.current = room.localParticipant.isCameraEnabled;
      try {
        await room.localParticipant.setCameraEnabled(false);
        setCameraOn(false);
        setNotice("Audio-only mode is on. Your microphone and incoming class audio remain available.");
      } catch (cameraError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[live-class] audio-only camera shutdown failed", cameraError);
        }
        setNotice("Audio-only is selected, but the camera could not be turned off.");
      }
    } else {
      try {
        await room.localParticipant.setCameraEnabled(true, {
          resolution: info?.role === "teacher"
            ? VideoPresets.h720.resolution
            : VideoPresets.h360.resolution,
        });
        setCameraOn(true);
        cameraWantedRef.current = true;
        setNotice("");
      } catch (cameraError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[live-class] camera could not be restored after audio-only", cameraError);
        }
        setNotice("Audio continues normally. Camera access is unavailable; check browser permissions.");
      }
    }
  }

  async function setStudentMicrophone(userId: string, allowMicrophone: boolean) {
    if (!info?.sessionId || !isTeacher && !isAdministrator) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ updated: number }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/microphone`,
        { userId, allowMicrophone },
      );
      if (result.updated === 0) {
        setNotice("No connected students were available for this microphone change.");
      } else {
        setNotice(allowMicrophone
          ? "Microphone permission updated."
          : "Student microphone muted.");
      }
    } catch (permissionError) {
      setError(permissionError instanceof Error
        ? permissionError.message
        : "Student microphone permission could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function startClass() {
    if (!info?.sessionId) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{
        started: boolean;
        recordingAvailable?: boolean;
        liveSignalDelivered?: boolean;
      }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`,
        {},
      );
      setStarted(result.started);
      setRecordingAvailable(result.recordingAvailable ?? false);
      setConnectionStatus("connected");
      setNotice(!result.recordingAvailable
        ? "Class started. Recording is unavailable, but the live lesson can continue."
        : !result.liveSignalDelivered
          ? "Class started. Some waiting students may take a few seconds to connect."
          : "Class started. Students in the waiting room are joining now.");
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
    participant.identity !== info?.teacherId &&
    participantRole(participant) !== "administrator");
  const participantPageCount = Math.max(1, Math.ceil(studentEntries.length / PARTICIPANTS_PER_PAGE));
  const visibleStudentEntries = studentEntries.slice(
    participantPage * PARTICIPANTS_PER_PAGE,
    (participantPage + 1) * PARTICIPANTS_PER_PAGE,
  );
  const pinnedEntry = pinnedParticipantId
    ? participants.find(({ participant }) => participant.identity === pinnedParticipantId)
    : undefined;
  const stageEntry = pinnedEntry || teacherEntry;
  const teacherScreenShareTrack = teacherEntry?.participant.getTrackPublication(Track.Source.ScreenShare)?.track;
  const stageSource = stageEntry?.participant.identity === info?.teacherId && teacherScreenShareTrack
    ? Track.Source.ScreenShare
    : Track.Source.Camera;
  const stageTrack = stageEntry?.participant.getTrackPublication(stageSource)?.track;
  const stageVideoEnabled = stageSource === Track.Source.ScreenShare
    ? stageEntry?.participant.isScreenShareEnabled
    : stageEntry?.participant.isCameraEnabled;
  const localMicrophoneAllowed = info?.role !== "learner" ||
    (microphonePermissions[roomRef.current?.localParticipant.identity || ""] ??
      info?.microphoneAllowed ?? false);

  useEffect(() => {
    setParticipantPage((page) => Math.min(page, participantPageCount - 1));
  }, [participantPageCount]);

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
              ? isTeacher ? "Ready to start" : "Waiting for tutor"
              : connectionStatus[0].toUpperCase() + connectionStatus.slice(1)}
          </span>}
          {audioOnly && <span className="livekit-recording-badge is-starting"><span /> Audio-only</span>}
          {started && recordingAvailable && !ended && <span className="livekit-recording-badge is-starting">
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

      {connecting && <p className="livekit-page-status" role="status">Connecting to class…</p>}
      {error && (
        <section className="livekit-error-panel" role="alert">
          <div>
            <strong>Couldn't connect to the live class</strong>
            <p>{error}</p>
          </div>
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
        </section>
      )}
      {notice && <p className="livekit-recording-notice livekit-page-status" role="status">{notice}</p>}
      {ended && <p className="livekit-waiting-room" role="status">
        <span><strong>Class has ended.</strong> Return to your dashboard when you are ready.</span>
      </p>}

      {!ended && <div className="livekit-layout livekit-managed-layout">
        <section className={`livekit-main-view${activeSpeakerId === stageEntry?.participant.identity ? " is-active-speaker" : ""}`} aria-label="Main class stage">
          {stageEntry && stageVideoEnabled && stageTrack
            ? <VideoTrackView
              participant={stageEntry.participant}
              className={`livekit-main-video${stageSource === Track.Source.ScreenShare ? " is-screen-share" : " livekit-teacher-video"}`}
              muted={stageEntry.local}
              source={stageSource}
            />
            : <div className="livekit-main-placeholder">
              <span className="livekit-teacher-avatar">
                {initials(stageEntry?.participant.name || info?.teacherName || "Tutor")}
              </span>
              <strong>{stageEntry?.participant.name || info?.teacherName || "Tutor"}</strong>
              <span>{stageEntry
                ? stageEntry.participant.identity === info?.teacherId && screenSharing
                  ? "Tutor is sharing their screen"
                  : stageEntry.participant.isCameraEnabled ? "Connecting video…" : "Camera is off"
                : started ? "Waiting for the tutor to join the room" : "Waiting for the tutor to start the class"}</span>
            </div>}
          {stageEntry && <p className="livekit-stage-caption">
            {stageEntry.participant.identity === info?.teacherId && stageSource === Track.Source.ScreenShare
              ? "Tutor screen share"
              : stageEntry.participant.name || "Class participant"}
          </p>}
          {participants.flatMap((entry) => [
            <ParticipantAudio
              key={`${entry.participant.identity}-microphone`}
              participant={entry.participant}
              local={entry.local}
            />,
            <ParticipantAudio
              key={`${entry.participant.identity}-share-audio`}
              participant={entry.participant}
              local={entry.local}
              source={Track.Source.ScreenShareAudio}
            />,
          ])}
          <div className="livekit-controls" role="group" aria-label="Call controls">
            <button className="button button-dark" type="button" onClick={() => void toggleMicrophone()} disabled={!connected || busy || isAdministrator || !localMicrophoneAllowed}>
              {microphoneOn ? "Mute microphone" : "Unmute microphone"}
            </button>
            <button className="button button-dark" type="button" onClick={() => void toggleCamera()} disabled={!connected || busy || isAdministrator}>
              {cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
            <button className="button button-dark" type="button" onClick={() => void toggleAudioOnly()} disabled={!connected || busy || isAdministrator}>
              {audioOnly ? "Turn video back on" : "Audio only"}
            </button>
            {isTeacher && <button className="button button-dark" type="button" onClick={() => void toggleScreenShare()} disabled={!connected || busy}>
              {screenSharing ? "Stop sharing" : "Share screen"}
            </button>}
            {info?.role === "learner" && !localMicrophoneAllowed &&
              <span className="livekit-mic-permission" role="status">Muted by your tutor</span>}
          </div>
        </section>

        <aside className="livekit-sidebar livekit-managed-sidebar">
          <section className="livekit-roster" aria-label="Class participants">
            <h2>Students in class <span>{studentEntries.length}</span></h2>
            {(isTeacher || isAdministrator) && started && <div className="livekit-host-controls">
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void setStudentMicrophone("all", true)}
                disabled={busy || studentEntries.length === 0}
              >Unmute all</button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void setStudentMicrophone("all", false)}
                disabled={busy || studentEntries.length === 0}
              >Mute all</button>
            </div>}
            {studentEntries.length === 0
              ? <p className="livekit-attendance-empty">Students will appear here when they join.</p>
              : <div className="livekit-student-row livekit-side-strip">
                {visibleStudentEntries.map(({ participant, local }) => {
                  const attendee = attendees.find(({ id }) => id === participant.identity);
                  const microphoneAllowed = microphonePermissions[participant.identity] ??
                    attendee?.microphoneAllowed ?? false;
                  const isPinned = participant.identity === pinnedParticipantId;
                  const isActiveSpeaker = participant.identity === activeSpeakerId;
                  return (
                  <article
                    className={`livekit-student-tile${isActiveSpeaker ? " is-active-speaker" : ""}${isPinned ? " is-pinned" : ""}`}
                    key={participant.identity}
                  >
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
                    <small className="livekit-mic-state">
                      {participant.isMicrophoneEnabled && microphoneAllowed ? "Mic on" : "Muted"}
                      <span className={`livekit-network-state is-${participant.connectionQuality}`}>
                        {connectionQualityLabel(participant.connectionQuality)}
                      </span>
                    </small>
                    <div className="livekit-student-tile-actions">
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() => setPinnedParticipantId(isPinned ? "" : participant.identity)}
                      >{isPinned ? "Unpin" : "Pin"}</button>
                      {(isTeacher || isAdministrator) && started && <button
                        className="button button-quiet"
                        type="button"
                        disabled={busy}
                        onClick={() => void setStudentMicrophone(participant.identity, !microphoneAllowed)}
                      >{microphoneAllowed ? "Mute" : "Allow mic"}</button>}
                    </div>
                  </article>
                  );
                })}
              </div>}
            {studentEntries.length > PARTICIPANTS_PER_PAGE && <div className="livekit-participant-pagination">
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setParticipantPage((page) => Math.max(0, page - 1))}
                disabled={participantPage === 0}
              >Previous</button>
              <span>Page {participantPage + 1} of {participantPageCount}</span>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setParticipantPage((page) => Math.min(participantPageCount - 1, page + 1))}
                disabled={participantPage + 1 >= participantPageCount}
              >Next</button>
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
