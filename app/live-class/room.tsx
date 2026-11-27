"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { Device } from "mediasoup-client";
import {
  clearRecordingQueueSession,
  ensureRecordingQueueSession,
  getQueuedRecordingChunks,
  getRecordingQueueSession,
  markRecordingQueueFinalizing,
  queueRecordingChunk,
  removeQueuedRecordingChunk,
} from "./recording-queue";

function StreamVideo({ stream, className }: { stream: MediaStream; className: string }) {
  return (
    <video
      ref={(element) => {
        if (element && element.srcObject !== stream) element.srcObject = stream;
      }}
      className={className}
      autoPlay
      playsInline
      muted
    />
  );
}

interface JoinResponse {
  role?: "teacher" | "learner" | "student" | "administrator";
  sessionId: string;
  programmeTitle: string;
  teacherName: string;
  teacherId: string;
  started?: boolean;
  startsAt?: string;
  waitingForTeacher?: boolean;
  transport: "mediasoup";
  socketPath?: string;
}

interface LiveThemeResponse {
  ok: boolean;
  theme?: "light" | "dark";
}

let liveThemeRequest: Promise<LiveThemeResponse> | null = null;
const liveJoinRequests = new Map<string, Promise<JoinResponse>>();

function requestLiveTheme(): Promise<LiveThemeResponse> {
  if (!liveThemeRequest) {
    liveThemeRequest = fetch("/api/collaboration/preferences", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return { ok: false };
        const result = await response.json() as { theme?: "light" | "dark" };
        return { ok: true, theme: result.theme };
      })
      .finally(() => {
        liveThemeRequest = null;
      });
  }
  return liveThemeRequest;
}

function requestLiveJoin(url: string, body: object): Promise<JoinResponse> {
  const key = `${url}:${JSON.stringify(body)}`;
  const pendingRequest = liveJoinRequests.get(key);
  if (pendingRequest) return pendingRequest;

  const request = fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
    .then(async (response) => {
      const result = await response.json() as JoinResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "This class could not be joined.");
      return result;
    })
    .finally(() => {
      liveJoinRequests.delete(key);
    });
  liveJoinRequests.set(key, request);
  return request;
}

interface ParticipantState {
  id: string;
  name: string;
  role: "teacher" | "student" | "administrator";
  profilePhotoUrl?: string;
  micAllowed: boolean;
  cameraOn: boolean;
  raisedHand: boolean;
}

interface SessionAttendee {
  id: string;
  name: string;
  firstJoinedAt: string;
  attendanceSeconds: number;
}

interface MediaProducer {
  participantId: string;
  producerId: string;
  kind: "audio" | "video";
  name: string;
  role: ParticipantState["role"];
  source?: "camera" | "screen";
}

interface ChatMessage {
  id: string;
  senderId: string;
  name: string;
  email: string;
  role: "teacher" | "learner" | "student" | "administrator";
  profilePhotoUrl?: string;
  body: string;
  createdAt: string;
}

function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const message of [...existing, ...incoming]) messages.set(message.id, message);
  return [...messages.values()].sort((first, second) =>
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
}

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

function getDefaultAvatarVariant(seed: string): "man" | "woman" {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "man" : "woman";
}

function formatRecordingDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function ProfileAvatar({
  name,
  photoUrl,
  seed,
  className,
}: {
  name: string;
  photoUrl?: string;
  seed: string;
  className: string;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const variant = getDefaultAvatarVariant(seed);
  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);
  if (photoUrl && !photoFailed) {
    return (
      <img
        className={className}
        src={photoUrl}
        alt={`${name}'s profile`}
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
      />
    );
  }
  return (
    <span
      className={`${className} livekit-avatar-fallback`}
      role="img"
      aria-label={`Default ${variant} avatar for ${name}`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="24" fill={variant === "man" ? "#dce9e7" : "#f4e3df"} />
        <path d="M8 48c1-10 7-15 16-15s15 5 16 15" fill={variant === "man" ? "#345f5b" : "#9b5873"} />
        <path d="M15 20c0-8 4-13 9-13s9 5 9 13v5c0 6-4 10-9 10s-9-4-9-10z" fill="#c9825f" />
        {variant === "man" ? (
          <>
            <path d="M14 20c0-10 5-15 11-15 7 0 11 5 10 14-3-1-5-4-6-7-3 4-8 6-15 6z" fill="#302b2a" />
            <path d="M17 28c2 2 4 3 7 3s5-1 7-3c-1 5-4 7-7 7s-6-2-7-7z" fill="#56352f" />
          </>
        ) : (
          <>
            <path d="M12 23C10 10 16 4 24 4s14 6 12 19l-3 8-2-9c-4-1-7-4-9-7-2 4-5 6-8 7l-1 9z" fill="#392b35" />
            <path d="M20 26h1m6 0h1" stroke="#382823" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}

function getNetworkInformation(): NetworkInformation | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function isNetworkSlow(): boolean {
  const connection = getNetworkInformation();
  return Boolean(connection && (
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g" ||
    (typeof connection.downlink === "number" && connection.downlink < 0.7) ||
    (typeof connection.rtt === "number" && connection.rtt > 1200)
  ));
}

export default function LiveClassRoom() {
  const search = useSearchParams();
  const liveSessionId = search.get("sessionId") || "";
  const slotId = search.get("slotId") || "";
  const classDate = search.get("date") || "";

  const socketRef = useRef<Socket | null>(null);
  const isTeacherRef = useRef(false);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<any>(null);
  const receiveTransportRef = useRef<any>(null);
  const consumersRef = useRef<Map<string, any>>(new Map());
  const consumingProducerIdsRef = useRef(new Set<string>());
  const pendingProducersRef = useRef<Map<string, MediaProducer>>(new Map());
  const consumerVideoMetadataRef = useRef(new Map<string, {
    participantId: string;
    role: ParticipantState["role"];
    source: "camera" | "screen";
    stream: MediaStream;
  }>());
  const participantVideoStreamsRef = useRef(new Map<string, MediaStream>());
  const remoteTeacherVideoStreamsRef = useRef(new Map<"camera" | "screen", MediaStream>());
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const displayedVideoStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioTracksRef = useRef<Map<string, MediaStreamTrack>>(new Map());
  const producerRef = useRef<{ camera?: any; microphone?: any; screen?: any }>({});
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAnimationRef = useRef<number>(0);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingAudioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const recordingStartedAtRef = useRef<number>(0);
  const recordingSessionIdRef = useRef("");
  const recordingChunkNumberRef = useRef(1);
  const recordingChunkWritesRef = useRef<Set<Promise<void>>>(new Set());
  const recordingQueueProcessingRef = useRef(false);
  const recordingQueueRequestedRef = useRef(false);
  const recordingQueueResumeRequestedRef = useRef(false);
  const recordingUploadAbortRef = useRef<AbortController | null>(null);
  const recordingQueueRetryAttemptRef = useRef(0);
  const recordingQueueRetryTimerRef = useRef<number | undefined>(undefined);
  const recordingFinalizePendingRef = useRef(false);
  const audioOnlyRef = useRef(false);
  const cameraWantedRef = useRef(true);
  const microphoneWantedRef = useRef(false);
  const videoRecoveryTimerRef = useRef<number | undefined>(undefined);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [recordingQueueCount, setRecordingQueueCount] = useState(0);
  const [recordingUploadStatus, setRecordingUploadStatus] = useState<"uploading" | "waiting" | "">("");
  const [connectionQuality, setConnectionQuality] = useState<"good" | "slow" | "reconnecting">("good");
  const [audioOnly, setAudioOnly] = useState(false);

  const [info, setInfo] = useState<JoinResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [participantVideoStreams, setParticipantVideoStreams] = useState<Map<string, MediaStream>>(
    () => new Map(),
  );
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [micAllowed, setMicAllowed] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [raisedHand, setRaisedHand] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatMessageIdRef = useRef("");
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const [selfProfile, setSelfProfile] = useState<{ id?: string; name: string; role?: string; profilePhotoUrl?: string }>({
    name: "You",
  });
  const [retryKey, setRetryKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeSaving, setThemeSaving] = useState(false);

  const isTeacher = info?.role === "teacher";
  const isStudent = info?.role === "learner" || info?.role === "student";
  isTeacherRef.current = isTeacher;

  function updateParticipantVideoStream(participantId: string, stream: MediaStream | null) {
    const next = new Map(participantVideoStreamsRef.current);
    if (stream) next.set(participantId, stream);
    else next.delete(participantId);
    participantVideoStreamsRef.current = next;
    setParticipantVideoStreams(next);
  }

  const joinDisplay = useMemo(() => info?.startsAt
    ? new Intl.DateTimeFormat("en-CM", { dateStyle: "full", timeStyle: "short" })
      .format(new Date(info.startsAt))
    : "On-demand live class", [info]);

  useEffect(() => {
    if (recordingStatus !== "Recording automatically" || !recordingStartedAtRef.current) return;
    const updateElapsed = () => setRecordingElapsedSeconds(
      Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)),
    );
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [recordingStatus]);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [chatMessages]);

  function refreshRemoteAudio() {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    const tracks = [...remoteAudioTracksRef.current.values()].filter((track) => track.readyState === "live");
    audio.srcObject = tracks.length ? new MediaStream(tracks) : null;
    if (tracks.length) {
      void audio.play().catch(() => {
        setNotice("Interact with the classroom to enable audio playback.");
      });
    }
  }

  function removeConsumer(consumerId: string) {
    consumersRef.current.delete(consumerId);
    if (remoteAudioTracksRef.current.delete(consumerId)) refreshRemoteAudio();
    const metadata = consumerVideoMetadataRef.current.get(consumerId);
    if (!metadata) return;
    consumerVideoMetadataRef.current.delete(consumerId);

    let replacement: MediaStream | null = null;
    for (const candidate of consumerVideoMetadataRef.current.values()) {
      if (candidate.participantId === metadata.participantId) replacement = candidate.stream;
    }
    if (participantVideoStreamsRef.current.get(metadata.participantId) === metadata.stream) {
      updateParticipantVideoStream(metadata.participantId, replacement);
    }

    if (metadata.role === "teacher" && remoteTeacherVideoStreamsRef.current.get(metadata.source) === metadata.stream) {
      let teacherReplacement: MediaStream | null = null;
      for (const candidate of consumerVideoMetadataRef.current.values()) {
        if (candidate.role === "teacher" && candidate.source === metadata.source) {
          teacherReplacement = candidate.stream;
        }
      }
      if (teacherReplacement) remoteTeacherVideoStreamsRef.current.set(metadata.source, teacherReplacement);
      else remoteTeacherVideoStreamsRef.current.delete(metadata.source);
      if (!isTeacherRef.current) displayRemoteTeacherVideo();
    }
  }

  function displayVideoStream(stream: MediaStream | null) {
    displayedVideoStreamRef.current = stream;
    if (!audioOnlyRef.current && mediaVideoRef.current) {
      mediaVideoRef.current.srcObject = stream;
      setHasVideo(Boolean(stream));
    }
  }

  function displayRemoteTeacherVideo() {
    displayVideoStream(
      remoteTeacherVideoStreamsRef.current.get("screen") ||
      remoteTeacherVideoStreamsRef.current.get("camera") ||
      null,
    );
  }

  function clearRemoteVideoStreams() {
    participantVideoStreamsRef.current.clear();
    setParticipantVideoStreams(new Map());
    consumerVideoMetadataRef.current.clear();
    remoteTeacherVideoStreamsRef.current.clear();
    if (!isTeacherRef.current) displayVideoStream(null);
  }

  function emitVideoMode(enabled: boolean) {
    const socket = socketRef.current;
    if (!socket?.connected || !deviceRef.current) return;
    socket.emit("live-class:video-mode", { enabled }, (response: { ok?: boolean; error?: string }) => {
      if (!response?.ok) setError(response?.error || "Video quality could not be updated.");
    });
  }

  async function setAudioOnlyMode(
    enabled: boolean,
    quality: "slow" | "reconnecting" = "slow",
  ) {
    if (!enabled && (isNetworkSlow() || !socketRef.current?.connected)) return;
    if (audioOnlyRef.current === enabled) {
      if (enabled) setConnectionQuality(quality);
      return;
    }
    audioOnlyRef.current = enabled;
    setAudioOnly(enabled);
    setConnectionQuality(enabled ? quality : "good");

    if (enabled) {
      setNotice("Network is slow. Video paused; audio continues.");
      cameraStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = false; });
      screenStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = false; });
      if (mediaVideoRef.current) mediaVideoRef.current.srcObject = null;
      setHasVideo(false);
      setCameraOn(false);
      for (const producer of [producerRef.current.camera, producerRef.current.screen]) {
        if (!producer || producer.paused) continue;
        try {
          await producer.pause();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Video could not pause for the slow connection.");
        }
      }
      for (const consumer of consumersRef.current.values()) {
        if (consumer.kind === "video" && !consumer.paused) consumer.pause();
      }
      emitVideoMode(false);
      return;
    }

    if (cameraWantedRef.current) {
      cameraStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = true; });
    }
    screenStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = true; });
    for (const [producer, wanted] of [
      [producerRef.current.camera, cameraWantedRef.current],
      [producerRef.current.screen, Boolean(screenStreamRef.current)],
    ] as const) {
      if (!producer || !wanted || !producer.paused) continue;
      try {
        await producer.resume();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Video could not resume.");
      }
    }
    for (const consumer of consumersRef.current.values()) {
      if (consumer.kind === "video" && consumer.paused) consumer.resume();
    }
    emitVideoMode(true);
    if (displayedVideoStreamRef.current && mediaVideoRef.current) {
      mediaVideoRef.current.srcObject = displayedVideoStreamRef.current;
      setHasVideo(true);
    } else {
      setHasVideo(false);
    }
    consumePendingProducers();
    setCameraOn(Boolean(cameraWantedRef.current && cameraStreamRef.current));
    setScreenOn(Boolean(screenStreamRef.current));
    setNotice("Connection stable. Video restored.");
  }

  function scheduleVideoRecovery() {
    if (isNetworkSlow() || !socketRef.current?.connected || !deviceRef.current) return;
    if (videoRecoveryTimerRef.current) window.clearTimeout(videoRecoveryTimerRef.current);
    videoRecoveryTimerRef.current = window.setTimeout(() => {
      videoRecoveryTimerRef.current = undefined;
      if (isNetworkSlow() || !socketRef.current?.connected) return;
      setConnectionQuality("good");
      void setAudioOnlyMode(false).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Video could not resume.");
      });
    }, 5000);
  }

  function applyLiveTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    document.querySelector(".livekit-page")?.classList.toggle("is-dark", nextTheme === "dark");
    document.body.classList.toggle("is-dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }

  async function loadLiveTheme() {
    try {
      const result = await requestLiveTheme();
      if (!result.ok) return;
      if (result.theme === "light" || result.theme === "dark") applyLiveTheme(result.theme);
    } catch {
      applyLiveTheme("light");
    }
  }

  async function toggleLiveTheme() {
    if (themeSaving) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeSaving(true);
    applyLiveTheme(nextTheme);
    try {
      const response = await fetch("/api/collaboration/preferences", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      const result = await response.json() as { theme?: "light" | "dark"; error?: string };
      if (!response.ok) throw new Error(result.error || "The theme could not be saved.");
      if (result.theme) applyLiveTheme(result.theme);
      try {
        window.localStorage.setItem("tgf-dashboard-theme", result.theme || nextTheme);
      } catch {
        // Theme is still saved by the server.
      }
      setNotice("Theme preference saved.");
    } catch (reason) {
      applyLiveTheme(theme);
      setError(reason instanceof Error ? reason.message : "The theme could not be saved.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function socketRequest<T>(event: string, payload: object = {}): Promise<T> {
    const socket = socketRef.current;
    if (!socket) throw new Error("The live-class connection is not ready.");
    return await new Promise<T>((resolve) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: "The network is slow. Please keep this page open and retry." } as T);
      }, 45000);
      socket.emit(event, payload, (response: T) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  async function consumeProducer(producer: MediaProducer) {
    const socket = socketRef.current;
    if (!socket || !deviceRef.current || (producer.kind === "video" && audioOnlyRef.current)) {
      pendingProducersRef.current.set(producer.producerId, producer);
      return;
    }
    const { producerId, kind } = producer;
    if (consumingProducerIdsRef.current.has(producerId) ||
        [...consumersRef.current.values()].some((consumer) => consumer.producerId === producerId)) return;
    consumingProducerIdsRef.current.add(producerId);
    try {
      if (!receiveTransportRef.current) {
        const transportResult = await socketRequest<any>("live-class:create-transport", { direction: "receive" });
        if (!transportResult.ok) throw new Error(transportResult.error);
        const transport = deviceRef.current.createRecvTransport({
          ...transportResult.params,
          iceServers: transportResult.iceServers || [],
        });
        receiveTransportRef.current = transport;
        transport.on("connect", async ({ dtlsParameters }: any, callback: () => void, errback: (error: Error) => void) => {
          try {
            const response = await socketRequest<any>("live-class:connect-transport", {
              transportId: transport.id,
              dtlsParameters,
            });
            if (!response.ok) throw new Error(response.error);
            callback();
          } catch (transportError) {
            errback(transportError instanceof Error ? transportError : new Error("Receive transport failed."));
          }
        });
        transport.on("connectionstatechange", (state: string) => {
          if (state === "disconnected" || state === "failed") {
            setConnectionQuality("reconnecting");
            void setAudioOnlyMode(true, "reconnecting").catch((reason) => {
              setError(reason instanceof Error ? reason.message : "The connection is unstable.");
            });
          } else if (state === "connected") {
            scheduleVideoRecovery();
          }
        });
      }
      const response = await socketRequest<any>("live-class:consume", {
        transportId: receiveTransportRef.current.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      });
      if (!response.ok) throw new Error(response.error);
      const consumer = await receiveTransportRef.current.consume({
        id: response.params.id,
        producerId: response.params.producerId,
        kind: response.params.kind,
        rtpParameters: response.params.rtpParameters,
      });
      consumersRef.current.set(consumer.id, consumer);
      consumer.on("transportclose", () => removeConsumer(consumer.id));
      consumer.on("producerclose", () => removeConsumer(consumer.id));
      consumer.on("trackended", () => removeConsumer(consumer.id));
      const stream = new MediaStream([consumer.track]);
      if (response.params.kind === "video") {
        const source = producer.source === "screen" ? "screen" : "camera";
        consumerVideoMetadataRef.current.set(consumer.id, {
          participantId: producer.participantId,
          role: producer.role,
          source,
          stream,
        });
        updateParticipantVideoStream(producer.participantId, stream);
        if (producer.role === "teacher" && !isTeacherRef.current) {
          remoteTeacherVideoStreamsRef.current.set(source, stream);
          displayRemoteTeacherVideo();
        }
        if (audioOnlyRef.current) consumer.pause();
      }
      if (response.params.kind === "audio") {
        remoteAudioTracksRef.current.set(consumer.id, consumer.track);
        refreshRemoteAudio();
        if (recordingAudioContextRef.current && recordingAudioDestinationRef.current) {
          const key = response.params.producerId;
          if (!recordingAudioSourcesRef.current.has(key)) {
            const source = recordingAudioContextRef.current.createMediaStreamSource(stream);
            source.connect(recordingAudioDestinationRef.current);
            recordingAudioSourcesRef.current.set(key, source);
          }
        }
      }
    } finally {
      consumingProducerIdsRef.current.delete(producerId);
    }
  }

  function consumePendingProducers() {
    if (!deviceRef.current) return;
    const pending = [...pendingProducersRef.current.values()];
    for (const producer of pending) {
      if (producer.kind === "video" && audioOnlyRef.current) continue;
      pendingProducersRef.current.delete(producer.producerId);
      void consumeProducer(producer).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Remote media could not be received.");
      });
    }
  }

  async function createSendTransport() {
    const socket = socketRef.current;
    if (!socket) throw new Error("Not connected.");
    const result = await socketRequest<any>("live-class:create-transport", { direction: "send" });
    if (!result.ok) throw new Error(result.error);
    const transport = sendTransportRef.current ??
      deviceRef.current!.createSendTransport({
        ...result.params,
        iceServers: result.iceServers || [],
      });
    sendTransportRef.current = transport;
    transport.on("connect", async ({ dtlsParameters }: any, callback: () => void, errback: (error: Error) => void) => {
      try {
        const response = await socketRequest<any>("live-class:connect-transport", {
          transportId: transport.id,
          dtlsParameters,
        });
        if (!response.ok) throw new Error(response.error);
        callback();
      } catch (transportError) {
        errback(transportError instanceof Error ? transportError : new Error("Transport connection failed."));
      }
    });
    transport.on("produce", async ({ kind, rtpParameters, appData }: any, callback: (data: { id: string }) => void, errback: (error: Error) => void) => {
      try {
        const response = await socketRequest<any>("live-class:produce", {
          transportId: transport.id,
          kind,
          rtpParameters,
          source: appData?.source,
        });
        if (!response.ok) throw new Error(response.error);
        callback({ id: response.producerId });
      } catch (produceError) {
        errback(produceError instanceof Error ? produceError : new Error("Media could not be published."));
      }
    });
    transport.on("connectionstatechange", (state: string) => {
      if (state === "disconnected" || state === "failed") {
        setConnectionQuality("reconnecting");
        void setAudioOnlyMode(true, "reconnecting").catch((reason) => {
          setError(reason instanceof Error ? reason.message : "The connection is unstable.");
        });
      } else if (state === "connected") {
        scheduleVideoRecovery();
      }
    });
    return transport;
  }

  async function openCamera() {
    if (!cameraStreamRef.current) {
      try {
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 360, max: 720 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: "user",
          },
          audio: false,
        });
      } catch (reason) {
        throw new Error(reason instanceof DOMException && reason.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in browser settings."
          : "A camera could not be opened. Check that a camera is connected.");
      }
    }
    const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
    cameraWantedRef.current = true;
    videoTrack.enabled = !audioOnlyRef.current;
    setLocalVideoStream(cameraStreamRef.current);
    if (isTeacherRef.current) displayVideoStream(cameraStreamRef.current);
    if (deviceRef.current && sendTransportRef.current) {
      const transport = sendTransportRef.current;
      if (!producerRef.current.camera) {
        producerRef.current.camera = await transport.produce({
          track: videoTrack,
          encodings: [{ maxBitrate: 500_000 }],
          codecOptions: { videoGoogleStartBitrate: 300 },
          appData: { source: "camera" },
        });
      }
      if (audioOnlyRef.current) {
        if (!producerRef.current.camera.paused) await producerRef.current.camera.pause();
      } else if (producerRef.current.camera.paused) {
        await producerRef.current.camera.resume();
      }
    }
    setCameraOn(!audioOnlyRef.current);
  }

  async function openMicrophone() {
    let microphoneStream = microphoneStreamRef.current;
    if (!microphoneStream) {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (reason) {
        throw new Error(reason instanceof DOMException && reason.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in browser settings."
          : "A microphone could not be opened.");
      }
      microphoneStreamRef.current = microphoneStream;
    }
    microphoneWantedRef.current = true;
    const audioTrack = microphoneStream.getAudioTracks()[0];
    audioTrack.enabled = true;
    setMicOn(true);
    if (deviceRef.current && sendTransportRef.current) {
      if (!producerRef.current.microphone) {
        producerRef.current.microphone = await sendTransportRef.current.produce({ track: audioTrack });
      } else if (producerRef.current.microphone.paused) {
        await producerRef.current.microphone.resume();
      }
    }
    if (socketRef.current?.connected && deviceRef.current) {
      const response = await socketRequest<any>("live-class:microphone-self", { enabled: true });
      if (!response.ok) throw new Error(response.error);
    }
  }

  async function synchronizeMicrophone(enabled: boolean) {
    if (!socketRef.current?.connected) return;
    const response = await socketRequest<any>("live-class:microphone-self", { enabled });
    if (!response.ok) throw new Error(response.error);
  }

  async function toggleMicrophone() {
    if (!isTeacher && !micAllowed) {
      setNotice("Teacher unmuted you");
      return;
    }
    setBusy(true);
    try {
      const existingStream = microphoneStreamRef.current;
      const existingTrack = existingStream?.getAudioTracks()[0];
      if (!existingTrack) {
        await openMicrophone();
      } else {
        const nextEnabled = !existingTrack.enabled;
        existingTrack.enabled = nextEnabled;
        microphoneWantedRef.current = nextEnabled;
        setMicOn(nextEnabled);
        if (producerRef.current.microphone) {
          if (nextEnabled && producerRef.current.microphone.paused) {
            await producerRef.current.microphone.resume();
          } else if (!nextEnabled && !producerRef.current.microphone.paused) {
            await producerRef.current.microphone.pause();
          }
        }
        await synchronizeMicrophone(nextEnabled);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Microphone unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCamera() {
    setBusy(true);
    try {
      if (cameraOn) {
        cameraWantedRef.current = false;
        await producerRef.current.camera?.pause();
        cameraStreamRef.current?.getVideoTracks().forEach((track) => track.enabled = false);
        setLocalVideoStream(null);
        if (isTeacherRef.current && displayedVideoStreamRef.current === cameraStreamRef.current) displayVideoStream(null);
        setCameraOn(false);
      } else {
        cameraWantedRef.current = true;
        await openCamera();
      }
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Camera unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function shareScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (deviceRef.current && sendTransportRef.current) {
        producerRef.current.screen = await sendTransportRef.current.produce({
          track,
          appData: { source: "screen" },
        });
        if (audioOnlyRef.current) {
          track.enabled = false;
          await producerRef.current.screen.pause();
        }
      }
      displayVideoStream(stream);
      setScreenOn(true);
      track.addEventListener("ended", () => void stopScreenShare(), { once: true });
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "Screen sharing was cancelled or permission was denied."
        : "Screen sharing is not available in this browser.");
    }
  }

  async function stopScreenShare() {
    if (producerRef.current.screen) {
      await producerRef.current.screen.close();
      producerRef.current.screen = undefined;
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    displayVideoStream(isTeacher && cameraWantedRef.current ? cameraStreamRef.current : null);
    setScreenOn(false);
  }

  function scheduleRecordingQueueRetry(sessionId: string) {
    if (recordingQueueRetryTimerRef.current) {
      window.clearTimeout(recordingQueueRetryTimerRef.current);
    }
    const delay = Math.min(5_000, 1_000 * (2 ** Math.min(recordingQueueRetryAttemptRef.current, 3)));
    recordingQueueRetryAttemptRef.current += 1;
    recordingQueueRetryTimerRef.current = window.setTimeout(() => {
      recordingQueueRetryTimerRef.current = undefined;
      void processPendingRecordingUploads(sessionId);
    }, delay);
  }

  async function processPendingRecordingUploads(sessionId: string) {
    if (recordingQueueProcessingRef.current) {
      recordingQueueRequestedRef.current = true;
      return;
    }
    recordingQueueProcessingRef.current = true;
    recordingQueueRequestedRef.current = false;
    if (recordingQueueRetryTimerRef.current) {
      window.clearTimeout(recordingQueueRetryTimerRef.current);
      recordingQueueRetryTimerRef.current = undefined;
    }
    try {
      while (true) {
        const chunks = await getQueuedRecordingChunks(sessionId);
        setRecordingQueueCount(chunks.length);
        if (!chunks.length) break;
        if (!navigator.onLine) throw new Error("offline");
        setRecordingUploadStatus("uploading");

        const queuedChunk = chunks[0];
        const form = new FormData();
        form.append("chunk", queuedChunk.blob, `recording-${queuedChunk.chunkNumber}.webm`);
        form.append("chunkNumber", String(queuedChunk.chunkNumber));
        form.append("elapsedSeconds", String(queuedChunk.elapsedSeconds));
        const controller = new AbortController();
        recordingUploadAbortRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 30_000);
        let response: Response;
        try {
          response = await fetch(
            `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-chunk`,
            {
              method: "POST",
              credentials: "same-origin",
              body: form,
              signal: controller.signal,
            },
          );
        } finally {
          window.clearTimeout(timeout);
          if (recordingUploadAbortRef.current === controller) recordingUploadAbortRef.current = null;
        }
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "A recording chunk could not be uploaded.");
        await removeQueuedRecordingChunk(queuedChunk.key);
        setRecordingQueueCount((count) => Math.max(0, count - 1));
      }

      const session = await getRecordingQueueSession(sessionId);
      if (session?.finalizePending) {
        if (!navigator.onLine) throw new Error("offline");
        setRecordingStatus("Uploading recording...");
        setRecordingUploadStatus("uploading");
        const controller = new AbortController();
        recordingUploadAbortRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 120_000);
        let response: Response;
        try {
          response = await fetch(
            `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-finalize`,
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: "{}",
              signal: controller.signal,
            },
          );
        } finally {
          window.clearTimeout(timeout);
          if (recordingUploadAbortRef.current === controller) recordingUploadAbortRef.current = null;
        }
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "The recording could not be finalized.");
        await clearRecordingQueueSession(sessionId);
        recordingFinalizePendingRef.current = false;
        recordingQueueRetryAttemptRef.current = 0;
        setRecordingQueueCount(0);
        setRecordingUploadStatus("");
        setRecordingStatus("Recording uploaded");
      } else {
        recordingQueueRetryAttemptRef.current = 0;
        setRecordingUploadStatus("");
        setNotice((current) =>
          current.startsWith("Connection interrupted.") ||
          current.startsWith("Connection restored.")
            ? ""
            : current);
      }
    } catch (reason) {
      setRecordingUploadStatus("waiting");
      setNotice("Connection interrupted. Recording chunks are safely queued and will upload automatically when internet returns.");
      if (reason instanceof Error &&
          !/offline|fetch|network|abort|timeout/i.test(reason.message)) {
        setError(reason.message);
      }
      scheduleRecordingQueueRetry(sessionId);
    } finally {
      recordingQueueProcessingRef.current = false;
      if (recordingQueueResumeRequestedRef.current) {
        recordingQueueResumeRequestedRef.current = false;
        recordingQueueRequestedRef.current = false;
        if (recordingQueueRetryTimerRef.current) {
          window.clearTimeout(recordingQueueRetryTimerRef.current);
          recordingQueueRetryTimerRef.current = undefined;
        }
        void processPendingRecordingUploads(recordingSessionIdRef.current || sessionId);
        return;
      }
      if (recordingQueueRequestedRef.current && !recordingQueueRetryTimerRef.current) {
        recordingQueueRequestedRef.current = false;
        void processPendingRecordingUploads(recordingSessionIdRef.current || sessionId);
      }
    }
  }

  async function restoreRecordingQueue(sessionId: string) {
    const session = await ensureRecordingQueueSession(sessionId);
    recordingSessionIdRef.current = sessionId;
    recordingChunkNumberRef.current = session.lastChunkNumber + 1;
    recordingStartedAtRef.current = session.startedAt;
    recordingFinalizePendingRef.current = session.finalizePending;
    const queuedChunks = await getQueuedRecordingChunks(sessionId);
    setRecordingQueueCount(queuedChunks.length);
    if (queuedChunks.length || session.finalizePending) {
      void processPendingRecordingUploads(sessionId);
    }
  }

  async function startAutomaticRecording(sessionId: string) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream ||
        !window.AudioContext) {
      throw new Error("This browser cannot record the class. Use a current Chrome or Edge browser.");
    }
    if (mediaRecorderRef.current?.state === "recording") return;
    await restoreRecordingQueue(sessionId);
    if (recordingFinalizePendingRef.current) {
      throw new Error("The previous recording is still waiting to upload. Keep this page open until it finishes.");
    }
    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error("This browser has no supported recording format.");

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    recordingCanvasRef.current = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The recording canvas could not be created.");

    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();
    recordingAudioContextRef.current = audioContext;
    recordingAudioDestinationRef.current = audioDestination;
    if (microphoneStreamRef.current) {
      const localSource = audioContext.createMediaStreamSource(microphoneStreamRef.current);
      localSource.connect(audioDestination);
      recordingAudioSourcesRef.current.set("teacher-local", localSource);
    }

    const canvasStream = canvas.captureStream(20);
    const mixedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(mixedStream, { mimeType });
    mediaRecorderRef.current = recorder;
    setRecordingElapsedSeconds(0);

    const draw = () => {
      context.fillStyle = "#151714";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const video = mediaVideoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      } else {
        context.fillStyle = "#f4f2e9";
        context.font = "bold 36px sans-serif";
        context.fillText("TGFVP Live Class", 48, 72);
      }
      recordingAnimationRef.current = window.requestAnimationFrame(draw);
    };
    recordingAnimationRef.current = window.requestAnimationFrame(draw);

    recorder.addEventListener("dataavailable", (event) => {
      if (!event.data.size) return;
      const chunkNumber = recordingChunkNumberRef.current;
      recordingChunkNumberRef.current += 1;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
      const save = queueRecordingChunk(sessionId, chunkNumber, elapsedSeconds, event.data)
        .then(async () => {
          setRecordingQueueCount((count) => count + 1);
          await processPendingRecordingUploads(sessionId);
        })
        .catch((reason) => {
          setError(reason instanceof Error
            ? reason.message
            : "A recording chunk could not be saved in this browser.");
        });
      recordingChunkWritesRef.current.add(save);
      void save.finally(() => recordingChunkWritesRef.current.delete(save));
    });
    recorder.start(5000);
    setRecordingStatus("Recording automatically");
  }

  async function stopAutomaticRecording(sessionId: string) {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }
    await Promise.all([...recordingChunkWritesRef.current]);
    window.cancelAnimationFrame(recordingAnimationRef.current);
    for (const source of recordingAudioSourcesRef.current.values()) source.disconnect();
    recordingAudioSourcesRef.current.clear();
    if (recordingAudioContextRef.current?.state !== "closed") {
      await recordingAudioContextRef.current?.close();
    }
    mediaRecorderRef.current = null;

    await markRecordingQueueFinalizing(sessionId);
    recordingFinalizePendingRef.current = true;
    setRecordingStatus("Waiting to upload recording...");
    await processPendingRecordingUploads(sessionId);
  }

  useEffect(() => {
    const resumeUploads = () => {
      const sessionId = recordingSessionIdRef.current;
      if (!sessionId) return;
      recordingQueueRetryAttemptRef.current = 0;
      setNotice("Connection restored. Uploading queued recording chunks.");
      if (recordingQueueProcessingRef.current) {
        recordingQueueResumeRequestedRef.current = true;
        recordingQueueRequestedRef.current = true;
        return;
      }
      if (recordingQueueRetryTimerRef.current) {
        window.clearTimeout(recordingQueueRetryTimerRef.current);
        recordingQueueRetryTimerRef.current = undefined;
      }
      void processPendingRecordingUploads(sessionId);
    };
    const pauseUploads = () => {
      if (mediaRecorderRef.current?.state === "recording" || recordingFinalizePendingRef.current) {
        recordingUploadAbortRef.current?.abort();
        setRecordingUploadStatus("waiting");
        setNotice("Connection interrupted. Recording continues locally and will upload automatically when internet returns.");
      }
    };
    window.addEventListener("online", resumeUploads);
    window.addEventListener("offline", pauseUploads);
    return () => {
      window.removeEventListener("online", resumeUploads);
      window.removeEventListener("offline", pauseUploads);
      if (recordingQueueRetryTimerRef.current) {
        window.clearTimeout(recordingQueueRetryTimerRef.current);
      }
    };
  }, []);

  async function startClass() {
    setBusy(true);
    try {
      if (!audioOnlyRef.current) {
        try {
          await openCamera();
        } catch (cameraError) {
          setNotice(cameraError instanceof Error
            ? `${cameraError.message} The class will continue without video.`
            : "Camera unavailable. The class will continue without video.");
        }
      }
      if (!info?.sessionId) throw new Error("The live class session is unavailable.");
      let microphoneAvailable = true;
      try {
        await openMicrophone();
      } catch (reason) {
        microphoneAvailable = false;
        setNotice(reason instanceof Error ? reason.message : "Microphone unavailable. The class can still start.");
      }
      let recordingAvailable = false;
      if (microphoneAvailable) {
        try {
          await startAutomaticRecording(info.sessionId);
          recordingAvailable = mediaRecorderRef.current?.state === "recording";
        } catch (reason) {
          setNotice(reason instanceof Error
            ? `${reason.message} The class will continue without a recording.`
            : "Recording could not start. The class will continue without a recording.");
        }
      }
      const response = await fetch(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/start`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingAvailable }),
        },
      );
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The class could not be started.");
      if (socketRef.current?.connected) {
        const signal = await socketRequest<any>("live-class:start");
        if (!signal.ok) {
          setNotice("The class started, but the live update could not be sent. Students will connect when their media connection recovers.");
        }
      }
      setEnded(false);
      setStarted(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The class could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function endClass() {
    if (!window.confirm("End this live class for everyone?")) return;
    setBusy(true);
    try {
      if (!info?.sessionId) throw new Error("The live class session is unavailable.");
      const response = await fetch(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/end`,
        { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The class could not be ended.");
      if (socketRef.current?.connected) socketRef.current.emit("live-class:end");
      if (started || mediaRecorderRef.current) {
        try {
          await stopAutomaticRecording(info.sessionId);
        } catch (recordingError) {
          setError(recordingError instanceof Error
            ? recordingError.message
            : "The recording could not be uploaded.");
        }
      }
      finishClass("Class ended for everyone.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The class could not be ended.");
    } finally {
      setBusy(false);
    }
  }

  async function setMicrophone(participantId: string, allowed: boolean) {
    const response = await socketRequest<any>("live-class:mute", { participantId, allow: allowed });
    if (!response.ok) setError(response.error);
  }

  async function toggleRaisedHand() {
    const next = !raisedHand;
    socketRef.current?.emit("live-class:raised-hand", next);
    setRaisedHand(next);
  }

  async function submitChatMessage(body: string) {
    if (!info?.sessionId || !body) return;
    if (!chatMessageIdRef.current) chatMessageIdRef.current = crypto.randomUUID();
    setChatSending(true);
    setChatError("");
    try {
      const response = await fetch(
        `/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/chat`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientMessageId: chatMessageIdRef.current, body }),
        },
      );
      const result = await response.json() as { message?: ChatMessage; error?: string };
      if (!response.ok || !result.message) {
        throw new Error(result.error || "The message could not be sent.");
      }
      setChatMessages((previous) => mergeChatMessages(previous, [result.message!]));
      setChatDraft("");
      chatMessageIdRef.current = "";
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit("live-class:chat-published", { messageId: result.message.id }, (ack: { ok?: boolean }) => {
          if (!ack?.ok) setNotice("Message saved. Other participants will see it when their connection recovers.");
        });
      }
    } catch (reason) {
      setChatError(reason instanceof Error ? reason.message : "The message could not be sent. Retry.");
    } finally {
      setChatSending(false);
    }
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = chatDraft.trim();
    void submitChatMessage(body);
  }

  function finishClass(message: string) {
    setEnded(true);
    setStarted(false);
    setConnected(false);
    setMicAllowed(false);
    setNotice(message);
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    sendTransportRef.current?.close();
    receiveTransportRef.current?.close();
    if (mediaVideoRef.current) mediaVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteAudioTracksRef.current.clear();
    displayedVideoStreamRef.current = null;
    pendingProducersRef.current.clear();
    clearRemoteVideoStreams();
    setLocalVideoStream(null);
    setCameraOn(false);
    setHasVideo(false);
    setScreenOn(false);
  }

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("tgf-dashboard-theme");
      if (savedTheme === "dark" || savedTheme === "light") applyLiveTheme(savedTheme);
    } catch {
      // The server preference is loaded below.
    }
    void loadLiveTheme();
    return () => {
      document.querySelector(".livekit-page")?.classList.remove("is-dark");
    };
  }, []);

  useEffect(() => {
    const connection = getNetworkInformation();
    if (!connection) return;
    const updateNetworkMode = () => {
      if (isNetworkSlow()) {
        if (videoRecoveryTimerRef.current) window.clearTimeout(videoRecoveryTimerRef.current);
        videoRecoveryTimerRef.current = undefined;
        if (socketRef.current?.connected) {
          setConnectionQuality("slow");
          void setAudioOnlyMode(true, "slow").catch((reason) => {
            setError(reason instanceof Error ? reason.message : "The connection is unstable.");
          });
        }
      } else {
        scheduleVideoRecovery();
      }
    };
    connection.addEventListener("change", updateNetworkMode);
    updateNetworkMode();
    return () => {
      connection.removeEventListener("change", updateNetworkMode);
      if (videoRecoveryTimerRef.current) window.clearTimeout(videoRecoveryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function join() {
      try {
        const joinUrl = liveSessionId
          ? `/api/collaboration/live-sessions/${encodeURIComponent(liveSessionId)}/join`
          : `/api/collaboration/sessions/${encodeURIComponent(slotId)}/join`;
        const result = await requestLiveJoin(joinUrl, liveSessionId ? {} : { classDate });
        if (!active) return;
        isTeacherRef.current = result.role === "teacher";
        setInfo(result);
        setStarted(Boolean(result.started));
        if (cameraWantedRef.current) {
          try {
            await openCamera();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Camera could not be opened.");
          }
        }
        if (result.transport !== "mediasoup") {
          throw new Error("This class is not configured for the mediasoup classroom service.");
        }
        if (result.waitingForTeacher) setNotice("Waiting for your teacher to start");

        const socket = io({
          path: "/live-class/socket.io",
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 10000,
          timeout: 30000,
        });
        socketRef.current = socket;
        socket.on("connect", () => {
          setConnected(true);
          if (isNetworkSlow()) {
            setConnectionQuality("slow");
            void setAudioOnlyMode(true, "slow").catch((reason) => {
              setError(reason instanceof Error ? reason.message : "The connection is unstable.");
            });
          } else {
            setConnectionQuality(audioOnlyRef.current ? "slow" : "good");
            scheduleVideoRecovery();
          }
        });
        socket.on("connect_error", (reason) => {
          setConnected(false);
          setConnecting(false);
          setConnectionQuality("reconnecting");
          setAudioOnly(false);
          audioOnlyRef.current = false;
          setError(reason?.message
            ? `Live media could not connect: ${reason.message}`
            : "Live media could not connect. The media server may need to be restarted.");
        });
        socket.on("disconnect", () => {
          setConnected(false);
          void setAudioOnlyMode(true, "reconnecting").catch((reason) => {
            setError(reason instanceof Error ? reason.message : "The connection is unstable.");
          });
          setConnectionQuality("reconnecting");
          setNotice("Reconnecting... Your class is still available.");
          sendTransportRef.current?.close();
          receiveTransportRef.current?.close();
          sendTransportRef.current = null;
          receiveTransportRef.current = null;
          consumersRef.current.clear();
          consumingProducerIdsRef.current.clear();
          pendingProducersRef.current.clear();
          remoteAudioTracksRef.current.clear();
          refreshRemoteAudio();
          clearRemoteVideoStreams();
          producerRef.current = {};
        });
        socket.io.on("reconnect_attempt", () => {
          setConnectionQuality("reconnecting");
          void setAudioOnlyMode(true, "reconnecting").catch((reason) => {
            setError(reason instanceof Error ? reason.message : "The connection is unstable.");
          });
        });
        socket.io.on("reconnect", () => {
          setConnectionQuality("reconnecting");
          setNotice("Connection restored. Switching video back on when stable.");
          void new Promise<any>((resolve) => {
            const timeout = window.setTimeout(() => resolve({ ok: false, error: "Rejoin timed out. Retry when the network is stable." }), 45000);
            socket.emit("live-class:join", { sessionId: result.sessionId }, (response: any) => {
              window.clearTimeout(timeout);
              resolve(response);
            });
          }).then(async (rejoin) => {
            if (!rejoin.ok) {
              setError(rejoin.error);
              return;
            }
            setParticipants(rejoin.participants);
            setAttendees(rejoin.attendees || []);
            setChatMessages((previous) =>
              mergeChatMessages(previous, rejoin.chatMessages || []));
            setStarted((previous) => previous || Boolean(rejoin.started));
            const ownParticipant = rejoin.participants.find((item: ParticipantState) =>
              item.id === rejoin.participantId);
            setMicAllowed(rejoin.role !== "student" || Boolean(ownParticipant?.micAllowed));
            for (const producer of rejoin.producers || []) {
              void consumeProducer(producer).catch((reason) => {
                setError(reason instanceof Error ? reason.message : "Remote media could not be restored.");
              });
            }
            if (cameraWantedRef.current) {
              try {
                await openCamera();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Camera could not restart.");
              }
            }
            if (microphoneWantedRef.current) {
              try {
                await openMicrophone();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Microphone could not restart.");
              }
            }
            if (rejoin.role === "teacher" && rejoin.started && !mediaRecorderRef.current) {
              try {
                if (microphoneWantedRef.current) await openMicrophone();
                await startAutomaticRecording(result.sessionId);
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "The recording could not resume.");
              }
            }
            emitVideoMode(!audioOnlyRef.current);
            if (isNetworkSlow()) setConnectionQuality("slow");
            else scheduleVideoRecovery();
          });
        });
        socket.on("live-class:participant-state", (participant: ParticipantState) => {
          setParticipants((previous) => {
            const next = previous.filter((item) => item.id !== participant.id);
            return [...next, participant];
          });
          if (participant.role === "teacher" && !isTeacherRef.current) {
            if (participant.cameraOn) displayRemoteTeacherVideo();
            else displayVideoStream(null);
          }
        });
        socket.on("live-class:participants", setParticipants);
        socket.on("live-class:attendees", setAttendees);
        socket.on("live-class:started", () => {
          setEnded(false);
          setStarted(true);
        });
        socket.on("live-class:ended", () => finishClass("The teacher ended this class."));
        socket.on("live-class:microphone", (payload: { allowed: boolean; message: string }) => {
          setMicAllowed(payload.allowed);
          setNotice(payload.message);
          if (!payload.allowed) {
            microphoneWantedRef.current = false;
            microphoneStreamRef.current?.getAudioTracks().forEach((track) => track.enabled = false);
            setMicOn(false);
          }
        });
        socket.on("live-class:chat", (payload: ChatMessage) => {
          setChatMessages((previous) => mergeChatMessages(previous, [payload]));
        });
        socket.on("live-class:new-producer", (producer: MediaProducer) => {
          void consumeProducer(producer).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Remote media could not be received.");
          });
        });

        const ack = await new Promise<any>((resolve) => {
          const timeout = window.setTimeout(() => resolve({
            ok: false,
            error: "The network is slow. The join request timed out; keep this page open and retry.",
          }), 45000);
          socket.emit("live-class:join", { sessionId: result.sessionId }, (response: any) => {
            window.clearTimeout(timeout);
            resolve(response);
          });
        });
        if (!ack.ok) throw new Error(ack.error);

        const device = new Device();
        await device.load({ routerRtpCapabilities: ack.rtcCapabilities });
        deviceRef.current = device;
        consumePendingProducers();
        setParticipants(ack.participants);
        setAttendees(ack.attendees || []);
        setChatMessages((previous) =>
          mergeChatMessages(previous, ack.chatMessages || []));
        for (const producer of ack.producers || []) {
          void consumeProducer(producer).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Remote media could not be received.");
          });
        }
        const ownParticipant = ack.participants.find((participant: ParticipantState) =>
          participant.id === ack.participantId);
        setSelfProfile({
          id: ownParticipant?.id || ack.participantId,
          name: ownParticipant?.name || (ack.role === "teacher" ? result.teacherName : "You"),
          role: ack.role,
          profilePhotoUrl: ownParticipant?.profilePhotoUrl || "",
        });
        setMicAllowed(ack.role !== "student" || Boolean(ownParticipant?.micAllowed));
        setStarted((previous) => previous || Boolean(ack.started));
        setConnecting(false);
        if (audioOnlyRef.current) emitVideoMode(false);
        try {
          if (cameraWantedRef.current) await openCamera();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Camera could not be opened.");
        }
        if (ack.role === "teacher" && ack.started && !mediaRecorderRef.current) {
          try {
            await openMicrophone();
            await startAutomaticRecording(result.sessionId);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The recording could not resume.");
          }
        }
        if (isNetworkSlow()) {
          setConnectionQuality("slow");
          void setAudioOnlyMode(true, "slow").catch((reason) => {
            setError(reason instanceof Error ? reason.message : "The connection is unstable.");
          });
        } else {
          setNotice(ack.started ? "" : "Waiting for your teacher to start");
          scheduleVideoRecovery();
        }
      } catch (reason) {
        if (active) {
          setConnecting(false);
          setError(reason instanceof Error ? reason.message : "The live class could not be connected.");
        }
      }
    }

    void join();
    return () => {
      active = false;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      socketRef.current?.disconnect();
    };
  }, [classDate, liveSessionId, retryKey, slotId]);

  return (
    <div className={isTeacher || isStudent ? "livekit-dashboard-shell" : undefined}>
      {isTeacher && <aside className="student-sidebar livekit-dashboard-sidebar" aria-label="Teacher studio navigation">
        <p className="micro-label">Teacher studio</p>
        <nav>
          <a href="/teacher#teacher-overview" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H5V9.5M9 20v-6h6v6" /></svg>
            <span>Overview</span>
          </a>
          <a className="is-active" href="/teacher#teacher-classes" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>
            <span>Live classes</span>
          </a>
          <a href="/teacher#teacher-weekly-timetable" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4m8-4v4M3 9h18m-13 4h3m-3 4h6" /></svg>
            <span>Timetable</span>
          </a>
          <a href="/teacher#teacher-recordings" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>
            <span>My Live Classes</span>
          </a>
          <a href="/teacher#teacher-modules" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 4v16m3-11h4m-4 4h4" /></svg>
            <span>Teaching materials</span>
          </a>
          <a href="/teacher#teacher-course-content" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>
            <span>Course content</span>
          </a>
          <a href="/teacher#teacher-capstones" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6" /></svg>
            <span>Capstone reviews</span>
          </a>
          <a href="/teacher#teacher-daily-answers" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>
            <span>Daily answer reviews</span>
          </a>
          <a href="/teacher#teacher-profile" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
            <span>Tutor profile</span>
          </a>
          <a href="/teacher#teacher-peer-messages" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.5-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8m-8 3h5" /></svg>
            <span>Messages</span>
          </a>
        </nav>
      </aside>}
      {isStudent && <aside className="student-sidebar livekit-dashboard-sidebar" aria-label="Student learning space navigation">
        <p className="micro-label">Learning space</p>
        <nav>
          <a href="/student#student-overview" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H5V9.5M9 20v-6h6v6" /></svg>
            <span>Overview</span>
          </a>
          <a href="/student#student-pathways" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 4v16m3-11h4m-4 4h4" /></svg>
            <span>My pathways</span>
          </a>
          <a href="/student#student-my-course" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v16.5m5-15h7m-7 4h7m-7 4h5" /></svg>
            <span>My course</span>
          </a>
          <a href="/student#student-fees" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-13 5h4" /></svg>
            <span>Fees</span>
          </a>
          <a className="is-active" href="/student#student-upcoming-classes" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>
            <span>Live classes</span>
          </a>
          <a href="/student#student-timetable" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4m8-4v4M3 9h18m-13 4h3m-3 4h6" /></svg>
            <span>My Timetable</span>
          </a>
          <a href="/student#student-attendance" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6" /><path d="M21 12a9 9 0 1 1-5.3-8.2" /></svg>
            <span>Attendance</span>
          </a>
          <a href="/student#student-recordings" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>
            <span>Recorded classes</span>
          </a>
          <a href="/student#student-messages" target="_blank" rel="noopener noreferrer">
            <svg className="student-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.5-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8m-8 3h5" /></svg>
            <span>Messages</span>
          </a>
        </nav>
      </aside>}
    <section className="livekit-room" aria-label="Live class">
      <header className="livekit-header">
        <div>
          <p className="eyebrow"><span /> TGFVP live classroom</p>
          <h1>{info?.programmeTitle || "Live class"}</h1>
          <p className="admin-intro">{joinDisplay}{info ? ` · Tutor: ${info.teacherName}` : ""}</p>
        </div>
        <div className="livekit-header-actions">
          {info && <button
            className="livekit-theme-toggle"
            type="button"
            onClick={() => void toggleLiveTheme()}
            disabled={themeSaving}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark"
              ? <span aria-hidden="true">☀</span>
              : <span aria-hidden="true">◐</span>}
          </button>}
          {connected && <span className="livekit-recording-badge"><span /> Connected</span>}
          {connectionQuality !== "good" && <span className="livekit-recording-badge is-starting">
            {connectionQuality === "slow" ? "Slow network · audio only" : "Reconnecting · audio only"}
          </span>}
          {recordingStatus && <span className={`livekit-recording-badge${recordingUploadStatus === "waiting" ? " is-starting" : ""}`}>
            <span /> {recordingStatus}
            {recordingStatus === "Recording automatically" && ` · ${formatRecordingDuration(recordingElapsedSeconds)}`}
            {recordingQueueCount > 0 && ` · ${recordingQueueCount} chunk${recordingQueueCount === 1 ? "" : "s"} queued`}
            {recordingStatus === "Recording automatically" && recordingUploadStatus !== "waiting" && " · uploading live"}
          </span>}
          {isTeacher && !ended && <>
            {!started && <button
              className="button button-dark"
              type="button"
              onClick={() => void startClass()}
              disabled={busy}
            >Start class</button>}
            <button
              className="button button-danger"
              type="button"
              onClick={() => void endClass()}
              disabled={busy}
            >End class</button>
          </>}
          <button className="button button-quiet" type="button" onClick={() => {
            if (started && isTeacher) sessionStorage.setItem("tgf-live-rejoin-session", info?.sessionId || "");
            socketRef.current?.disconnect();
            window.location.href = isTeacher ? "/teacher" : "/student";
          }}>Leave class</button>
        </div>
      </header>

      {connecting && <p className="admin-intro" role="status">Connecting to class…</p>}
      {error && (
        <div>
          <p className="admin-message is-error" role="alert">{error}</p>
          <button className="button button-dark" type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry connection</button>
        </div>
      )}
      {notice && <p className="livekit-recording-notice" role="status">{notice}</p>}
      {!started && !isTeacher && !ended && <p className="livekit-waiting-room"><strong>Class has not started</strong></p>}
      {ended && <p className="livekit-waiting-room" role="status"><strong>Class has ended.</strong> You can return to your dashboard.</p>}

      {!ended && <div className="livekit-controls">
        {isTeacher && started && <button className="button button-dark" type="button" onClick={() => void shareScreen()} disabled={busy || screenOn || audioOnly}>
          {screenOn ? "Sharing screen" : "Share screen"}
        </button>}
        {screenOn && <button className="button button-quiet" type="button" onClick={() => void stopScreenShare()}>Stop sharing</button>}
        <button className="button button-dark" type="button" onClick={() => void toggleCamera()} disabled={busy || audioOnly}>
          {audioOnly ? "Video paused · audio only" : cameraOn ? "Turn camera off" : "Turn camera on"}
        </button>
        <button className="button button-dark" type="button" onClick={() => void toggleMicrophone()} disabled={busy || (!isTeacher && !micAllowed)}>
          {isTeacher || micAllowed ? (micOn ? "Turn microphone off" : "Turn microphone on") : "Microphone muted"}
        </button>
        {!isTeacher && <button className="button button-dark" type="button" onClick={() => void toggleRaisedHand()} disabled={!connected}>
          {raisedHand ? "Lower hand" : "Raise hand"}
        </button>}
        {isTeacher && <>
          <button className="button button-quiet" type="button" onClick={() => void setMicrophone("all", false)}>Mute all</button>
          <button className="button button-quiet" type="button" onClick={() => void setMicrophone("all", true)}>Unmute all</button>
        </>}
      </div>}

      {!ended && <div className="livekit-layout">
        <section className="livekit-main-view" aria-label="Teacher main view">
          <video ref={mediaVideoRef} className="livekit-main-video" autoPlay playsInline muted />
          <audio ref={remoteAudioRef} autoPlay aria-hidden="true" />
          {audioOnly && <div className="livekit-main-placeholder">
            <span>Audio-only mode while the connection recovers</span>
          </div>}
          {!audioOnly && !hasVideo && <div className="livekit-main-placeholder">
            <span>{isTeacher ? "Your camera is off" : "Waiting for the teacher"}</span>
          </div>}
        </section>
        <aside className="livekit-sidebar">
          <section className="livekit-roster" aria-label="Class participants">
            <h2>Students in class <span>{participants.filter((participant) => participant.role === "student").length}</span></h2>
            <div className="livekit-student-row">
              {participants.filter((participant) => participant.role === "student").map((participant) => {
                const isSelf = participant.id === selfProfile.id;
                const videoStream = isSelf
                  ? localVideoStream
                  : participantVideoStreams.get(participant.id);
                const videoOn = isSelf ? cameraOn : participant.cameraOn;
                return (
                  <button
                    type="button"
                    className="livekit-student-tile"
                    key={participant.id}
                    onClick={() => isTeacher && void setMicrophone(participant.id, !participant.micAllowed)}
                    title={isTeacher ? (participant.micAllowed ? "Mute student" : "Unmute student") : participant.name}
                  >
                    <div className="livekit-student-video-frame">
                      {!audioOnly && videoOn && videoStream
                        ? <StreamVideo stream={videoStream} className="livekit-student-video" />
                        : <ProfileAvatar
                          className="livekit-student-avatar"
                          name={participant.name}
                          photoUrl={participant.profilePhotoUrl}
                          seed={participant.id}
                        />}
                    </div>
                    <strong>{participant.name}</strong>
                    <small>{audioOnly ? "Video paused" : videoOn ? "Camera on" : "Camera off"}</small>
                    <small>{participant.micAllowed ? "Speaking allowed" : "Muted"}</small>
                    {participant.raisedHand && <small className="livekit-hand">Hand raised</small>}
                  </button>
                );
              })}
            </div>
            <h3 className="livekit-attendance-heading">
              Attended this session <span>{attendees.length}</span>
            </h3>
            {attendees.length === 0
              ? <p className="livekit-attendance-empty">No students have joined this class yet.</p>
              : <ul className="livekit-attendance-list">
                {attendees.map((attendee) => {
                  const isConnected = participants.some((participant) =>
                    participant.id === attendee.id && participant.role === "student");
                  const joinedAt = new Date(attendee.firstJoinedAt);
                  return (
                    <li key={attendee.id}>
                      <strong>{attendee.name}</strong>
                      <small>{isConnected ? "In class" : `Attended ${formatRecordingDuration(attendee.attendanceSeconds)}`}</small>
                      <time dateTime={attendee.firstJoinedAt}>
                        Joined {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(joinedAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>}
          </section>
          <section className="livekit-chat" aria-label="Class chat">
            <header><h2>Class chat</h2></header>
            <div className="livekit-chat-messages" ref={chatMessagesRef} role="log" aria-live="polite">
              {chatMessages.length === 0 && <p className="livekit-chat-empty">No messages yet.</p>}
              {chatMessages.map((message) => (
                <article
                  className={`livekit-chat-message${message.senderId === selfProfile.id ? " is-mine" : ""}`}
                  key={message.id}
                >
                  <div className="livekit-chat-person">
                    <ProfileAvatar
                      className="livekit-chat-avatar"
                      name={message.name}
                      photoUrl={message.profilePhotoUrl}
                      seed={message.senderId}
                    />
                    <div>
                      <strong>{message.name}</strong>
                      {message.role === "teacher" && <small className="livekit-chat-tutor-badge">Tutor</small>}
                      {message.email && <small>{message.email}</small>}
                      <time dateTime={message.createdAt}>
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })
                          .format(new Date(message.createdAt))}
                      </time>
                    </div>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>
            <form className="livekit-chat-form" onSubmit={sendChat}>
              <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Write a message…" maxLength={2000} />
              <button className="button button-dark" type="submit" disabled={!chatDraft.trim() || chatSending}>
                {chatSending ? "Sending…" : "Send"}
              </button>
            </form>
            {chatError && <p className="livekit-chat-error" role="alert">
              {chatError}{" "}
              <button className="livekit-chat-retry" type="button" onClick={() => void submitChatMessage(chatDraft.trim())}>
                Retry
              </button>
            </p>}
          </section>
        </aside>
      </div>}
    </section>
    </div>
  );
}
