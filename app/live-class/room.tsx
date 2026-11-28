"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  claimRecordingQueueUpload,
  clearRecordingQueueSession,
  ensureRecordingQueueSession,
  getQueuedRecordingChunks,
  getRecordingQueueSession,
  getRecordingQueueSessions,
  markRecordingQueueFinalizing,
  queueRecordingChunk,
  updateRecordingQueueSession,
} from "./recording-queue";
import LiveMediaRoom, { ParticipantAvatar } from "./media-room";
import styles from "./room.module.css";

type ClassStatus = "scheduled" | "live" | "ended" | "cancelled";
type ConnectionStatus =
  | "connecting"
  | "connected"
  | "ready"
  | "reconnecting"
  | "failed"
  | "waiting";
type DashboardRole = "teacher" | "learner";
type DashboardIconName = "home" | "play" | "calendar" | "book" | "wallet" | "check" | "profile" | "message" | "document";

interface DashboardLink {
  label: string;
  href: string;
  icon: DashboardIconName;
  active?: boolean;
}

const teacherLinks: DashboardLink[] = [
  { label: "Overview", href: "/teacher#teacher-overview", icon: "home" },
  { label: "Live classes", href: "/teacher#teacher-classes", icon: "play", active: true },
  { label: "Timetable", href: "/teacher#teacher-weekly-timetable", icon: "calendar" },
  { label: "My Live Classes", href: "/teacher#teacher-recordings", icon: "play" },
  { label: "Teaching materials", href: "/teacher#teacher-modules", icon: "book" },
  { label: "Course content", href: "/teacher#teacher-course-content", icon: "document" },
  { label: "Capstone reviews", href: "/teacher#teacher-capstones", icon: "check" },
  { label: "Daily answer reviews", href: "/teacher#teacher-daily-answers", icon: "document" },
  { label: "Tutor profile", href: "/teacher#teacher-profile", icon: "profile" },
  { label: "Messages", href: "/teacher#teacher-peer-messages", icon: "message" },
];

