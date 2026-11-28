"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./room.module.css";

type ParticipantRole = "teacher" | "student";
type MediaKind = "audio" | "video";
type PeerSignalType = "offer" | "answer" | "candidate";
type ViewMode = "speaker" | "gallery";
type StripPosition = "right" | "left" | "top" | "bottom";

const VIEW_PREFERENCES_KEY = "tgf-live-class-view-preferences";

interface Participant {
  id: string;
  userId: string;
  name: string;
  role: ParticipantRole;
  micAllowed: boolean;
  microphoneOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  profilePhotoUrl: string;
  gender: string;
}

interface MediaStreamEntry {
  participantId: string;
  kind: MediaKind;
  name: string;
  source: "camera" | "screen" | "microphone";
  active: boolean;
  stream: MediaStream;
}

interface PeerSignal {
  id: number;
  fromParticipantId: string;
  type: PeerSignalType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface PeerMediaResponse {
  participants: Participant[];
  signals: PeerSignal[];
  cursor: number;
  iceServers: RTCIceServer[];
}

interface PeerConnectionState {
  connection: RTCPeerConnection;
  videoSender: RTCRtpSender;
  screenSender: RTCRtpSender;
  audioSender: RTCRtpSender;
}

interface LiveMediaRoomProps {
  sessionId: string;
  role: "teacher" | "learner";
  classStatus: "scheduled" | "live";
  teacherName: string;
  onRecordingStream: (stream: MediaStream | null) => void;
  onRecordingAudioResume: (resume: (() => Promise<void>) | null) => void;
}

async function requestMediaJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  let result: (T & { error?: string }) | null = null;
  try {
    result = await response.json() as T & { error?: string };
  } catch {
    if (response.ok) throw new Error("The media service returned an invalid response.");
  }
  if (!response.ok) throw new Error(result?.error || `The media request failed (${response.status}).`);
  if (!result) throw new Error("The media service returned an empty response.");
  return result;
}

function mediaError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function logMedia(event: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("debug") !== "1") return;
  console.info("[live-class-media]", event, details);
}

function describeTracks(stream: MediaStream | null) {
  return stream?.getTracks().map((track) => ({
    kind: track.kind,
    id: track.id,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
  })) || [];
}

interface CandidatePairSummary {
  localType: string;
  remoteType: string;
  protocol: string;
}

function trackStatus(streams: Array<MediaStream | null>, kind: MediaKind): string {
  const tracks = streams.flatMap((stream) =>
    stream?.getTracks().filter((track) => track.kind === kind) || []);
  if (tracks.length === 0) return "none";
  return tracks.map((track) =>
    `${track.readyState}${track.muted ? " muted" : ""}${track.enabled ? "" : " disabled"}`).join(", ");
}

async function logSelectedCandidatePair(
  connection: RTCPeerConnection,
  participantId: string,
): Promise<CandidatePairSummary | null> {
  try {
    const stats = await connection.getStats();
    const transport = [...stats.values()].find((report) => report.type === "transport") as RTCTransportStats | undefined;
    const selectedPairId = transport?.selectedCandidatePairId;
    const pair = (selectedPairId ? stats.get(selectedPairId) : undefined) ||
      [...stats.values()].find((report) =>
        report.type === "candidate-pair" &&
        (report as RTCIceCandidatePairStats).state === "succeeded" &&
        (report as RTCIceCandidatePairStats).nominated);
    if (!pair) {
      logMedia("ICE selected candidate pair unavailable", {
        participantId,
        iceConnectionState: connection.iceConnectionState,
      });
      return null;
    }

    const candidatePair = pair as RTCIceCandidatePairStats;
    const local = stats.get(candidatePair.localCandidateId) as (RTCStats & {
      candidateType?: string;
      protocol?: string;
    }) | undefined;
    const remote = stats.get(candidatePair.remoteCandidateId) as (RTCStats & {
      candidateType?: string;
      protocol?: string;
    }) | undefined;
    const summary = {
      localType: local?.candidateType || "unknown",
      remoteType: remote?.candidateType || "unknown",
      protocol: local?.protocol || remote?.protocol || "unknown",
    };
    logMedia("ICE selected candidate pair", {
      participantId,
      ...summary,
      state: candidatePair.state,
      nominated: candidatePair.nominated,
      bytesSent: candidatePair.bytesSent,
      bytesReceived: candidatePair.bytesReceived,
    });
    return summary;
  } catch (reason) {
    logMedia("ICE candidate pair stats failed", { participantId, error: String(reason) });
    return null;
  }
}

function ControlIcon({ name }: { name: "microphone" | "microphone-off" | "camera" | "camera-off" | "screen" | "microphone-all" }) {
  const paths = {
    microphone: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
    "microphone-off": <><path d="M5 10v2a7 7 0 0 0 12 4.9M19 10v2a7 7 0 0 1-.2 1.7M12 19v3m-4 0h8" /><path d="M9 6V5a3 3 0 0 1 5.8-1M15 10v2a3 3 0 0 1-5.8 1M3 3l18 18" /></>,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    "camera-off": <><path d="M16 10l5-3v10l-5-3M9 6h5a2 2 0 0 1 2 2v1M16 15v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M3 3l18 18" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    "microphone-all": <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8M19 4v4m-2-2h4" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function ParticipantAvatar({
  name,
  photoUrl,
  gender,
}: {
  name: string;
  photoUrl: string;
  gender: string;
}) {
  if (photoUrl) return <img className={styles.participantAvatar} src={photoUrl} alt="" />;
  if (gender === "male" || gender === "female") {
    return (
      <svg className={styles.participantAvatar} viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="24" fill={gender === "male" ? "#d9e8f4" : "#f3dbe5"} />
        <path d="M9 44c1.7-8.3 7-12.5 15-12.5S37.3 35.7 39 44" fill={gender === "male" ? "#46729a" : "#9c5472"} />
        <circle cx="24" cy="20" r="9" fill="#efc7a9" />
        {gender === "male"
          ? <path d="M15 19c0-7 3.2-10.5 9-10.5S33 12 33 19l-3.5-3-3.2 1-3.2-1-3.8 3z" fill="#394a59" />
          : <path d="M13.5 21c-1-10 3.1-14 10.5-14s11.5 4 10.5 14l-2.5 2v-8c-5.8 2-10.2 2-16 0v8z" fill="#513746" />}
      </svg>
    );
  }
  return <span className={styles.participantInitial} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

function VideoView({ stream, label, className, muted = true }: { stream: MediaStream; label: string; className: string; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    logMedia("video track attached", { label, streamId: stream.id, tracks: describeTracks(stream) });
    const playVideo = () => {
      void video.play().then(() => setNeedsGesture(false)).catch((error: unknown) => {
        setNeedsGesture(true);
        logMedia("video playback blocked", { label, error: mediaError(error, "Playback was blocked.") });
      });
    };
    const onPlaying = () => {
      setNeedsGesture(false);
      logMedia("video playback started", {
        label,
        width: video.videoWidth,
        height: video.videoHeight,
        tracks: describeTracks(stream),
      });
    };
    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => track.addEventListener("unmute", playVideo));
    video.addEventListener("loadedmetadata", playVideo);
    video.addEventListener("loadeddata", playVideo);
    video.addEventListener("playing", onPlaying);
    playVideo();
    return () => {
      tracks.forEach((track) => track.removeEventListener("unmute", playVideo));
      video.removeEventListener("loadedmetadata", playVideo);
      video.removeEventListener("loadeddata", playVideo);
      video.removeEventListener("playing", onPlaying);
      video.srcObject = null;
    };
  }, [label, stream]);
  return (
    <>
      <video ref={videoRef} className={className} autoPlay muted={muted} playsInline aria-label={label} />
      {needsGesture && (
        <button
          className={styles.videoEnableButton}
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            void video.play().then(() => setNeedsGesture(false)).catch((error: unknown) =>
              logMedia("video playback still blocked", { label, error: mediaError(error, "Playback remains blocked.") }));
          }}
        >
          Tap to join audio/video
        </button>
      )}
    </>
  );
}

