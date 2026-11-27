"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type ClassStatus = "scheduled" | "live" | "ended" | "cancelled";
type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "failed" | "waiting";

interface JitsiJoinConfig {
  domain: string;
  appId: string;
  roomName: string;
  token: string;
}

interface JoinResponse {
  role: "teacher" | "learner";
  sessionId: string;
  roomName: string;
  programmeTitle: string;
  teacherName: string;
  teacherId: string;
  started: boolean;
  waitingForTeacher: boolean;
  classStatus: ClassStatus;
  jitsi: JitsiJoinConfig | null;
}

interface Attendee {
  id: string;
  name: string;
  role: string;
  firstJoinedAt: string;
  attendanceSeconds: number;
  isPresent: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  name: string;
  body: string;
  createdAt: string;
}

interface JitsiParticipant {
  id: string;
  displayName?: string;
}

interface JitsiApi {
  addListener(event: string, handler: (data: unknown) => void): void;
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
}

interface JitsiApiConstructor {
  new (domain: string, options: Record<string, unknown>): JitsiApi;
}

function isJitsiParticipant(value: unknown): value is JitsiParticipant {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string";
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiApiConstructor;
  }
}

const jitsiScriptLoads = new Map<string, Promise<void>>();
const LIVE_DEBUG = process.env.NEXT_PUBLIC_LIVE_CLASS_DEBUG === "true";

function logLiveClass(event: string, details: Record<string, unknown> = {}) {
  if (LIVE_DEBUG) console.info("[live-class]", event, details);
}