const learnerLinks: DashboardLink[] = [
  { label: "Overview", href: "/student#student-overview", icon: "home" },
  { label: "My pathways", href: "/student#student-pathways", icon: "document" },
  { label: "My course", href: "/student#student-my-course", icon: "book" },
  { label: "Fees", href: "/student#student-fees", icon: "wallet" },
  { label: "Live classes", href: "/student#student-upcoming-classes", icon: "play", active: true },
  { label: "My timetable", href: "/student#student-timetable", icon: "calendar" },
  { label: "Attendance", href: "/student#student-attendance", icon: "check" },
  { label: "Recorded classes", href: "/student#student-recordings", icon: "play" },
  { label: "Messages", href: "/student#student-messages", icon: "message" },
];

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && <path d="m3 10 9-7 9 7v10H5V9.5M9 20v-6h6v6" />}
      {name === "play" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>}
      {name === "calendar" && <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4m8-4v4M3 9h18m-13 4h3m-3 4h6" /></>}
      {name === "book" && <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v16.5m5-15h7m-7 4h7m-7 4h5" /></>}
      {name === "wallet" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-13 5h4" /></>}
      {name === "check" && <><path d="m4 12 5 5L20 6" /><circle cx="12" cy="12" r="9" /></>}
      {name === "profile" && <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>}
      {name === "message" && <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.5-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8m-8 3h5" /></>}
      {name === "document" && <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
    </svg>
  );
}

function DashboardSidebar({ role }: { role: DashboardRole }) {
  const isTeacher = role === "teacher";
  const links = isTeacher ? teacherLinks : learnerLinks;

  return (
    <aside
      className="student-sidebar livekit-dashboard-sidebar"
      aria-label={isTeacher ? "Teacher studio navigation" : "Student learning space navigation"}
    >
      <p className="micro-label">{isTeacher ? "Teacher studio" : "Learning space"}</p>
      <nav>
        {links.map((link) => (
          <a
            key={link.href}
            className={link.active ? "is-active" : undefined}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-current={link.active ? "location" : undefined}
          >
            <DashboardIcon name={link.icon} />
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
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
  recordingStatus: string;
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
  profilePhotoUrl: string;
  gender: string;
  body: string;
  createdAt: string;
}

interface RecordingUploadSignature {
  apiKey: string;
  cloudName: string;
  overwrite: string;
  publicId: string;
  signature: string;
  timestamp: string;
  type: string;
}

const LIVE_DEBUG = process.env.NEXT_PUBLIC_LIVE_CLASS_DEBUG === "true";

function logLiveClass(event: string, details: Record<string, unknown> = {}) {
  if (LIVE_DEBUG) console.info("[live-class]", event, details);
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

async function requestBackgroundRecordingSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    await syncRegistration.sync?.register("tgf-live-recording-upload");
  } catch (error) {
    logLiveClass("background recording sync unavailable", { error: String(error) });
  }
}

async function requestPersistentRecordingStorage() {
  try {
    const persisted = await navigator.storage?.persist?.();
    logLiveClass("persistent recording storage", { granted: Boolean(persisted) });
  } catch (error) {
    logLiveClass("persistent recording storage unavailable", { error: String(error) });
  }
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
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "saved" | "uploading" | "ready" | "failed">("idle");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordedChunkCount, setRecordedChunkCount] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uploadInProgressRef = useRef(false);
  const uploadRecordingRef = useRef<((sessionId: string) => Promise<void>) | null>(null);
  const recordingAudioResumeRef = useRef<(() => Promise<void>) | null>(null);
  const stopRecordingPromiseRef = useRef<Promise<void> | null>(null);
  const chunkWritesRef = useRef<Promise<void>>(Promise.resolve());
  const nextChunkNumberRef = useRef(1);
  const recordingStartedAtRef = useRef(0);

  const setRecordingAudioResume = useCallback((resume: (() => Promise<void>) | null) => {
    recordingAudioResumeRef.current = resume;
  }, []);

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
          current.recordingStatus === result.recordingStatus &&
          current.roomName === result.roomName) return current;
      return result;
    });
    if (result.classStatus === "scheduled") {
      setStatus(result.role === "learner" ? "waiting" : "ready");
    } else if (result.classStatus === "live") {
      setStatus("connected");
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
      source.onopen = () => {
        void Promise.all([
          refreshJoin(true),
          info.role === "teacher" ? refreshAttendance(info.sessionId) : Promise.resolve(),
          info.classStatus === "live" ? refreshChat(info.sessionId) : Promise.resolve(),
        ]).catch((error: unknown) => {
          if (active) setNotice(error instanceof Error ? error.message : "Class details could not be refreshed.");
        });
      };
      source.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as { type?: string; relatedId?: string };
          if (update.relatedId !== info.sessionId) return;
          if ([
            "live-session-started",
            "live-session-ended",
            "live-session-cancelled",
            "recording-started",
            "recording-stopped",
          ].includes(update.type || "")) {
            void refreshJoin().catch((error: unknown) => {
              if (active) setNotice(error instanceof Error ? error.message : "Class status could not be refreshed.");
            });
          }
          if (update.type === "live-session-chat-message") {
            void refreshChat(info.sessionId).catch((error: unknown) => {
              if (active) setChatError(error instanceof Error ? error.message : "Chat could not be refreshed.");
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
    if (!info || info.role !== "learner" || info.classStatus !== "live") return;
    const attendanceUrl = `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/attendance`;
    void requestJson(`${attendanceUrl}/join`, { method: "POST" }).catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "Your attendance could not be saved.");
    });
    return () => {
      void requestJson(`${attendanceUrl}/leave`, { method: "POST" }).catch((error: unknown) =>
        logLiveClass("attendance leave failed", { error: String(error) }));
    };
  }, [info?.classStatus, info?.role, info?.sessionId]);

  useEffect(() => {
    if (!info || info.role !== "teacher") return;
    let active = true;
    void Promise.all([
      getRecordingQueueSession(info.sessionId),
      getQueuedRecordingChunks(info.sessionId),
    ]).then(([session, chunks]) => {
      if (!active || !session || chunks.length === 0) return;
      setRecordedChunkCount(chunks.length);
      nextChunkNumberRef.current = session.lastChunkNumber + 1;
      recordingStartedAtRef.current = session.startedAt;
      setRecordingDuration(session.lastElapsedSeconds);
      if (session.finalizePending || info.classStatus === "ended" || info.classStatus === "cancelled") {
        if (!session.finalizePending && info.classStatus === "ended") {
          void markRecordingQueueFinalizing(info.sessionId).then(() => {
            void uploadRecordingRef.current?.(info.sessionId);
            void requestBackgroundRecordingSync();
          }).catch((error: unknown) => logLiveClass("recovered recording finalization failed", { error: String(error) }));
        }
        if (!uploadInProgressRef.current) {
          setRecordingState((session.uploadLeaseUntil || 0) > Date.now() ? "uploading" : "saved");
        }
        setNotice("Recording saved locally. Upload will resume automatically when a connection is available.");
      }
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : "Saved recording data could not be checked.");
    });
    return () => {
      active = false;
    };
  }, [info?.classStatus, info?.role, info?.sessionId]);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const timer = window.setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
    }, 1000);
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", warnBeforeClose);
    };
  }, [recordingState]);

  const startBrowserRecording = async (sessionId: string, stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") throw new Error("This browser does not support class recording.");
    if (recorderRef.current?.state === "recording") return;
    const queueSession = await ensureRecordingQueueSession(sessionId);
    if (queueSession.finalizePending && info?.classStatus === "live") {
      await updateRecordingQueueSession(sessionId, { finalizePending: false });
    }
    const supportedTypes = [
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunkWritesRef.current = Promise.resolve();
    nextChunkNumberRef.current = queueSession.lastChunkNumber + 1;
    recordingStartedAtRef.current = queueSession.startedAt;
    setRecordingDuration(queueSession.lastElapsedSeconds);
    setRecordedChunkCount(queueSession.lastChunkNumber);
    setNotice("");

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size === 0) return;
      const chunkNumber = nextChunkNumberRef.current++;
      const elapsedSeconds = Math.floor((Date.now() - queueSession.startedAt) / 1000);
      chunkWritesRef.current = chunkWritesRef.current.then(async () => {
        await queueRecordingChunk(sessionId, chunkNumber, elapsedSeconds, event.data);
        await updateRecordingQueueSession(sessionId, { mimeType: recorder.mimeType });
        setRecordedChunkCount(chunkNumber);
        logLiveClass("recording chunk persisted", { sessionId, chunkNumber, bytes: event.data.size });
      }).catch((error: unknown) => {
        setRecordingState("failed");
        setNotice(error instanceof Error ? error.message : "A recording chunk could not be saved locally.");
        logLiveClass("recording chunk persistence failed", { sessionId, chunkNumber, error: String(error) });
      });
    };
    recorder.onerror = (event: Event) => {
      setRecordingState("failed");
      setNotice("The browser recording stopped unexpectedly. Saved chunks will be recovered automatically.");
      logLiveClass("MediaRecorder error", { sessionId, error: String(event) });
    };
    recorderRef.current = recorder;
    recorder.start(5000);
    setRecordingState("recording");
    logLiveClass("automatic class recording started", { sessionId, mimeType: recorder.mimeType });
  };

  const stopBrowserRecording = async (sessionId?: string) => {
    if (stopRecordingPromiseRef.current) return stopRecordingPromiseRef.current;
    const recorder = recorderRef.current;
    const stopTask = (async () => {
      if (recorder?.state === "recording") {
        await new Promise<void>((resolve) => {
          recorder.addEventListener("stop", () => resolve(), { once: true });
          recorder.stop();
        });
      }
      await chunkWritesRef.current;
      if (sessionId && nextChunkNumberRef.current > 1) {
        await markRecordingQueueFinalizing(sessionId);
        setRecordingState("saved");
        setNotice("Recording saved locally. Upload starts automatically and resumes when the connection returns.");
      } else {
        setRecordingState("idle");
      }
      recorderRef.current = null;
    })();
    stopRecordingPromiseRef.current = stopTask;
    try {
      await stopTask;
    } finally {
      stopRecordingPromiseRef.current = null;
    }
  };

  const uploadRecording = async (sessionId: string) => {
    if (uploadInProgressRef.current) return;
    uploadInProgressRef.current = true;
    let claimed = false;
    try {
      if (!navigator.onLine) {
        if (sessionId === info?.sessionId) setRecordingState("saved");
        return;
      }
      claimed = await claimRecordingQueueUpload(sessionId);
      if (!claimed) return;
      let session = await getRecordingQueueSession(sessionId);
      if (!session) return;
      const chunks = await getQueuedRecordingChunks(sessionId);
      const endAction = session.cancelClassPending ? "cancel" : session.endClassPending ? "end" : null;
      if (endAction) {
        if (chunks.length === 0 && session.classWasLive) {
          await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingAvailable: false }),
          });
        }
        await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/${endAction}`, { method: "POST" });
        session = await updateRecordingQueueSession(sessionId, { endClassPending: false, cancelClassPending: false });
        if (sessionId === info?.sessionId) {
          setInfo((current) => current ? { ...current, classStatus: endAction === "cancel" ? "cancelled" : "ended" } : current);
          setStatus("failed");
        }
      }
      if (!session.finalizePending) return;
      if (chunks.length === 0) {
        await clearRecordingQueueSession(sessionId);
        if (sessionId === info?.sessionId) setRecordingState("idle");
        return;
      }
      const mimeType = session.mimeType || chunks.find((chunk) => chunk.blob.type)?.blob.type || "video/webm";
      const file = new Blob(chunks.map((chunk) => chunk.blob), { type: mimeType });
      if (!file.size) throw new Error("The saved class recording is empty.");
      const signature = await requestJson<RecordingUploadSignature>(
        `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-signature`,
        { method: "POST" },
      );
      const uploadId = session.uploadId || crypto.randomUUID();
      let uploadedBytes = Math.min(session.uploadedBytes || 0, file.size);
      let uploadResult: { public_id?: string; done?: boolean } | null =
        session.uploadConfirmed && uploadedBytes === file.size
          ? { public_id: signature.publicId, done: true }
          : null;
      await updateRecordingQueueSession(sessionId, {
        uploadId,
        uploadedBytes,
        mimeType,
        uploadLeaseUntil: Date.now() + 900_000,
      });
      const chunkSize = 6 * 1024 * 1024;
      if (sessionId === info?.sessionId) {
        setRecordingState("uploading");
        setRecordingProgress(Math.round((uploadedBytes / file.size) * 100));
      }

      while (uploadedBytes < file.size) {
        const start = uploadedBytes;
        const end = Math.min(start + chunkSize, file.size);
        const form = new FormData();
        form.append("file", file.slice(start, end, mimeType), mimeType.includes("mp4") ? "recording.mp4" : "recording.webm");
        form.append("api_key", signature.apiKey);
        form.append("timestamp", signature.timestamp);
        form.append("public_id", signature.publicId);
        form.append("overwrite", signature.overwrite);
        form.append("type", signature.type);
        form.append("signature", signature.signature);
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/video/upload`,
          {
            method: "POST",
            headers: {
              "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
              "X-Unique-Upload-Id": uploadId,
            },
            body: form,
          },
        );
        const result = await response.json() as { public_id?: string; done?: boolean; error?: { message?: string } };
        if (!response.ok) throw new Error(result.error?.message || `Recording upload failed (${response.status}).`);
        uploadResult = result;
        uploadedBytes = end;
        await updateRecordingQueueSession(sessionId, {
          uploadedBytes,
          uploadConfirmed: result.done === true && result.public_id === signature.publicId,
          uploadLeaseUntil: Date.now() + 900_000,
        });
        if (sessionId === info?.sessionId) setRecordingProgress(Math.round((end / file.size) * 100));
        logLiveClass("recording upload chunk confirmed", { sessionId, start, end });
      }

      if (!uploadResult?.done || uploadResult.public_id !== signature.publicId) {
        throw new Error("Recording storage did not confirm the completed upload.");
      }
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-complete`, {
        method: "POST",
      });
      await clearRecordingQueueSession(sessionId);
      if (sessionId === info?.sessionId) {
        setRecordingState("ready");
        setRecordedChunkCount(0);
        setNotice("Recording uploaded and confirmed.");
      }
      logLiveClass("recording upload confirmed by server", { sessionId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The recording upload failed.";
      const session = await getRecordingQueueSession(sessionId).catch(() => null);
      if (session) {
        const retryCount = (session.retryCount || 0) + 1;
        const delay = Math.min(30_000 * (2 ** Math.min(retryCount - 1, 7)), 60 * 60 * 1000);
        await updateRecordingQueueSession(sessionId, {
          retryCount,
          nextRetryAt: Date.now() + delay,
          uploadLeaseUntil: 0,
        }).catch(() => undefined);
        window.setTimeout(() => {
          if (navigator.onLine) void uploadRecordingRef.current?.(sessionId);
        }, delay);
      }
      if (sessionId === info?.sessionId) {
        setRecordingState("saved");
        setNotice("Recording is saved locally. Upload will retry automatically when the connection is available.");
      }
      logLiveClass("recording upload queued for retry", { sessionId, error: reason });
      void requestBackgroundRecordingSync();
    } finally {
      if (claimed) {
        await updateRecordingQueueSession(sessionId, { uploadLeaseUntil: 0 }).catch(() => undefined);
      }
      uploadInProgressRef.current = false;
    }
  };
  uploadRecordingRef.current = uploadRecording;

  useEffect(() => {
    if (!info || info.role !== "teacher" || info.classStatus !== "live" || !recordingStream) return;
    let active = true;
    void getRecordingQueueSession(info.sessionId).then((session) => {
      if (session?.endClassPending || session?.cancelClassPending) return;
      if (!active) return;
      return startBrowserRecording(info.sessionId, recordingStream);
    }).catch((error: unknown) => {
      if (!active) return;
      setRecordingState("failed");
      setNotice(error instanceof Error ? error.message : "Automatic recording could not start.");
    });
    return () => {
      active = false;
    };
  }, [info?.classStatus, info?.role, info?.sessionId, recordingStream]);

  useEffect(() => {
    if (!info || info.role !== "teacher") return;
    let active = true;
    const onServiceWorkerMessage = (event: MessageEvent<{ type?: string; sessionId?: string }>) => {
      if (event.data?.sessionId !== info.sessionId) return;
      if (event.data.type === "recording-uploading") setRecordingState("uploading");
      if (event.data.type === "recording-uploaded") {
        setRecordingState("ready");
        setRecordedChunkCount(0);
        setNotice("Recording uploaded and confirmed.");
      }
      if (event.data.type === "class-ended" || event.data.type === "class-cancelled") {
        setInfo((current) => current ? {
          ...current,
          classStatus: event.data.type === "class-cancelled" ? "cancelled" : "ended",
        } : current);
        setStatus("failed");
      }
    };
    const retryPendingRecordings = async () => {
      if (!navigator.onLine || !active) return;
      try {
        const sessions = (await getRecordingQueueSessions()).sort((left, right) => left.startedAt - right.startedAt);
        for (const session of sessions) {
          if (!active || !session.finalizePending ||
              (session.nextRetryAt || 0) > Date.now()) continue;
          await uploadRecordingRef.current?.(session.sessionId);
        }
      } catch (error) {
        logLiveClass("pending recording scan failed", { error: String(error) });
      }
    };
    const onOnline = () => void retryPendingRecordings();
    const retryTimer = window.setInterval(() => void retryPendingRecordings(), 30_000);
    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    void navigator.serviceWorker?.register("/live-class-recording-sw.js", { scope: "/" })
      .then(() => requestBackgroundRecordingSync())
      .catch((error: unknown) => logLiveClass("recording service worker unavailable", { error: String(error) }));
    void retryPendingRecordings();
    return () => {
      active = false;
      window.clearInterval(retryTimer);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [info?.role]);

  const startClass = async () => {
    if (!info) return;
    setBusy(true);
    setNotice("");
    try {
      void recordingAudioResumeRef.current?.().catch((error: unknown) =>
        logLiveClass("recording audio mixer could not resume", { error: String(error) }));
      await requestPersistentRecordingStorage();
      await ensureRecordingQueueSession(info.sessionId);
      const result = await requestJson<{ recordingAvailable: boolean }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingAvailable: true }),
      });
      if (!result.recordingAvailable) throw new Error("The class started, but browser recording was not enabled. Try again or ask an administrator for help.");
      await updateRecordingQueueSession(info.sessionId, { classWasLive: true });
      await refreshJoin(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The class could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const finalizeAndUploadRecording = async (sessionId: string, action: "end" | "cancel") => {
    await ensureRecordingQueueSession(sessionId);
    const classWasLive = info?.classStatus === "live";
    await updateRecordingQueueSession(sessionId, {
      finalizePending: true,
      endClassPending: action === "end",
      cancelClassPending: action === "cancel",
      classWasLive,
    });
    await stopBrowserRecording(sessionId);
    await updateRecordingQueueSession(sessionId, {
      finalizePending: true,
      endClassPending: action === "end",
      cancelClassPending: action === "cancel",
      classWasLive,
    });

    const chunks = await getQueuedRecordingChunks(sessionId);
    if (!navigator.onLine) {
      setRecordingState(chunks.length ? "saved" : "idle");
      setNotice(chunks.length
        ? "Recording saved locally. Class finalization and Cloudinary upload will resume automatically online."
        : "Class finalization is queued and will retry automatically online.");
      await requestBackgroundRecordingSync();
      return;
    }

    try {
      if (chunks.length === 0 && classWasLive) {
        await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingAvailable: false }),
        });
      }
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/${action}`, {
        method: "POST",
      });
      await updateRecordingQueueSession(sessionId, { endClassPending: false, cancelClassPending: false });
      setInfo((current) => current ? { ...current, classStatus: action === "cancel" ? "cancelled" : "ended" } : current);
      setStatus("failed");
      if (chunks.length) {
        await uploadRecording(sessionId);
      } else {
        await clearRecordingQueueSession(sessionId);
        setRecordingState("idle");
      }
    } catch (error) {
      setRecordingState(chunks.length ? "saved" : "idle");
      setNotice(chunks.length
        ? "Recording saved locally. Class finalization and Cloudinary upload will retry automatically."
        : "Class finalization is queued and will retry automatically.");
      logLiveClass("class finalization queued", { sessionId, action, error: String(error) });
    } finally {
      await requestBackgroundRecordingSync();
    }
  };

  const cancelClass = async () => {
    if (!info || !window.confirm("Cancel this class for everyone?")) return;
    setBusy(true);
    setNotice("");
    try {
      await finalizeAndUploadRecording(info.sessionId, "cancel");
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
      await finalizeAndUploadRecording(info.sessionId, "end");
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
      <section className={`${styles.room} ${styles.errorRoom} livekit-room`} aria-live="polite">
        <div className={styles.errorCard}>
          <div className={`${styles.connectionStatus} ${styles[`status_${status}`]}`} role="status">
            <span />{status === "connecting" ? "Connecting" : "Unable to connect"}
          </div>
          <span className={styles.errorIcon} aria-hidden="true">!</span>
          <p className={styles.kicker}>International Forces · Live class</p>
          <h1>{status === "connecting" ? "Opening your classroom" : "We couldn’t open this class"}</h1>
          <p className={styles.errorMessage} role="alert">
            {notice || (status === "connecting"
              ? "We’re checking your access and loading the class details."
              : "Check that you’re signed in with an account that has access to this class, then try again.")}
          </p>
          {status === "failed" && (
            <button className={`button ${styles.retryButton}`} type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  const isTeacher = info.role === "teacher";
  const statusLabel = {
    connecting: "Connecting",
    connected: "Class live",
    ready: "Ready to start",
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
  const classroomOpen = info.classStatus === "scheduled" || info.classStatus === "live";

  return (
    <div className="livekit-dashboard-shell">
      {(isTeacher || info.role === "learner") && (
        <DashboardSidebar role={isTeacher ? "teacher" : "learner"} />
      )}
      <section className={`${styles.room} livekit-room`}>
      <header className={`${styles.header} livekit-header`}>
        <div className={styles.headerCopy}>
          <p className={styles.kicker}>Live classroom · {displayedStatus}</p>
          <h1>{info.programmeTitle}</h1>
          <p className={styles.subtitle}>
            Tutor: {info.teacherName} <span aria-hidden="true">·</span> Live classroom
          </p>
        </div>
        <div className={`${styles.headerActions} livekit-header-actions`}>
          <div className={`${styles.connectionStatus} ${styles[`status_${status}`]}`} role="status">
            <span />{displayedStatus}
          </div>
          {isTeacher && info.classStatus === "scheduled" && (
            <button className="button" type="button" disabled={busy} onClick={startClass}>
              {busy ? "Starting…" : "Start class & record"}
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

      {notice && <p className={`${styles.notice} livekit-recording-notice`} role="alert">{notice}</p>}
      {isTeacher && info.classStatus === "scheduled" && (
        <p className={`${styles.setupNote} livekit-recording-setup`}>
          Your camera and microphone are ready. Recording starts automatically with the class.
        </p>
      )}
      {info.classStatus === "cancelled" && (
        <div className={`${styles.terminalCard} livekit-waiting-room`}>
          <span className={styles.terminalIcon} aria-hidden="true">×</span>
          <div><strong>Class cancelled</strong><p>Your tutor cancelled this session.</p></div>
        </div>
      )}
      {info.classStatus === "ended" && (
        <div className={`${styles.terminalCard} livekit-waiting-room`}>
          <span className={styles.terminalIcon} aria-hidden="true">✓</span>
          <div><strong>Class complete</strong><p>This session has ended. Any saved recording will appear when processing finishes.</p></div>
        </div>
      )}

      {classroomOpen && (
        <div className={`${styles.layout} livekit-layout`}>
          <div className={`${styles.stage} livekit-main-view`} aria-label="Live classroom stage">
            <LiveMediaRoom
              sessionId={info.sessionId}
              role={info.role === "teacher" ? "teacher" : "learner"}
              classStatus={info.classStatus === "live" ? "live" : "scheduled"}
              teacherName={info.teacherName}
              onRecordingStream={setRecordingStream}
              onRecordingAudioResume={setRecordingAudioResume}
            />
            {isTeacher && (recordingState !== "idle" || info.recordingStatus === "recording" || info.recordingStatus === "ready") && (
              <span className={`${styles.recordingIndicator} livekit-recording-indicator`} role="status">
                {recordingState === "uploading"
                  ? "Uploading"
                  : recordingState === "ready"
                    ? "Uploaded"
                    : info.recordingStatus === "ready"
                      ? "Uploaded"
                    : recordingState === "saved"
                      ? "Saved locally"
                    : recordingState === "failed"
                      ? "Recording unavailable"
                      : "Recording"}
                {recordingState === "recording" ? ` · ${formatDuration(recordingDuration)}` : ""}
              </span>
            )}
            {isTeacher && info.classStatus === "live" && (
              <div className={`${styles.recordingControls} livekit-recording-controls`}>
                {recordingState === "recording" && <p role="status">Recording and saving locally every five seconds.</p>}
                {recordingState === "saved" && <p role="status">Saved locally. Upload retries automatically.</p>}
                {recordingState === "ready" && <p role="status">Recording uploaded and confirmed.</p>}
                {recordingState === "failed" && <p role="status">Recording could not start. Previously saved chunks remain queued.</p>}
                {recordingState === "uploading" && (
                  <>
                    <p role="status">Uploading recording… {recordingProgress}%</p>
                    <progress value={recordingProgress} max={100} aria-label="Recording upload progress" />
                  </>
                )}
              </div>
            )}
          </div>
          <aside className={`${styles.sidebar} livekit-sidebar`}>
            {isTeacher && (
              <section className={`${styles.roster} livekit-roster`} aria-label="Class attendance">
                <header className={styles.cardHeader}>
                  <div><p className={styles.kicker}>Live attendance</p><h2>Class roster</h2></div>
                  <span className={styles.studentCount}>{activeStudents}</span>
                </header>
                <p className={`${styles.attendanceHeading} livekit-attendance-heading`}>
                  Attendance recorded <span>{attendees.length}</span>
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
              </section>
            )}
            <section className={`${styles.chat} livekit-chat`} aria-label="Class chat">
              <header className={styles.chatHeader}>
                <div><p className={styles.kicker}>Keep the conversation going</p><h2>Class chat</h2></div>
                <span className={styles.chatIcon} aria-hidden="true">↗</span>
              </header>
              <div className={`${styles.chatMessages} livekit-chat-messages`} aria-live="polite">
                {messages.length === 0
                  ? <p className="livekit-chat-empty">
                    {info.classStatus === "scheduled" ? "Chat opens when the class starts." : "No messages yet."}
                  </p>
                  : messages.map((message) => (
                    <article className={`${styles.chatMessage} livekit-chat-message`} key={message.id}>
                      <ParticipantAvatar
                        name={message.name}
                        photoUrl={message.profilePhotoUrl}
                        gender={message.gender}
                      />
                      <div>
                        <strong>{message.name}</strong>
                        <p>{message.body}</p>
                        <time dateTime={message.createdAt}>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </time>
                      </div>
                    </article>
                  ))}
              </div>
              {chatError && <p className={styles.chatError} role="alert">{chatError}</p>}
              <form className={`${styles.chatForm} livekit-chat-form`} onSubmit={sendMessage}>
                <input
                  className={styles.chatInput}
                  aria-label="Message"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  maxLength={2000}
                  placeholder="Write a message…"
                  disabled={info.classStatus !== "live"}
                />
                <button className={`button ${styles.sendButton}`} type="submit" disabled={!messageBody.trim()}>Send</button>
              </form>
            </section>
          </aside>
        </div>
      )}
      {isTeacher && (info.classStatus === "ended" || info.classStatus === "cancelled") &&
        recordedChunkCount > 0 && recordingState !== "ready" && (
        <div className={`${styles.recovery} livekit-recording-recovery`}>
          <p role="status">{recordingState === "uploading" ? "Uploading saved recording…" : `Saved locally (${recordedChunkCount} chunks). Upload retries automatically.`}</p>
          {recordingState === "uploading"
            ? <div className="livekit-recording-upload-progress">
              <p>Uploading… {recordingProgress}%</p>
              <progress value={recordingProgress} max={100} aria-label="Recording upload progress" />
            </div>
            : null}
        </div>
      )}
      </section>
    </div>
  );
}
