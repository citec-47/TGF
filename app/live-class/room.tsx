"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  clearRecordingQueueSession,
  ensureRecordingQueueSession,
  getQueuedRecordingChunks,
  getRecordingQueueSession,
  markRecordingQueueFinalizing,
  queueRecordingChunk,
} from "./recording-queue";

type ClassStatus = "scheduled" | "live" | "ended" | "cancelled";
type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "failed" | "waiting";

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
  body: string;
  createdAt: string;
}

interface CloudinarySignature {
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
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "uploading" | "ready" | "failed">("idle");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordedChunkCount, setRecordedChunkCount] = useState(0);
  const [recordingStopped, setRecordingStopped] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingPreview = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uploadInProgressRef = useRef(false);
  const stopRecordingPromiseRef = useRef<Promise<void> | null>(null);
  const recordingStatusUpdateRef = useRef<Promise<void>>(Promise.resolve());
  const captureStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkWritesRef = useRef<Promise<void>>(Promise.resolve());
  const nextChunkNumberRef = useRef(1);
  const recordingStartedAtRef = useRef(0);
  const intentionalStopTracksRef = useRef(new WeakSet<MediaStreamTrack>());

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
    if (result.classStatus === "scheduled" && result.role === "learner") {
      setStatus("waiting");
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
      setRecordingStopped(true);
      nextChunkNumberRef.current = session.lastChunkNumber + 1;
      recordingStartedAtRef.current = session.startedAt;
      setRecordingDuration(session.lastElapsedSeconds);
      if (info.classStatus === "ended" || info.classStatus === "cancelled") {
        setRecordingState("failed");
        setNotice("A browser recording is saved locally and can be uploaded from this page.");
      }
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : "Saved recording data could not be checked.");
    });
    return () => {
      active = false;
    };
  }, [info?.classStatus, info?.role, info?.sessionId]);

  useEffect(() => {
    if (recordingPreview.current) recordingPreview.current.srcObject = captureStream;
  }, [captureStream, info?.classStatus]);

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

  const startBrowserRecording = async (sessionId: string) => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("This browser cannot record a shared tab. Use a recent version of Chrome or Edge over HTTPS.");
    }
    if (recorderRef.current?.state === "recording") return;

    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error("Screen sharing was cancelled or denied. Allow sharing and choose this tab to record it.");
      }
      if (error instanceof DOMException && error.name === "NotFoundError") {
        throw new Error("No screen or tab is available to record.");
      }
      throw new Error(error instanceof Error ? error.message : "The browser could not start screen recording.");
    }

    let microphone: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    try {
      microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setNotice("Microphone access was denied. The recording will include shared-tab audio only.");
      logLiveClass("microphone unavailable", { sessionId, error: String(error) });
    }

    try {
      const queueSession = await ensureRecordingQueueSession(sessionId);
      audioContext = new AudioContext();
      await audioContext.resume();
      const audioDestination = audioContext.createMediaStreamDestination();
      let audioSources = 0;
      for (const stream of [displayStream, microphone].filter((value): value is MediaStream => value !== null)) {
        if (stream.getAudioTracks().length > 0) {
          audioContext.createMediaStreamSource(stream).connect(audioDestination);
          audioSources += 1;
        }
      }
      if (audioSources === 0) {
        setNotice("No shared-tab audio or microphone was captured. Check the browser's tab-audio sharing option.");
      }

      const mixedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);

      captureStreamRef.current = displayStream;
      microphoneStreamRef.current = microphone;
      audioContextRef.current = audioContext;
      chunkWritesRef.current = Promise.resolve();
      nextChunkNumberRef.current = queueSession.lastChunkNumber + 1;
      recordingStartedAtRef.current = queueSession.startedAt;
      setRecordingDuration(queueSession.lastElapsedSeconds);
      setCaptureStream(displayStream);
      setRecordedChunkCount(queueSession.lastChunkNumber);
      setNotice("");

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size === 0) return;
        const chunkNumber = nextChunkNumberRef.current++;
        const elapsedSeconds = Math.floor((Date.now() - queueSession.startedAt) / 1000);
        chunkWritesRef.current = chunkWritesRef.current.then(async () => {
          await queueRecordingChunk(sessionId, chunkNumber, elapsedSeconds, event.data);
          setRecordedChunkCount(chunkNumber);
          logLiveClass("recording chunk saved", { sessionId, chunkNumber, bytes: event.data.size });
        }).catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : "A recording chunk could not be saved locally.");
          logLiveClass("recording chunk save failed", { sessionId, chunkNumber, error: String(error) });
        });
      };
      recorder.onerror = (event: Event) => {
        setRecordingState("failed");
        setNotice("The browser recording encountered an error. Keep this page open and retry from the saved recording.");
        logLiveClass("MediaRecorder error", { sessionId, error: String(event) });
      };
      const displayVideoTrack = displayStream.getVideoTracks()[0];
      displayVideoTrack?.addEventListener("ended", () => {
        if (intentionalStopTracksRef.current.has(displayVideoTrack)) return;
        recordingStatusUpdateRef.current = stopBrowserRecording().then(async () => {
          await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingAvailable: false }),
          });
          setRecordingStopped(true);
          setInfo((current) => current ? { ...current, recordingStatus: "pending" } : current);
          setNotice("Screen sharing stopped. The saved recording will upload when the class ends.");
        }).catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : "The stopped recording could not be saved.");
        });
      }, { once: true });
      recorderRef.current = recorder;
      recorder.start(5000);
      setRecordingStopped(false);
      setRecordingState("recording");
      logLiveClass("browser recording started", { sessionId, mimeType: recorder.mimeType });
    } catch (error) {
      recorderRef.current = null;
      captureStreamRef.current = null;
      microphoneStreamRef.current = null;
      setCaptureStream(null);
      setRecordingState("idle");
      displayStream.getTracks().forEach((track) => {
        intentionalStopTracksRef.current.add(track);
        track.stop();
      });
      microphone?.getTracks().forEach((track) => {
        intentionalStopTracksRef.current.add(track);
        track.stop();
      });
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      audioContextRef.current = null;
      throw error;
    }
  };

  const stopBrowserRecording = async () => {
    if (stopRecordingPromiseRef.current) return stopRecordingPromiseRef.current;
    const recorder = recorderRef.current;
    const stopTask = (async () => {
      try {
        if (recorder?.state === "recording") {
          await new Promise<void>((resolve) => {
            recorder.addEventListener("stop", () => resolve(), { once: true });
            recorder.stop();
          });
        }
        await chunkWritesRef.current;
        const sessionId = info?.sessionId;
        if (recorder && sessionId && nextChunkNumberRef.current > 1) {
          await markRecordingQueueFinalizing(sessionId);
        }
      } finally {
        recorderRef.current = null;
        setRecordingState("idle");
        captureStreamRef.current?.getTracks().forEach((track) => {
          intentionalStopTracksRef.current.add(track);
          track.stop();
        });
        microphoneStreamRef.current?.getTracks().forEach((track) => {
          intentionalStopTracksRef.current.add(track);
          track.stop();
        });
        captureStreamRef.current = null;
        microphoneStreamRef.current = null;
        setCaptureStream(null);
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          await audioContextRef.current.close();
        }
        audioContextRef.current = null;
      }
    })();
    stopRecordingPromiseRef.current = stopTask;
    try {
      await stopTask;
    } finally {
      stopRecordingPromiseRef.current = null;
    }
  };

  const uploadRecording = async () => {
    if (!info || uploadInProgressRef.current) return;
    uploadInProgressRef.current = true;
    setRecordingState("uploading");
    setRecordingProgress(0);
    setNotice("");
    try {
      const chunks = await getQueuedRecordingChunks(info.sessionId);
      if (chunks.length === 0) throw new Error("No saved browser recording was found for this class.");
      const mimeType = chunks.find((chunk) => chunk.blob.type)?.blob.type || "video/webm";
      const file = new Blob(chunks.map((chunk) => chunk.blob), { type: mimeType });
      const signature = await requestJson<CloudinarySignature>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/recording-signature`,
        { method: "POST" },
      );
      const uniqueUploadId = crypto.randomUUID();
      const chunkSize = 6 * 1024 * 1024;
      let uploadResult: { public_id?: string; done?: boolean } | null = null;

      for (let start = 0; start < file.size; start += chunkSize) {
        const end = Math.min(start + chunkSize, file.size);
        const form = new FormData();
        form.append("file", file.slice(start, end, mimeType), "recording.webm");
        form.append("api_key", signature.apiKey);
        form.append("timestamp", signature.timestamp);
        form.append("public_id", signature.publicId);
        form.append("overwrite", signature.overwrite);
        form.append("type", signature.type);
        form.append("signature", signature.signature);

        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            const response = await fetch(
              `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/video/upload`,
              {
                method: "POST",
                headers: {
                  "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
                  "X-Unique-Upload-Id": uniqueUploadId,
                },
                body: form,
              },
            );
            const result = await response.json() as { public_id?: string; done?: boolean; error?: { message?: string } };
            if (!response.ok) throw new Error(result.error?.message || `Cloudinary upload failed (${response.status}).`);
            uploadResult = result;
            lastError = null;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error("The Cloudinary upload failed.");
            if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 1000 * (2 ** attempt)));
          }
        }
        if (lastError) throw lastError;
        setRecordingProgress(Math.round((end / file.size) * 100));
        logLiveClass("recording upload chunk complete", { sessionId: info.sessionId, start, end });
      }
      if (!uploadResult?.done || uploadResult.public_id !== signature.publicId) {
        throw new Error("Cloudinary did not confirm the completed recording upload.");
      }
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/recording-complete`, {
        method: "POST",
      });
      await clearRecordingQueueSession(info.sessionId);
      setRecordingState("ready");
      setRecordedChunkCount(0);
      setNotice("Recording uploaded and saved successfully.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The recording upload failed.";
      setRecordingState("failed");
      setNotice(reason);
      try {
        await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/recording-failed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      } catch (reportError) {
        logLiveClass("recording failure could not be reported", { sessionId: info.sessionId, error: String(reportError) });
      }
    } finally {
      uploadInProgressRef.current = false;
    }
  };

  const toggleBrowserRecording = async () => {
    if (!info || busy) return;
    setBusy(true);
    try {
      await startBrowserRecording(info.sessionId);
      try {
        const result = await requestJson<{ recordingAvailable: boolean }>(
          `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingAvailable: true }),
        });
        if (!result.recordingAvailable) throw new Error("The class is live, but the server could not enable recording. Try again or ask an administrator for help.");
        setInfo((current) => current ? { ...current, recordingStatus: "recording" } : current);
      } catch (error) {
        await stopBrowserRecording();
        throw error;
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The browser recorder could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const startClass = async () => {
    if (!info) return;
    setBusy(true);
    setNotice("");
    try {
      const [previousSession, previousChunks] = await Promise.all([
        getRecordingQueueSession(info.sessionId),
        getQueuedRecordingChunks(info.sessionId),
      ]);
      if (previousSession || previousChunks.length > 0) {
        await clearRecordingQueueSession(info.sessionId);
        setRecordedChunkCount(0);
        setRecordingStopped(false);
      }
      await startBrowserRecording(info.sessionId);
      const result = await requestJson<{ recordingAvailable: boolean }>(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingAvailable: true }),
      });
      if (!result.recordingAvailable) throw new Error("The class started, but browser recording was not enabled. Try again or ask an administrator for help.");
      await refreshJoin(true);
    } catch (error) {
      await stopBrowserRecording();
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
      await stopBrowserRecording();
      setInfo((current) => current ? { ...current, classStatus: "cancelled" } : current);
      setStatus("failed");
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
      await stopBrowserRecording();
      await recordingStatusUpdateRef.current;
      const chunks = await getQueuedRecordingChunks(info.sessionId);
      if (chunks.length > 0) {
        const recording = await requestJson<{ recordingAvailable: boolean }>(
          `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingAvailable: true }),
          },
        );
        if (!recording.recordingAvailable) throw new Error("The class is live, but the saved recording could not be prepared for upload.");
      } else if (info.recordingStatus === "recording") {
        await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingAvailable: false }),
        });
      }
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/end`, {
        method: "POST",
      });
      setInfo((current) => current ? { ...current, classStatus: "ended" } : current);
      setStatus("failed");
      if (chunks.length > 0) await uploadRecording();
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
    connected: "Class live",
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
          <p className="admin-intro">Tutor: {info.teacherName} · {info.classStatus} · Browser recording only (no live video call)</p>
        </div>
        <div className="livekit-header-actions">
          <div className={`livekit-connection-status is-${status}`} role="status">
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

      {notice && <p className="livekit-recording-notice" role="alert">{notice}</p>}
      {isTeacher && info.classStatus === "scheduled" && (
        <p className="livekit-recording-setup">
          Starting the class opens the browser recording picker. Choose “This tab” and enable “Share tab audio”; microphone audio is added when permitted.
        </p>
      )}
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
          <div className="livekit-main-view" aria-label="Browser recording preview">
            {isTeacher && captureStream
              ? <video className="livekit-preview-video" ref={recordingPreview} autoPlay muted playsInline />
              : (
                <div className="livekit-main-placeholder">
                  <strong>{isTeacher ? "Class is live" : "The teacher is live"}</strong>
                  <p>{isTeacher
                    ? "This classroom records in your browser; it does not provide a live video call."
                    : "This classroom does not provide a live video call. Chat and attendance are available below."}</p>
                </div>
              )}
            {(recordingState === "recording" || info.recordingStatus === "recording") && (
              <span className="livekit-recording-indicator" role="status">
                Recording{isTeacher && recordingState === "recording" ? ` · ${formatDuration(recordingDuration)}` : ""}
              </span>
            )}
            {isTeacher && (
              <div className="livekit-recording-controls">
                {recordingState === "recording" ? (
                  <p role="status">Recording this tab continuously. End the class to finish and upload.</p>
                ) : info.classStatus === "live" &&
                    recordingState !== "uploading" &&
                    recordingState !== "ready" &&
                    (info.recordingStatus !== "recording" || recordingState === "failed") &&
                    !recordingStopped &&
                    recordedChunkCount === 0 ? (
                  <button className="button button-outline" type="button" disabled={busy} onClick={toggleBrowserRecording}>
                    Start browser recording
                  </button>
                ) : recordedChunkCount > 0 && recordingState !== "uploading" ? (
                  <p>Recording capture has stopped. End the class to upload the saved recording.</p>
                ) : null}
                {recordingState === "uploading" && (
                  <>
                    <p role="status">Uploading recording… {recordingProgress}%</p>
                    <progress value={recordingProgress} max={100} aria-label="Recording upload progress" />
                  </>
                )}
              </div>
            )}
            {isTeacher && recordingState === "idle" && recordedChunkCount === 0 && info.recordingStatus !== "recording" && (
              <p className="livekit-recording-instructions">
                When prompted, choose this tab and enable “Share tab audio”. Microphone audio is included when permitted.
              </p>
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
      {isTeacher && (info.classStatus === "ended" || info.classStatus === "cancelled") &&
        recordedChunkCount > 0 && recordingState !== "ready" && (
        <div className="livekit-recording-recovery">
          <p>A browser recording with {recordedChunkCount} saved chunks is ready to upload.</p>
          {recordingState === "uploading"
            ? <div className="livekit-recording-upload-progress" role="status">
              <p>Uploading… {recordingProgress}%</p>
              <progress value={recordingProgress} max={100} aria-label="Recording upload progress" />
            </div>
            : <button className="button" type="button" disabled={busy} onClick={() => void uploadRecording()}>
              {recordingState === "failed" ? "Retry recording upload" : "Upload recording"}
            </button>}
        </div>
      )}
    </section>
  );
}