function loadJitsiApi(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  const existing = jitsiScriptLoads.get(domain);
  if (existing) return existing;

  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => window.JitsiMeetExternalAPI
      ? resolve()
      : reject(new Error("Jitsi loaded without its meeting API."));
    script.onerror = () => reject(new Error("Jitsi could not be loaded. Check the JaaS domain and network connection."));
    document.head.appendChild(script);
  });
  jitsiScriptLoads.set(domain, load);
  return load;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  let result: (T & { error?: string }) | null = null;
  try {
    result = await response.json() as T & { error?: string };
  } catch {
    if (response.ok) throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(result?.error || `The request failed (${response.status}).`);
  }
  if (!result) throw new Error("The server returned an empty response.");
  return result;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function LiveClassRoom() {
  const search = useSearchParams();
  const liveSessionId = search.get("sessionId") || "";
  const slotId = search.get("slotId") || "";
  const classDate = search.get("date") || "";
  const joinUrl = useMemo(() => liveSessionId
    ? `/api/collaboration/live-sessions/${encodeURIComponent(liveSessionId)}/join`
    : `/api/collaboration/sessions/${encodeURIComponent(slotId)}/join`,
  [liveSessionId, slotId]);

  const [info, setInfo] = useState<JoinResponse | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [notice, setNotice] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [chatError, setChatError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<JitsiParticipant[]>([]);
  const meetingMount = useRef<HTMLDivElement | null>(null);
  const jitsiApi = useRef<JitsiApi | null>(null);
  const conferenceJoined = useRef(false);

  const refreshJoin = useCallback(async (force = false) => {
    const result = await requestJson<JoinResponse>(joinUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(liveSessionId ? {} : { classDate }),
    });
    setInfo((current) => {
      if (!force && current &&
          current.sessionId === result.sessionId &&
          current.classStatus === result.classStatus &&
          current.roomName === result.roomName) return current;
      return result;
    });
    if (result.classStatus === "scheduled" && result.role === "learner") {
      setStatus("waiting");
    } else if (result.classStatus === "live" && result.jitsi) {
      setStatus((current) => current === "connected" ? current : "connecting");
    } else if (result.classStatus === "ended" || result.classStatus === "cancelled") {
      setStatus("failed");
    }
    return result;
  }, [classDate, joinUrl, liveSessionId]);

  useEffect(() => {
    if (!liveSessionId && (!slotId || !/^\d{4}-\d{2}-\d{2}$/.test(classDate))) {
      setNotice("Open this page from a live class in your dashboard. The class link is missing its session details.");
      setStatus("failed");
      return;
    }
    let active = true;
    setStatus("connecting");
    void refreshJoin(true).catch((error: unknown) => {
      if (!active) return;
      setNotice(error instanceof Error ? error.message : "The class could not be joined.");
      setStatus("failed");
    });
    return () => {
      active = false;
    };
  }, [classDate, liveSessionId, refreshJoin, slotId]);

  const refreshAttendance = useCallback(async (sessionId: string) => {
    if (info?.role !== "teacher") return;
    const result = await requestJson<{ attendees: Attendee[] }>(
      `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/attendance`,
    );
    setAttendees(result.attendees);
  }, [info?.role]);

  const refreshChat = useCallback(async (sessionId: string) => {
    const result = await requestJson<{ messages: ChatMessage[] }>(
      `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/chat`,
    );
    setMessages((current) => mergeMessages(current, result.messages));
  }, []);

  useEffect(() => {
    if (!info?.sessionId) return;
    let active = true;
    let source: EventSource | null = null;
    let fallbackPoll: number | undefined;
    const loadCurrentState = async () => {
      try {
        await Promise.all([
          info.role === "teacher" ? refreshAttendance(info.sessionId) : Promise.resolve(),
          info.classStatus === "live" ? refreshChat(info.sessionId) : Promise.resolve(),
        ]);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Class details could not be refreshed.");
      }
      if (!active) return;
      source = new EventSource("/api/collaboration/events");
      source.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as { type?: string; relatedId?: string };
          if (update.relatedId !== info.sessionId) return;
          if (["live-session-started", "live-session-ended", "live-session-cancelled"].includes(update.type || "")) {
            void refreshJoin().catch((error: unknown) => {
              if (active) setNotice(error instanceof Error ? error.message : "Class status could not be refreshed.");
            });
          }
          if (update.type === "live-session-attendance") void refreshAttendance(info.sessionId);
        } catch (error) {
          logLiveClass("invalid event", { error: String(error) });
        }
      };
      source.onerror = () => logLiveClass("event stream reconnecting", { sessionId: info.sessionId });
      fallbackPoll = window.setInterval(() => {
        void refreshJoin().catch((error: unknown) => {
          if (active) logLiveClass("status poll failed", { error: String(error) });
        });
        if (info.role === "teacher") void refreshAttendance(info.sessionId);
        if (info.classStatus === "live") {
          void refreshChat(info.sessionId).catch((error: unknown) => {
            if (active) setChatError(error instanceof Error ? error.message : "Chat could not be refreshed.");
          });
        }
      }, 10000);
    };
    void loadCurrentState();
    return () => {
      active = false;
      source?.close();
      if (fallbackPoll !== undefined) window.clearInterval(fallbackPoll);
    };
  }, [info?.classStatus, info?.role, info?.sessionId, refreshAttendance, refreshChat, refreshJoin]);

  useEffect(() => {
    if (!info || info.classStatus !== "live" || !info.jitsi || !meetingMount.current) return;
    let cancelled = false;
    let api: JitsiApi | null = null;
    conferenceJoined.current = false;
    setStatus("connecting");
    setNotice("");
    logLiveClass("joining room", { sessionId: info.sessionId, roomName: info.roomName, role: info.role });

    void loadJitsiApi(info.jitsi.domain).then(() => {
      if (cancelled || !meetingMount.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI(info.jitsi!.domain, {
        roomName: info.jitsi!.roomName,
        jwt: info.jitsi!.token,
        parentNode: meetingMount.current,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: info.role === "learner",
          startWithVideoMuted: true,
          disableDeepLinking: true,
          disableShortcuts: info.role === "learner",
          toolbarButtons: info.role === "teacher"
            ? ["microphone", "camera", "chat", "tileview", "raisehand", "fullscreen", "hangup"]
            : ["camera", "chat", "tileview", "raisehand", "fullscreen", "hangup"],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          DEFAULT_BACKGROUND: "#151714",
        },
      });
      jitsiApi.current = api;
      api.addListener("videoConferenceJoined", () => {
        if (cancelled) return;
        conferenceJoined.current = true;
        setStatus("connected");
        logLiveClass("conference joined", { sessionId: info.sessionId, roomName: info.roomName });
        if (info.role === "learner") {
          void requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/attendance/join`, {
            method: "POST",
          }).catch((error: unknown) => {
            setNotice(error instanceof Error ? error.message : "Your attendance could not be saved.");
          });
          api?.executeCommand("muteAudio");
        }
      });
      api.addListener("videoConferenceLeft", () => {
        if (cancelled) return;
        setStatus("reconnecting");
        logLiveClass("conference left", { sessionId: info.sessionId, roomName: info.roomName });
        if (info.role === "learner" && conferenceJoined.current) {
          void requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/attendance/leave`, {
            method: "POST",
          }).catch((error: unknown) => {
            setNotice(error instanceof Error ? error.message : "Your attendance could not be updated.");
          });
        }
      });
      api.addListener("participantJoined", (value: unknown) => {
        if (!isJitsiParticipant(value)) return;
        const participant = value;
        logLiveClass("participant joined", { sessionId: info.sessionId, participantId: participant.id });
        setRemoteParticipants((current) => current.some((item) => item.id === participant.id)
          ? current
          : [...current, participant]);
      });
      api.addListener("participantLeft", (value: unknown) => {
        if (!isJitsiParticipant(value)) return;
        const participant = value;
        logLiveClass("participant left", { sessionId: info.sessionId, participantId: participant.id });
        setRemoteParticipants((current) => current.filter((item) => item.id !== participant.id));
      });
      api.addListener("connectionQualityChanged", (value: unknown) => {
        const quality = typeof value === "object" && value !== null && "connectionQuality" in value
          ? String(value.connectionQuality)
          : "";
        const isPoor = quality === "poor" || quality === "nonOptimal";
        setStatus(isPoor ? "reconnecting" : "connected");
        logLiveClass("connection quality", { sessionId: info.sessionId, quality });
      });
      api.addListener("cameraError", () => {
        setNotice("Camera access was denied or unavailable. Allow camera access in your browser settings, then reconnect.");
      });
      api.addListener("micError", () => {
        setNotice("Microphone access was denied or unavailable. Allow microphone access in your browser settings.");
      });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setStatus("failed");
      setNotice(error instanceof Error ? error.message : "Jitsi could not connect.");
      logLiveClass("Jitsi initialization failed", { sessionId: info.sessionId, error: String(error) });
    });

    return () => {
      cancelled = true;
      if (info.role === "learner" && conferenceJoined.current) {
        void requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/attendance/leave`, {
          method: "POST",
        }).catch((error: unknown) => logLiveClass("attendance leave failed", { error: String(error) }));
      }
      api?.dispose();
      if (jitsiApi.current === api) jitsiApi.current = null;
      setRemoteParticipants([]);
    };
  }, [info]);

  const startClass = async () => {
    if (!info) return;
    setBusy(true);
    setNotice("");
    try {
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingAvailable: false }),
      });
      await refreshJoin(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The class could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const cancelClass = async () => {
    if (!info || !window.confirm("Cancel this class for everyone?")) return;
    setBusy(true);
    setNotice("");
    try {
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/cancel`, {
        method: "POST",
      });
      setInfo((current) => current ? { ...current, classStatus: "cancelled", jitsi: null } : current);
      setStatus("failed");
      jitsiApi.current?.dispose();
      jitsiApi.current = null;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The class could not be cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const endClass = async () => {
    if (!info || !window.confirm("End this class for everyone?")) return;
    setBusy(true);
    setNotice("");
    try {
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/end`, {
        method: "POST",
      });
      setInfo((current) => current ? { ...current, classStatus: "ended", jitsi: null } : current);
      setStatus("failed");
      jitsiApi.current?.dispose();
      jitsiApi.current = null;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The class could not be ended.");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!info || !messageBody.trim()) return;
    const body = messageBody.trim();
    setMessageBody("");
    setChatError("");
    try {
      const result = await requestJson<{ message: ChatMessage }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientMessageId: crypto.randomUUID(), body }),
        },
      );
      setMessages((current) => mergeMessages(current, [result.message]));
    } catch (error) {
      setMessageBody(body);
      setChatError(error instanceof Error ? error.message : "Your message could not be sent.");
    }
  };

  if (!info) {
    return (
      <section className="livekit-room" aria-live="polite">
        <div className={`livekit-connection-status is-${status}`}>
          <span />{status === "connecting" ? "Connecting" : "Failed"}
        </div>
        {notice && <p className="livekit-recording-notice" role="alert">{notice}</p>}
        {status === "failed" && (
          <button className="button button-outline" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
      </section>
    );
  }

  const isTeacher = info.role === "teacher";
  const statusLabel = {
    connecting: "Connecting",
    connected: "Connected",
    reconnecting: "Reconnecting",
    failed: "Failed",
    waiting: "Waiting for teacher",
  }[status];
  const displayedStatus = info.classStatus === "ended"
    ? "Class ended"
    : info.classStatus === "cancelled"
      ? "Cancelled"
      : statusLabel;
  const activeStudents = attendees.filter((attendee) => attendee.isPresent).length;

  return (
    <section className="livekit-room">
      <header className="livekit-header">
        <div>
          <h1>{info.programmeTitle}</h1>
          <p className="admin-intro">Tutor: {info.teacherName} · {info.classStatus}</p>
        </div>
        <div className="livekit-header-actions">
          <div className={`livekit-connection-status is-${status}`} role="status">
            <span />{displayedStatus}
          </div>
          {isTeacher && info.classStatus === "scheduled" && (
            <button className="button" type="button" disabled={busy} onClick={startClass}>
              {busy ? "Starting…" : "Start class"}
            </button>
          )}
          {isTeacher && info.classStatus === "live" && (
            <button className="button button-danger" type="button" disabled={busy} onClick={endClass}>
              {busy ? "Ending…" : "End class"}
            </button>
          )}
          {isTeacher && (info.classStatus === "scheduled" || info.classStatus === "live") && (
            <button className="button button-outline" type="button" disabled={busy} onClick={cancelClass}>
              Cancel class
            </button>
          )}
        </div>
      </header>

      {notice && <p className="livekit-recording-notice" role="alert">{notice}</p>}
      {info.classStatus === "scheduled" && !isTeacher && (
        <div className="livekit-waiting-room" role="status">
          <span className="livekit-waiting-indicator" />
          <div><strong>Waiting for the teacher</strong><p>This page will join the class automatically when the tutor starts it.</p></div>
        </div>
      )}
      {info.classStatus === "cancelled" && (
        <div className="livekit-waiting-room"><strong>This class was cancelled.</strong></div>
      )}
      {info.classStatus === "ended" && (
        <div className="livekit-waiting-room"><strong>This class has ended.</strong></div>
      )}

      {info.classStatus === "live" && (
        <div className="livekit-layout">
          <div className="livekit-main-view" aria-label="Live class video">
            <div className="livekit-jitsi-frame" ref={meetingMount} />
            {status !== "connected" && (
              <div className="livekit-main-placeholder" role="status">{statusLabel}…</div>
            )}
          </div>
          <aside className="livekit-sidebar">
            {isTeacher && (
              <section className="livekit-roster" aria-label="Class attendance">
                <h2>Students in class <span>{activeStudents}</span></h2>
                <p className="livekit-attendance-heading">
                  Attendance <span>{attendees.length}</span>
                </p>
                {attendees.length === 0
                  ? <p className="livekit-attendance-empty">No students have joined this class yet.</p>
                  : (
                    <ul className="livekit-attendance-list">
                      {attendees.map((attendee) => (
                        <li key={attendee.id}>
                          <strong>{attendee.name}</strong>
                          <small>{attendee.isPresent ? "In class" : `Attended ${formatDuration(attendee.attendanceSeconds)}`}</small>
                          <time dateTime={attendee.firstJoinedAt}>
                            First joined {new Date(attendee.firstJoinedAt).toLocaleTimeString()}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                <p className="livekit-attendance-empty">
                  {remoteParticipants.length} other participant{remoteParticipants.length === 1 ? "" : "s"} connected.
                </p>
              </section>
            )}
            <section className="livekit-chat" aria-label="Class chat">
              <header><h2>Class chat</h2><p>Messages are visible to class participants.</p></header>
              <div className="livekit-chat-messages" aria-live="polite">
                {messages.length === 0
                  ? <p className="livekit-chat-empty">No messages yet.</p>
                  : messages.map((message) => (
                    <article className="livekit-chat-message" key={message.id}>
                      <strong>{message.name}</strong>
                      <p>{message.body}</p>
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </time>
                    </article>
                  ))}
              </div>
              {chatError && <p role="alert">{chatError}</p>}
              <form className="livekit-chat-form" onSubmit={sendMessage}>
                <input
                  aria-label="Message"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  maxLength={2000}
                  placeholder="Write a message…"
                  disabled={info.classStatus !== "live"}
                />
                <button className="button" type="submit" disabled={!messageBody.trim()}>Send</button>
              </form>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