function AudioView({ stream, participantName }: { stream: MediaStream; participantName: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    audio.muted = false;
    audio.volume = 1;
    logMedia("audio track attached", { participantName, streamId: stream.id, tracks: describeTracks(stream) });
    const playAudio = () => {
      void audio.play().then(() => setNeedsGesture(false)).catch((error: unknown) => {
        setNeedsGesture(true);
        logMedia("audio playback blocked", { participantName, error: mediaError(error, "Playback requires a user gesture.") });
      });
    };
    const tracks = stream.getAudioTracks();
    tracks.forEach((track) => track.addEventListener("unmute", playAudio));
    audio.addEventListener("loadedmetadata", playAudio);
    playAudio();
    return () => {
      tracks.forEach((track) => track.removeEventListener("unmute", playAudio));
      audio.removeEventListener("loadedmetadata", playAudio);
      audio.srcObject = null;
    };
  }, [participantName, stream]);

  const enableSound = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
    try {
      await audio.play();
      setNeedsGesture(false);
      logMedia("audio playback enabled", { participantName });
    } catch (error) {
      logMedia("audio playback still blocked", { participantName, error: mediaError(error, "Playback remains blocked.") });
    }
  };

  return (
    <>
      <audio ref={audioRef} autoPlay />
      {needsGesture && (
        <button className={styles.audioEnableButton} type="button" onClick={() => void enableSound()}>
          Tap to join audio/video
        </button>
      )}
    </>
  );
}

function ParticipantTile({
  participant,
  stream,
  isSelf,
  isSpeaker,
  canManageMicrophone,
  onToggleMicrophone,
}: {
  participant: Participant;
  stream: MediaStream | null;
  isSelf: boolean;
  isSpeaker: boolean;
  canManageMicrophone: boolean;
  onToggleMicrophone: () => void;
}) {
  const classes = [styles.participantCard, isSpeaker ? styles.activeSpeaker : ""].filter(Boolean).join(" ");
  return (
    <article className={classes} key={participant.id}>
      <div className={styles.participantVideo}>
        {stream
          ? <VideoView stream={stream} label={`${participant.name}'s camera`} className={styles.participantVideoElement} muted />
          : <ParticipantAvatar name={participant.name} photoUrl={participant.profilePhotoUrl} gender={participant.gender} />}
        {participant.cameraOn && !stream && (
          <span className={styles.cameraOffIndicator}>Connecting video</span>
        )}
        {!participant.cameraOn && (
          <span className={styles.cameraOffIndicator} aria-label="Camera off">
            <ControlIcon name="camera-off" /> Camera off
          </span>
        )}
        <span className={styles.participantMic} aria-label={participant.microphoneOn ? "Microphone enabled" : "Microphone muted"}>
          <ControlIcon name={participant.microphoneOn ? "microphone" : "microphone-off"} />
          {participant.microphoneOn ? "Mic on" : "Muted"}
        </span>
      </div>
      <div className={styles.participantMeta}>
        <strong>{participant.name}{isSelf ? " (you)" : ""}</strong>
        {canManageMicrophone && participant.role === "student" && (
          <button type="button" onClick={onToggleMicrophone}>
            {participant.micAllowed ? "Mute" : "Unmute"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function LiveMediaRoom({
  sessionId,
  role,
  classStatus,
  teacherName,
  onRecordingStream,
  onRecordingAudioResume,
}: LiveMediaRoomProps) {
  const isTeacher = role === "teacher";
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteMedia, setRemoteMedia] = useState<MediaStreamEntry[]>([]);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [microphoneAllowed, setMicrophoneAllowed] = useState(isTeacher);
  const [screenOn, setScreenOn] = useState(false);
  const [mediaState, setMediaState] = useState<"connecting" | "connected" | "waiting" | "failed">(
    classStatus === "live" ? "connecting" : "waiting",
  );
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("speaker");
  const [stripPosition, setStripPosition] = useState<StripPosition>("bottom");
  const [viewPreferencesLoaded, setViewPreferencesLoaded] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugIceConfig, setDebugIceConfig] = useState<{ secureContext: boolean; hasTurnRelay: boolean } | null>(null);
  const [debugCandidatePairs, setDebugCandidatePairs] = useState<Record<string, CandidatePairSummary>>({});
  const [debugPeerStates, setDebugPeerStates] = useState<Record<string, { connection: string; ice: string }>>({});
  const [screenSharingSupported, setScreenSharingSupported] = useState(false);
  const mediaUrl = `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/media`;
  const participantIdRef = useRef("");
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const cameraCapturePromiseRef = useRef<Promise<MediaStream> | null>(null);
  const microphoneCapturePromiseRef = useRef<Promise<MediaStream> | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraOnRef = useRef(false);
  const microphoneOnRef = useRef(false);
  const screenOnRef = useRef(false);
  const microphoneAllowedRef = useRef(isTeacher);
  const heartbeatRef = useRef<(() => Promise<void>) | null>(null);
  const peerConnectionsRef = useRef(new Map<string, PeerConnectionState>());
  const peerProfilesRef = useRef(new Map<string, Participant>());
  const participantsRef = useRef<Participant[]>(participants);
  const permissionSnapshotRef = useRef("");
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const initiatedOffersRef = useRef(new Set<string>());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const remoteMediaRef = useRef<MediaStreamEntry[]>(remoteMedia);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingAudioSourcesRef = useRef(new Map<string, MediaStreamAudioSourceNode>());

  remoteMediaRef.current = remoteMedia;
  participantsRef.current = participants;

  useEffect(() => {
    setDebugEnabled(new URLSearchParams(window.location.search).get("debug") === "1");
    setScreenSharingSupported(typeof navigator.mediaDevices?.getDisplayMedia === "function");
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREFERENCES_KEY);
      if (saved) {
        const preferences = JSON.parse(saved) as { viewMode?: ViewMode; stripPosition?: StripPosition };
        if (preferences.viewMode === "speaker" || preferences.viewMode === "gallery") {
          setViewMode(preferences.viewMode);
        }
        if (["right", "left", "top", "bottom"].includes(preferences.stripPosition || "")) {
          setStripPosition(preferences.stripPosition as StripPosition);
        }
      }
    } catch (reason) {
      logMedia("view preferences could not be loaded", { error: String(reason) });
    } finally {
      setViewPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!viewPreferencesLoaded) return;
    try {
      localStorage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify({ viewMode, stripPosition }));
    } catch (reason) {
      logMedia("view preferences could not be saved", { error: String(reason) });
    }
  }, [stripPosition, viewMode, viewPreferencesLoaded]);

  const ensureCamera = useCallback(async () => {
    const currentTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (cameraStreamRef.current && currentTrack?.readyState === "live") return cameraStreamRef.current;
    if (cameraCapturePromiseRef.current) return cameraCapturePromiseRef.current;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error("Camera access is not available in this browser.");
      logMedia("getUserMedia video failure", { error: error.message });
      throw error;
    }
    const capture = navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 360, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    cameraCapturePromiseRef.current = capture;
    try {
      const stream = await capture;
      if (!stream.getVideoTracks().length) throw new Error("The browser returned no camera track.");
      cameraStreamRef.current = stream;
      cameraOnRef.current = true;
      setCameraOn(true);
      setLocalVideo(stream);
      setCameraError("");
      logMedia("getUserMedia video success", { tracks: describeTracks(stream) });
      return stream;
    } catch (reason) {
      logMedia("getUserMedia video failure", { error: mediaError(reason, "Camera access failed.") });
      throw reason;
    } finally {
      if (cameraCapturePromiseRef.current === capture) cameraCapturePromiseRef.current = null;
    }
  }, []);

  const ensureMicrophone = useCallback(async () => {
    if (microphoneStreamRef.current) return microphoneStreamRef.current;
    if (microphoneCapturePromiseRef.current) return microphoneCapturePromiseRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error("Microphone access is not available in this browser.");
      logMedia("getUserMedia audio failure", { error: error.message });
      throw error;
    }
    const capture = navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    microphoneCapturePromiseRef.current = capture;
    try {
      const stream = await capture;
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error("The browser returned no microphone track.");
      if (track) track.enabled = false;
      microphoneStreamRef.current = stream;
      logMedia("getUserMedia audio success", { tracks: describeTracks(stream) });
      return stream;
    } catch (reason) {
      logMedia("getUserMedia audio failure", { error: mediaError(reason, "Microphone access failed.") });
      throw reason;
    } finally {
      if (microphoneCapturePromiseRef.current === capture) microphoneCapturePromiseRef.current = null;
    }
  }, []);

  const setMicrophone = useCallback(async (enabled: boolean) => {
    const permitted = isTeacher || microphoneAllowedRef.current;
    if (enabled && !permitted) {
      microphoneOnRef.current = false;
      setMicrophoneOn(false);
      return;
    }
    const stream = await ensureMicrophone();
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("No microphone was found.");
    const shouldPublish = enabled && permitted;
    track.enabled = shouldPublish;
    try {
      await Promise.all([...peerConnectionsRef.current.values()].map(({ audioSender }) =>
        audioSender.replaceTrack(shouldPublish ? track : null)));
    } catch (reason) {
      logMedia("local audio track publication failed", {
        tracks: describeTracks(new MediaStream([track])),
        permitted,
        error: mediaError(reason, "The microphone track could not be updated."),
      });
      throw reason;
    }
    logMedia(shouldPublish ? "microphone published" : "microphone unpublished", {
      tracks: describeTracks(shouldPublish ? new MediaStream([track]) : null),
      permitted,
      peers: peerConnectionsRef.current.size,
    });
    microphoneOnRef.current = shouldPublish;
    setMicrophoneOn(shouldPublish);
    await heartbeatRef.current?.();
  }, [ensureMicrophone, isTeacher]);

  const upsertRemoteMedia = useCallback((
    participant: Participant,
    kind: MediaKind,
    source: MediaStreamEntry["source"],
    track: MediaStreamTrack,
  ) => {
    const stream = new MediaStream([track]);
    const matchesSource = (entry: MediaStreamEntry) =>
      entry.kind !== "video" || entry.source === source;
    const updateTrackState = (active: boolean) => {
      setRemoteMedia((current) => current.map((entry) =>
        entry.participantId === participant.id && entry.kind === kind && matchesSource(entry)
          ? { ...entry, active }
          : entry));
    };
    track.addEventListener("mute", () => updateTrackState(false));
    track.addEventListener("unmute", () => updateTrackState(true));
    track.addEventListener("ended", () => {
      setRemoteMedia((current) => current.filter((entry) =>
        entry.participantId !== participant.id || entry.kind !== kind || !matchesSource(entry)));
    }, { once: true });
    setRemoteMedia((current) => [
      ...current.filter((entry) => entry.participantId !== participant.id ||
        entry.kind !== kind || !matchesSource(entry)),
      {
        participantId: participant.id,
        kind,
        name: participant.name,
        source,
        active: !track.muted && track.readyState === "live",
        stream,
      },
    ]);
  }, []);

  useEffect(() => {
    let active = true;
    void ensureCamera().catch((reason: unknown) => {
      if (active) setCameraError(mediaError(reason, "The camera could not be opened."));
    });
    return () => {
      active = false;
      void cameraCapturePromiseRef.current?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => undefined);
      void microphoneCapturePromiseRef.current?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => undefined);
      for (const stream of [cameraStreamRef.current, microphoneStreamRef.current, screenStreamRef.current]) {
        stream?.getTracks().forEach((track) => track.stop());
      }
      cameraStreamRef.current = null;
      microphoneStreamRef.current = null;
      screenStreamRef.current = null;
      setLocalVideo(null);
    };
  }, [ensureCamera]);

  useEffect(() => {
    cameraOnRef.current = cameraOn;
    microphoneOnRef.current = microphoneOn;
    screenOnRef.current = screenOn;
  }, [cameraOn, microphoneOn, screenOn]);

  useEffect(() => {
    if (!isTeacher) {
      onRecordingStream(null);
      onRecordingAudioResume(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    const AudioContextConstructor = window.AudioContext;
    if (!context || !AudioContextConstructor || typeof canvas.captureStream !== "function") {
      logMedia("recording stream unavailable", { hasCanvasContext: Boolean(context), hasAudioContext: Boolean(AudioContextConstructor) });
      onRecordingStream(null);
      return;
    }

    const audioContext = new AudioContextConstructor();
    const audioDestination = audioContext.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(15);
    const recordingStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    const videoElements = new Map<string, HTMLVideoElement>();
    let active = true;
    let frame = 0;

    recordingAudioContextRef.current = audioContext;
    recordingAudioDestinationRef.current = audioDestination;
    onRecordingStream(recordingStream);
    onRecordingAudioResume(async () => {
      if (audioContext.state !== "closed") await audioContext.resume();
    });
    void audioContext.resume().then(() => {
      logMedia("recording audio mixer ready", { state: audioContext.state });
    }).catch((error: unknown) => {
      logMedia("recording audio mixer resume failed", { error: mediaError(error, "Audio context could not resume.") });
    });

    const drawFrame = () => {
      if (!active) return;
      const localScreen = screenStreamRef.current;
      const entries = [
        ...(localScreen ? [{ key: "local-screen", name: "Tutor screen", stream: localScreen }] : []),
        ...(cameraStreamRef.current && cameraOnRef.current
          ? [{ key: "local-camera", name: isTeacher ? "Tutor" : "You", stream: cameraStreamRef.current }]
          : []),
        ...remoteMediaRef.current
          .filter((entry) => entry.kind === "video" && entry.active)
          .map((entry) => ({ key: `${entry.participantId}:${entry.source}`, name: entry.name, stream: entry.stream })),
      ];
      context.fillStyle = "#101719";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
      const rows = Math.max(1, Math.ceil(entries.length / columns));
      const tileWidth = canvas.width / columns;
      const tileHeight = canvas.height / rows;

      entries.forEach((entry, index) => {
        let video = videoElements.get(entry.key);
        if (!video) {
          video = document.createElement("video");
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.srcObject = entry.stream;
          videoElements.set(entry.key, video);
          void video.play().catch((error: unknown) => {
            logMedia("recording video playback failed", { participant: entry.name, error: mediaError(error, "Video could not play." ) });
          });
        } else if (video.srcObject !== entry.stream) {
          video.srcObject = entry.stream;
          void video.play().catch(() => undefined);
        }
        const x = (index % columns) * tileWidth;
        const y = Math.floor(index / columns) * tileHeight;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(video, x, y, tileWidth, tileHeight);
        }
        context.fillStyle = "rgba(0, 0, 0, 0.62)";
        context.fillRect(x + 12, y + tileHeight - 42, Math.min(tileWidth - 24, 260), 30);
        context.fillStyle = "#fff";
        context.font = "20px sans-serif";
        context.fillText(entry.name, x + 22, y + tileHeight - 21, tileWidth - 44);
      });
      frame = window.requestAnimationFrame(drawFrame);
    };
    frame = window.requestAnimationFrame(drawFrame);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      for (const video of videoElements.values()) video.srcObject = null;
      for (const source of recordingAudioSourcesRef.current.values()) source.disconnect();
      recordingAudioSourcesRef.current.clear();
      canvasStream.getTracks().forEach((track) => track.stop());
      if (audioContext.state !== "closed") void audioContext.close();
      recordingAudioContextRef.current = null;
      recordingAudioDestinationRef.current = null;
      onRecordingStream(null);
      onRecordingAudioResume(null);
    };
  }, [isTeacher, onRecordingAudioResume, onRecordingStream]);

  useEffect(() => {
    const destination = recordingAudioDestinationRef.current;
    const audioContext = recordingAudioContextRef.current;
    if (classStatus !== "live" || !destination || !audioContext) return;
    const streams = [
      ...(microphoneStreamRef.current ? [microphoneStreamRef.current] : []),
      ...remoteMedia.filter((entry) => entry.kind === "audio").map((entry) => entry.stream),
    ];
    const desiredIds = new Set(streams.map((stream) => stream.id));
    for (const stream of streams) {
      if (recordingAudioSourcesRef.current.has(stream.id)) continue;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(destination);
      recordingAudioSourcesRef.current.set(stream.id, source);
    }
    for (const [streamId, source] of recordingAudioSourcesRef.current) {
      if (desiredIds.has(streamId)) continue;
      source.disconnect();
      recordingAudioSourcesRef.current.delete(streamId);
    }
  }, [classStatus, microphoneOn, remoteMedia]);

  useEffect(() => {
    if (classStatus !== "live" || typeof window.AudioContext === "undefined") {
      setActiveSpeakerId(null);
      return;
    }
    const audioContext = new window.AudioContext();
    const analyzers: Array<{
      participantId: string;
      analyzer: AnalyserNode;
      source: MediaStreamAudioSourceNode;
      silentSink: GainNode;
    }> = [];
    const localParticipantId = participantIdRef.current;
    if (microphoneOn && localParticipantId && microphoneStreamRef.current) {
      const source = audioContext.createMediaStreamSource(microphoneStreamRef.current);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 512;
      source.connect(analyzer);
      const silentSink = audioContext.createGain();
      silentSink.gain.value = 0;
      analyzer.connect(silentSink);
      silentSink.connect(audioContext.destination);
      analyzers.push({ participantId: localParticipantId, analyzer, source, silentSink });
    }
    for (const entry of remoteMedia.filter((media) => media.kind === "audio")) {
      const participant = participantsRef.current.find((profile) => profile.id === entry.participantId);
      if (!participant?.microphoneOn || (participant.role === "student" && !participant.micAllowed)) continue;
      const source = audioContext.createMediaStreamSource(entry.stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 512;
      source.connect(analyzer);
      const silentSink = audioContext.createGain();
      silentSink.gain.value = 0;
      analyzer.connect(silentSink);
      silentSink.connect(audioContext.destination);
      analyzers.push({ participantId: participant.id, analyzer, source, silentSink });
    }
    if (analyzers.length === 0) {
      setActiveSpeakerId(null);
      void audioContext.close();
      return;
    }

    void audioContext.resume().catch((reason: unknown) =>
      logMedia("speaker meter audio context could not resume", { error: String(reason) }));
    const sampleBuffers = analyzers.map(({ analyzer }) => new Uint8Array(analyzer.fftSize));
    let lastVoiceAt = 0;
    const timer = window.setInterval(() => {
      let loudestParticipant = "";
      let loudestLevel = 0;
      analyzers.forEach(({ participantId, analyzer }, index) => {
        const samples = sampleBuffers[index];
        analyzer.getByteTimeDomainData(samples);
        const sum = samples.reduce((total, value) => total + ((value - 128) / 128) ** 2, 0);
        const level = Math.sqrt(sum / samples.length);
        if (level > loudestLevel) {
          loudestLevel = level;
          loudestParticipant = participantId;
        }
      });
      if (loudestLevel > 0.045) {
        lastVoiceAt = Date.now();
        setActiveSpeakerId((current) => current === loudestParticipant ? current : loudestParticipant);
      } else if (Date.now() - lastVoiceAt > 900) {
        setActiveSpeakerId((current) => current === null ? current : null);
      }
    }, 120);

    return () => {
      window.clearInterval(timer);
      for (const { source, analyzer, silentSink } of analyzers) {
        source.disconnect();
        analyzer.disconnect();
        silentSink.disconnect();
      }
      if (audioContext.state !== "closed") void audioContext.close();
    };
  }, [classStatus, microphoneOn, remoteMedia]);

  useEffect(() => {
    for (const participant of participants) {
      peerProfilesRef.current.set(participant.id, participant);
    }
    setRemoteMedia((current) => current.map((entry) => {
      const participant = peerProfilesRef.current.get(entry.participantId);
      if (!participant) return entry;
      if (entry.kind === "audio") {
        const track = entry.stream.getAudioTracks()[0];
        const permitted = participant.role === "teacher" || participant.micAllowed;
        if (track) track.enabled = permitted && participant.microphoneOn;
      }
      return entry.name === participant.name ? entry : { ...entry, name: participant.name };
    }));
    if (classStatus !== "live") return;
    const self = participants.find((participant) => participant.id === participantIdRef.current);
    if (!self || isTeacher) return;
    const wasAllowed = microphoneAllowedRef.current;
    microphoneAllowedRef.current = self.micAllowed;
    setMicrophoneAllowed(self.micAllowed);
    if (wasAllowed !== self.micAllowed) {
      void setMicrophone(self.micAllowed).catch((reason: unknown) =>
        setError(mediaError(reason, "Your microphone could not be updated.")));
    }
  }, [classStatus, isTeacher, participants, setMicrophone]);

  useEffect(() => {
    if (classStatus !== "live") {
      setMediaState("waiting");
      return;
    }
    let active = true;
    let pollTimer: number | undefined;
    let polling = false;
    let iceConfigurationLogged = false;
    let cursor = 0;
    let lastHeartbeat = 0;
    const participantId = crypto.randomUUID();
    participantIdRef.current = participantId;
    peerProfilesRef.current.clear();
    pendingCandidatesRef.current.clear();
    initiatedOffersRef.current.clear();

    const post = (body: Record<string, unknown>, keepalive = false) =>
      requestMediaJson(mediaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });

    const heartbeat = async () => {
      if (!active) return;
      await post({
        action: "heartbeat",
        participantId,
        cameraOn: cameraOnRef.current,
        microphoneOn: microphoneOnRef.current,
        screenOn: screenOnRef.current,
      });
      lastHeartbeat = Date.now();
    };
    heartbeatRef.current = heartbeat;

    const sendSignal = async (
      recipientId: string,
      type: PeerSignalType,
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit,
    ) => {
      await post({ action: "signal", participantId, recipientId, type, payload });
    };

    const closePeer = (peerId: string) => {
      const peer = peerConnectionsRef.current.get(peerId);
      peer?.connection.close();
      peerConnectionsRef.current.delete(peerId);
      pendingCandidatesRef.current.delete(peerId);
      initiatedOffersRef.current.delete(peerId);
      setRemoteMedia((current) => current.filter((entry) => entry.participantId !== peerId));
    };

    const createPeer = async (participant: Participant): Promise<PeerConnectionState> => {
      const existing = peerConnectionsRef.current.get(participant.id);
      if (existing) return existing;
      let camera: MediaStream | null = null;
      try {
        camera = await ensureCamera();
      } catch (reason) {
        cameraOnRef.current = false;
        setCameraOn(false);
        setCameraError(mediaError(reason, "Camera access is unavailable. You can still listen to the class."));
        logMedia("camera unavailable while creating peer", { participantId: participant.id, error: String(reason) });
      }
      let microphone: MediaStream | null = null;
      try {
        microphone = await ensureMicrophone();
      } catch (reason) {
        logMedia("microphone unavailable while creating peer", { participantId: participant.id, error: String(reason) });
      }
      const connection = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const videoTransceiver = connection.addTransceiver("video", { direction: "sendrecv" });
      const screenTransceiver = connection.addTransceiver("video", { direction: "sendrecv" });
      const audioTransceiver = connection.addTransceiver("audio", { direction: "sendrecv" });
      const currentVideo = cameraOnRef.current ? camera?.getVideoTracks()[0] || null : null;
      const currentScreen = screenStreamRef.current?.getVideoTracks()[0] || null;
      const currentAudio = (isTeacher || microphoneAllowedRef.current) && microphoneOnRef.current
        ? microphone?.getAudioTracks()[0] || null
        : null;
      try {
        await videoTransceiver.sender.replaceTrack(currentVideo || null);
        logMedia("local video track published", { participantId: participant.id, tracks: describeTracks(camera) });
        await screenTransceiver.sender.replaceTrack(currentScreen);
        logMedia("local screen track published", { participantId: participant.id, tracks: describeTracks(screenStreamRef.current) });
        await audioTransceiver.sender.replaceTrack(currentAudio || null);
        logMedia("local audio track published", { participantId: participant.id, tracks: describeTracks(microphone) });
      } catch (reason) {
        logMedia("local track publication failed", {
          participantId: participant.id,
          videoTrackId: currentVideo?.id || null,
          screenTrackId: currentScreen?.id || null,
          audioTrackId: currentAudio?.id || null,
          error: mediaError(reason, "A local media track could not be published."),
        });
        throw reason;
      }
      logMedia("tracks published", {
        participantId: participant.id,
        video: describeTracks(currentVideo ? new MediaStream([currentVideo]) : null),
        screen: describeTracks(currentScreen ? new MediaStream([currentScreen]) : null),
        audio: describeTracks(currentAudio ? new MediaStream([currentAudio]) : null),
      });
      const peerState: PeerConnectionState = {
        connection,
        videoSender: videoTransceiver.sender,
        screenSender: screenTransceiver.sender,
        audioSender: audioTransceiver.sender,
      };
      peerConnectionsRef.current.set(participant.id, peerState);
      connection.onicecandidate = (event) => {
        if (event.candidate && active) {
          logMedia("local ICE candidate gathered", {
            participantId: participant.id,
            type: event.candidate.type,
            protocol: event.candidate.protocol,
          });
          void sendSignal(participant.id, "candidate", event.candidate.toJSON()).catch((reason: unknown) =>
            {
              logMedia("ICE candidate signaling failed", { participantId: participant.id, error: String(reason) });
              setError(mediaError(reason, "A live media connection could not be established."));
            });
        }
      };
      connection.ontrack = (event) => {
        const profile = peerProfilesRef.current.get(participant.id) || participant;
        logMedia("track subscribed", {
          participantId: participant.id,
          participantName: profile.name,
          kind: event.track.kind,
          trackId: event.track.id,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState,
          streams: event.streams.length,
        });
        event.track.addEventListener("mute", () => logMedia("remote track muted", {
          participantId: participant.id,
          kind: event.track.kind,
          trackId: event.track.id,
        }));
        event.track.addEventListener("unmute", () => logMedia("remote track unmuted", {
          participantId: participant.id,
          kind: event.track.kind,
          trackId: event.track.id,
        }));
        event.track.addEventListener("ended", () => logMedia("remote track ended", {
          participantId: participant.id,
          kind: event.track.kind,
          trackId: event.track.id,
        }), { once: true });
        const kind = event.track.kind === "video" ? "video" : "audio";
        const source = kind === "audio"
          ? "microphone"
          : event.transceiver === screenTransceiver ? "screen" : "camera";
        upsertRemoteMedia(profile, kind, source, event.track);
      };
      connection.onconnectionstatechange = () => {
        if (!active) return;
        setDebugPeerStates((current) => ({
          ...current,
          [participant.id]: { connection: connection.connectionState, ice: connection.iceConnectionState },
        }));
        logMedia("peer connection state", {
          participantId: participant.id,
          connectionState: connection.connectionState,
          iceConnectionState: connection.iceConnectionState,
        });
        if (connection.connectionState === "connected") {
          void logSelectedCandidatePair(connection, participant.id).then((pair) => {
            if (pair) setDebugCandidatePairs((current) => ({ ...current, [participant.id]: pair }));
          });
        }
        if (connection.connectionState === "connected") {
          setMediaState("connected");
          setError("");
        } else if (connection.connectionState === "failed") {
          setMediaState("failed");
          setError("A participant connection failed. This network may require a TURN relay.");
        }
      };
      connection.oniceconnectionstatechange = () => {
        setDebugPeerStates((current) => ({
          ...current,
          [participant.id]: { connection: connection.connectionState, ice: connection.iceConnectionState },
        }));
        logMedia("ICE connection state", {
          participantId: participant.id,
          state: connection.iceConnectionState,
          gatheringState: connection.iceGatheringState,
        });
        if (connection.iceConnectionState === "connected" ||
            connection.iceConnectionState === "completed") {
          void logSelectedCandidatePair(connection, participant.id).then((pair) => {
            if (pair) setDebugCandidatePairs((current) => ({ ...current, [participant.id]: pair }));
          });
        }
        if (connection.iceConnectionState === "failed") {
          const hasTurnRelay = iceServersRef.current.some((server) =>
            (Array.isArray(server.urls) ? server.urls : [server.urls])
              .some((url) => /^turns?:/i.test(url)));
          setError(hasTurnRelay
            ? "The media connection failed. Check the relay service and network access."
            : "The media connection failed. A configured TURN relay is required on some mobile and restricted networks.");
        }
      };
      return peerState;
    };

    const startOffer = async (participant: Participant) => {
      if (participantId.localeCompare(participant.id) >= 0 ||
          initiatedOffersRef.current.has(participant.id)) return;
      initiatedOffersRef.current.add(participant.id);
      try {
        const { connection } = await createPeer(participant);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        if (!connection.localDescription) throw new Error("The browser could not create a media offer.");
        await sendSignal(participant.id, "offer", connection.localDescription.toJSON());
      } catch (reason) {
        initiatedOffersRef.current.delete(participant.id);
        throw reason;
      }
    };

    const flushCandidates = async (peerId: string, connection: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(peerId) || [];
      pendingCandidatesRef.current.delete(peerId);
      for (const candidate of pending) await connection.addIceCandidate(candidate);
    };

    const receiveSignal = async (signal: PeerSignal) => {
      const participant = peerProfilesRef.current.get(signal.fromParticipantId);
      if (!participant) return;
      const { connection } = await createPeer(participant);
      if (signal.type === "candidate") {
        const candidate = signal.payload as RTCIceCandidateInit;
        if (connection.remoteDescription) {
          await connection.addIceCandidate(candidate);
        } else {
          const pending = pendingCandidatesRef.current.get(participant.id) || [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(participant.id, pending);
        }
        return;
      }
      const description = signal.payload as RTCSessionDescriptionInit;
      if (signal.type === "offer") {
        const collision = connection.signalingState !== "stable";
        const polite = participantId.localeCompare(participant.id) > 0;
        if (collision && !polite) return;
        if (collision) await connection.setLocalDescription({ type: "rollback" });
        await connection.setRemoteDescription(description);
        await flushCandidates(participant.id, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        if (!connection.localDescription) throw new Error("The browser could not create a media answer.");
        await sendSignal(participant.id, "answer", connection.localDescription.toJSON());
      } else {
        await connection.setRemoteDescription(description);
        await flushCandidates(participant.id, connection);
      }
    };

    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        if (Date.now() - lastHeartbeat >= 5000) await heartbeat();
        const query = new URLSearchParams({ participantId, after: String(cursor) });
        const result = await requestMediaJson<PeerMediaResponse>(`${mediaUrl}?${query.toString()}`);
        if (!active) return;
        iceServersRef.current = result.iceServers;
        if (!iceConfigurationLogged) {
          const hasTurnRelay = result.iceServers.some((server) =>
            (Array.isArray(server.urls) ? server.urls : [server.urls])
              .some((url) => /^turns?:/i.test(url)));
          logMedia("ICE configuration received", {
            serverCount: result.iceServers.length,
            hasTurnRelay,
            secureContext: window.isSecureContext,
            pageProtocol: window.location.protocol,
          });
          setDebugIceConfig({ secureContext: window.isSecureContext, hasTurnRelay });
          iceConfigurationLogged = true;
        }
        const nextProfiles = new Map(result.participants.map((participant) => [participant.id, participant]));
        peerProfilesRef.current = nextProfiles;
        setParticipants(result.participants);
        const permissionSnapshot = JSON.stringify({
          localRole: role,
          participants: result.participants.map((participant) => ({
            id: participant.id,
            role: participant.role,
            canPublishVideo: true,
            canPublishAudio: participant.role === "teacher" || participant.micAllowed,
            canSubscribe: participant.id !== participantId,
            microphoneAllowed: participant.micAllowed,
          })),
          permissionSource: "session authorization and server-enforced microphone allowance; no media token is used",
        });
        if (permissionSnapshotRef.current !== permissionSnapshot) {
          permissionSnapshotRef.current = permissionSnapshot;
          logMedia("media permissions", JSON.parse(permissionSnapshot) as Record<string, unknown>);
        }
        const activePeerIds = new Set(
          result.participants.filter((participant) => participant.id !== participantId).map((participant) => participant.id),
        );
        for (const peerId of peerConnectionsRef.current.keys()) {
          if (!activePeerIds.has(peerId)) closePeer(peerId);
        }
        for (const participant of result.participants) {
          if (participant.id !== participantId) await startOffer(participant);
        }
        for (const signal of result.signals) await receiveSignal(signal);
        cursor = result.cursor;
        const hasConnectedPeer = [...peerConnectionsRef.current.values()]
          .some((peer) => peer.connection.connectionState === "connected");
        if (hasConnectedPeer) setMediaState("connected");
        else if (result.participants.length > 1) setMediaState("connecting");
        else setMediaState("waiting");
        setError("");
      } catch (reason) {
        if (active) {
          logMedia("peer media poll or signaling failed", { error: mediaError(reason, "Unknown media failure.") });
          setMediaState("failed");
          setError(mediaError(reason, "Live video could not connect. Retry by rejoining the class."));
        }
      } finally {
        polling = false;
        if (active) pollTimer = window.setTimeout(() => void poll(), 1200);
      }
    };

    setMediaState("connecting");
    setError("");
    void ensureCamera()
      .catch((reason: unknown) => {
        if (!active) return;
        cameraOnRef.current = false;
        setCameraOn(false);
        setCameraError(mediaError(reason, "Camera access is unavailable. You can still listen to the class."));
      })
      .then(async () => {
        try {
          const stream = await ensureMicrophone();
          if (isTeacher) {
            const track = stream.getAudioTracks()[0];
            if (track) track.enabled = true;
            microphoneOnRef.current = true;
            setMicrophoneOn(true);
          }
        } catch (reason) {
          if (active) setError(mediaError(reason, "Microphone access is unavailable. You can still watch the class."));
        }
        if (active) void poll();
      });

    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      heartbeatRef.current = null;
      for (const peerId of peerConnectionsRef.current.keys()) closePeer(peerId);
      peerConnectionsRef.current.clear();
      peerProfilesRef.current.clear();
      setParticipants([]);
      setRemoteMedia([]);
      const leaveBody = JSON.stringify({ action: "leave", participantId });
      void fetch(mediaUrl, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: leaveBody,
      }).catch(() => undefined);
      microphoneAllowedRef.current = isTeacher;
      microphoneOnRef.current = false;
      setMicrophoneOn(false);
      screenOnRef.current = false;
      setScreenOn(false);
    };
  }, [classStatus, ensureCamera, ensureMicrophone, isTeacher, mediaUrl, upsertRemoteMedia]);

  const updateCamera = async (enabled: boolean) => {
    try {
      const currentTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const stream = enabled ? await ensureCamera() : cameraStreamRef.current;
      const track = stream?.getVideoTracks()[0] || currentTrack;
      if (enabled && !track) throw new Error("No camera was found.");
      if (track) track.enabled = enabled;
      try {
        await Promise.all([...peerConnectionsRef.current.values()].map(({ videoSender }) =>
          videoSender.replaceTrack(enabled ? track || null : null)));
      } catch (reason) {
        logMedia("local video track publication failed", {
          action: enabled ? "enable" : "disable",
          tracks: describeTracks(track ? new MediaStream([track]) : null),
          error: mediaError(reason, "The camera track could not be updated."),
        });
        throw reason;
      }
      cameraOnRef.current = enabled;
      setCameraOn(enabled);
      await heartbeatRef.current?.();
      setCameraError("");
      logMedia(enabled ? "camera published" : "camera unpublished", {
        tracks: describeTracks(enabled && track ? new MediaStream([track]) : null),
        peers: peerConnectionsRef.current.size,
      });
      setError("");
    } catch (reason) {
      setCameraError(mediaError(reason, "Your camera could not be updated."));
    }
  };

  const updateMicrophone = async (enabled: boolean) => {
    try {
      await setMicrophone(enabled);
      setError("");
    } catch (reason) {
      setError(mediaError(reason, "Your microphone could not be updated."));
    }
  };

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    screenOnRef.current = false;
    setScreenOn(false);
    try {
      await Promise.all([...peerConnectionsRef.current.values()].map(({ screenSender }) =>
        screenSender.replaceTrack(null)));
      logMedia("local screen track unpublished", { peers: peerConnectionsRef.current.size });
    } catch (reason) {
      logMedia("local screen track unpublication failed", { error: mediaError(reason, "Screen sharing could not stop.") });
      throw reason;
    }
    await heartbeatRef.current?.();
  }, []);

  const shareScreen = async () => {
    try {
      if (!isTeacher) return;
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("Choose a screen or window to share.");
      screenStreamRef.current = stream;
      try {
        await Promise.all([...peerConnectionsRef.current.values()].map(({ screenSender }) =>
          screenSender.replaceTrack(videoTrack)));
      } catch (reason) {
        logMedia("local screen track publication failed", {
          tracks: describeTracks(stream),
          error: mediaError(reason, "The shared screen could not be published."),
        });
        throw reason;
      }
      videoTrack.addEventListener("ended", () => void stopScreenShare(), { once: true });
      screenOnRef.current = true;
      setScreenOn(true);
      logMedia("local screen track published", { tracks: describeTracks(stream), peers: peerConnectionsRef.current.size });
      await heartbeatRef.current?.();
      setError("");
    } catch (reason) {
      logMedia("screen share failed", { error: mediaError(reason, "The screen could not be shared.") });
      setError(mediaError(reason, "Your screen could not be shared."));
    }
  };

  const controlStudentMicrophone = async (participantId: string, allowed: boolean) => {
    const participant = participants.find((entry) => entry.id === participantId);
    const userId = participantId === "all" ? "all" : participant?.userId;
    if (!userId) return;
    try {
      await requestMediaJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/microphone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, allowMicrophone: allowed }),
      });
      setError("");
    } catch (reason) {
      setError(mediaError(reason, "The student's microphone could not be updated."));
    }
  };

  const visibleParticipants = useMemo(() => participants
    .filter((participant) => !participantSearch.trim() ||
      participant.name.toLowerCase().includes(participantSearch.trim().toLowerCase()))
    .sort((left, right) =>
      Number(right.role === "teacher") - Number(left.role === "teacher") ||
      left.name.localeCompare(right.name)),
  [participantSearch, participants]);
  const screenVideo = remoteMedia.find((entry) =>
    entry.kind === "video" && entry.source === "screen" && entry.active);
  const localScreen = screenOn ? screenStreamRef.current : null;
  const teacher = participants.find((participant) => participant.role === "teacher");
  const teacherIsSharingScreen = Boolean(teacher?.screenOn || (isTeacher && screenOn));
  const teacherMicrophoneOn = teacher?.id === participantIdRef.current ? microphoneOn : Boolean(teacher?.microphoneOn);
  const teacherCamera = teacher?.id === participantIdRef.current
    ? (cameraOn ? localVideo : null)
    : remoteMedia.find((entry) =>
      entry.kind === "video" && entry.participantId === teacher?.id &&
      entry.source === "camera" && entry.active)?.stream || null;
  const teacherStream = teacherIsSharingScreen ? null : teacherCamera;
  const mainStream = localScreen || screenVideo?.stream || teacherStream || (isTeacher && cameraOn ? localVideo : null);
  const mainLabel = localScreen
    ? "Your shared screen"
    : screenVideo
      ? `${screenVideo.name}'s shared screen`
        : teacherStream
          ? `${teacherName}'s camera`
          : "Class camera preview";
  const stripParticipants = visibleParticipants.filter((participant) =>
    participant.role !== "teacher" || teacherIsSharingScreen);
  const galleryScreen = localScreen || screenVideo?.stream || null;
  const galleryScreenName = localScreen ? "Your shared screen" : `${screenVideo?.name || teacherName}'s shared screen`;
  const hasActiveRemoteTrack = remoteMedia.some((entry) => entry.active);
  const classroomClass = [
    styles.mediaClassroom,
    viewMode === "gallery" ? styles.galleryMode : "",
    viewMode === "speaker" ? styles[`strip_${stripPosition}`] : "",
  ].filter(Boolean).join(" ");
  const cameraForParticipant = (participant: Participant) => {
    if (!participant.cameraOn) return null;
    if (participant.id === participantIdRef.current) return cameraOn ? localVideo : null;
    return remoteMedia.find((entry) =>
      entry.kind === "video" && entry.participantId === participant.id &&
      entry.source === "camera" && entry.active)?.stream || null;
  };
  const debugRows = [
    {
      id: participantIdRef.current || "local",
      name: "You",
      video: trackStatus([cameraStreamRef.current, screenStreamRef.current], "video"),
      audio: trackStatus([microphoneStreamRef.current], "audio"),
      connection: "local",
      ice: "local",
    },
    ...participants
      .filter((participant) => participant.id !== participantIdRef.current)
      .map((participant) => {
        const peer = peerConnectionsRef.current.get(participant.id)?.connection;
        const streams = remoteMedia
          .filter((entry) => entry.participantId === participant.id)
          .map((entry) => entry.stream);
        const pair = debugCandidatePairs[participant.id];
        return {
          id: participant.id,
          name: participant.name,
          video: trackStatus(streams, "video"),
          audio: trackStatus(streams, "audio"),
          connection: debugPeerStates[participant.id]?.connection || peer?.connectionState || "not created",
          ice: debugPeerStates[participant.id]?.ice || peer?.iceConnectionState || "not created",
          candidatePair: pair
            ? `${pair.localType}/${pair.remoteType} ${pair.protocol}`
            : "not selected",
        };
      }),
  ];

  return (
    <div className={classroomClass}>
      <div className={styles.viewControls}>
        <div className={styles.viewModeButtons} role="group" aria-label="Classroom view">
          <button type="button" aria-pressed={viewMode === "speaker"} onClick={() => setViewMode("speaker")}>Speaker</button>
          <button type="button" aria-pressed={viewMode === "gallery"} onClick={() => setViewMode("gallery")}>Gallery</button>
        </div>
        {viewMode === "speaker" && (
          <label className={styles.stripPositionControl}>
            <span>Strip</span>
            <select aria-label="Participant strip position" value={stripPosition} onChange={(event) => setStripPosition(event.target.value as StripPosition)}>
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        )}
      </div>

      {debugEnabled && (
        <aside className={styles.mediaDebugPanel} aria-label="Media diagnostics">
          <strong>Media diagnostics</strong>
          <span>
            Secure context: {debugIceConfig ? (debugIceConfig.secureContext ? "yes" : "no") : "checking"} ·
            TURN configured: {debugIceConfig ? (debugIceConfig.hasTurnRelay ? "yes" : "no") : "checking"}
          </span>
          {debugRows.map((row) => (
            <div className={styles.mediaDebugRow} key={row.id}>
              <strong>{row.name}</strong>
              <span>Video: {row.video}</span>
              <span>Audio: {row.audio}</span>
              <span>Connection: {row.connection}</span>
              <span>ICE: {row.ice}</span>
              {"candidatePair" in row && <span>Candidate pair: {row.candidatePair}</span>}
            </div>
          ))}
        </aside>
      )}

      {viewMode === "speaker" ? (
        <>
          <div className={styles.mediaMain}>
            {mainStream
              ? <VideoView
                stream={mainStream}
                label={mainLabel}
                className={styles.mediaMainVideo}
                muted
              />
              : (
                <div className={styles.mediaPlaceholder}>
                  <span className={styles.mediaAvatar}>
                    <ParticipantAvatar name={teacherName} photoUrl={teacher?.profilePhotoUrl || ""} gender={teacher?.gender || ""} />
                  </span>
                  <strong>{classStatus === "scheduled" ? "Your camera is ready" : mediaState === "failed" ? "Video unavailable" : "Waiting for video"}</strong>
                  <span>{cameraError || error || (isTeacher ? "Allow camera access to show your video." : "Your tutor's camera will appear here.")}</span>
                </div>
              )}
            {(screenVideo || localScreen) && (
              <span className={styles.screenShareBadge}>
                {localScreen ? "Your screen is shared" : `Screen shared by ${screenVideo?.name}`}
              </span>
            )}
            {!screenVideo && !localScreen && mainStream && (
              <>
                <span className={styles.screenShareBadge}>{mainLabel}</span>
                {teacherStream && (
                  <span className={styles.mainMicIndicator} aria-label={teacherMicrophoneOn ? "Tutor microphone on" : "Tutor microphone muted"}>
                    <ControlIcon name={teacherMicrophoneOn ? "microphone" : "microphone-off"} />
                    {teacherMicrophoneOn ? "Mic on" : "Muted"}
                  </span>
                )}
              </>
            )}
            <span className={styles.mediaConnection} role="status">
              {mediaState === "connected"
                ? hasActiveRemoteTrack ? "Media connected" : "Transport connected · waiting for media tracks"
                : mediaState === "connecting"
                  ? "Connecting video…"
                  : mediaState === "failed"
                    ? "Video unavailable"
                    : "Waiting for participants"}
            </span>
          </div>
          <aside className={styles.participantRail} aria-label="Class participants">
            <div className={styles.participantRailHeader}>
              <strong>Participants</strong>
              <span>{stripParticipants.length}</span>
              {isTeacher && (
                <input
                  className={styles.participantSearch}
                  type="search"
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  placeholder="Find a student"
                  aria-label="Find a student"
                />
              )}
            </div>
            <div className={styles.participantList}>
              {stripParticipants.map((participant) => (
                <ParticipantTile
                  key={participant.id}
                  participant={participant}
                  stream={cameraForParticipant(participant)}
                  isSelf={participant.id === participantIdRef.current}
                  isSpeaker={activeSpeakerId ? activeSpeakerId === participant.id : participant.role === "teacher"}
                  canManageMicrophone={isTeacher && classStatus === "live"}
                  onToggleMicrophone={() => void controlStudentMicrophone(participant.id, !participant.micAllowed)}
                />
              ))}
              {stripParticipants.length === 0 && (
                <p className={styles.participantEmpty}>
                  {classStatus === "scheduled" ? "Participants will appear when the class starts." : "No other participants are here yet."}
                </p>
              )}
            </div>
          </aside>
        </>
      ) : (
        <div className={styles.mediaGallery} aria-label="Gallery view">
          {galleryScreen && (
            <article className={styles.galleryScreenCard}>
              <div className={styles.participantVideo}>
                <VideoView stream={galleryScreen} label={galleryScreenName} className={styles.participantVideoElement} muted />
              </div>
              <div className={styles.participantMeta}><strong>{galleryScreenName}</strong></div>
            </article>
          )}
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              participant={participant}
              stream={cameraForParticipant(participant)}
              isSelf={participant.id === participantIdRef.current}
              isSpeaker={activeSpeakerId ? activeSpeakerId === participant.id : participant.role === "teacher"}
              canManageMicrophone={isTeacher && classStatus === "live"}
              onToggleMicrophone={() => void controlStudentMicrophone(participant.id, !participant.micAllowed)}
            />
          ))}
          {participants.length === 0 && <p className={styles.participantEmpty}>Waiting for participants to join.</p>}
        </div>
      )}

      <div className={styles.audioViews} aria-label="Remote participant audio">
        {remoteMedia.filter((entry) => entry.kind === "audio").map((entry) => (
          <AudioView key={`${entry.participantId}-${entry.kind}`} stream={entry.stream} participantName={entry.name} />
        ))}
      </div>
      <div className={styles.mediaControls} role="group" aria-label="Classroom controls">
        <button
          className={`${styles.mediaControlButton} ${microphoneOn ? "" : styles.mediaControlOff}`}
          type="button"
          onClick={() => void updateMicrophone(!microphoneOn)}
          disabled={!isTeacher && !microphoneAllowed}
          aria-label={microphoneOn ? "Mute microphone" : isTeacher || microphoneAllowed ? "Turn microphone on" : "Microphone muted by tutor"}
        >
          <ControlIcon name={microphoneOn ? "microphone" : "microphone-off"} />
          <span>{microphoneOn ? "Mute" : isTeacher || microphoneAllowed ? "Unmute" : "Muted"}</span>
        </button>
        <button
          className={`${styles.mediaControlButton} ${cameraOn ? "" : styles.mediaControlOff}`}
          type="button"
          onClick={() => void updateCamera(!cameraOn)}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          <ControlIcon name={cameraOn ? "camera" : "camera-off"} />
          <span>{cameraOn ? "Stop video" : "Start video"}</span>
        </button>
        {isTeacher && classStatus === "live" && (
          screenSharingSupported
            ? <button
              className={`${styles.mediaControlButton} ${screenOn ? styles.mediaControlActive : ""}`}
              type="button"
              onClick={() => screenOn ? void stopScreenShare() : void shareScreen()}
              aria-label={screenOn ? "Stop sharing screen" : "Share screen"}
            >
              <ControlIcon name="screen" />
              <span>{screenOn ? "Stop share" : "Share screen"}</span>
            </button>
            : <span className={styles.mediaUnsupported}>Screen sharing is not available in this browser.</span>
        )}
        {isTeacher && classStatus === "live" && (
          <>
            <button className={styles.mediaControlButton} type="button" onClick={() => void controlStudentMicrophone("all", true)}>
              <ControlIcon name="microphone-all" />
              <span>Unmute all</span>
            </button>
            <button className={styles.mediaControlButton} type="button" onClick={() => void controlStudentMicrophone("all", false)}>
              <ControlIcon name="microphone-off" />
              <span>Mute all</span>
            </button>
          </>
        )}
        {(cameraError || error) && <p className={styles.mediaError} role="alert">{cameraError || error}</p>}
      </div>
    </div>
  );
}
