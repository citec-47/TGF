"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./room.module.css";

type ParticipantRole = "teacher" | "student";
type MediaKind = "audio" | "video";
type PeerSignalType = "offer" | "answer" | "candidate";

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
  audioSender: RTCRtpSender;
}

interface LiveMediaRoomProps {
  sessionId: string;
  role: "teacher" | "learner";
  classStatus: "scheduled" | "live";
  teacherName: string;
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

function VideoView({ stream, label, className }: { stream: MediaStream; label: string; className: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return <video ref={videoRef} className={className} autoPlay muted playsInline aria-label={label} />;
}

function AudioView({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    void audio.play().catch(() => undefined);
    return () => {
      audio.srcObject = null;
    };
  }, [stream]);
  return <audio ref={audioRef} autoPlay />;
}

export default function LiveMediaRoom({
  sessionId,
  role,
  classStatus,
  teacherName,
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
  const [participantSearch, setParticipantSearch] = useState("");
  const mediaUrl = `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/media`;
  const participantIdRef = useRef("");
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraOnRef = useRef(false);
  const microphoneOnRef = useRef(false);
  const screenOnRef = useRef(false);
  const microphoneAllowedRef = useRef(isTeacher);
  const heartbeatRef = useRef<(() => Promise<void>) | null>(null);
  const peerConnectionsRef = useRef(new Map<string, PeerConnectionState>());
  const peerProfilesRef = useRef(new Map<string, Participant>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const initiatedOffersRef = useRef(new Set<string>());
  const iceServersRef = useRef<RTCIceServer[]>([]);

  const ensureCamera = useCallback(async () => {
    if (cameraStreamRef.current) return cameraStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not available in this browser.");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 360, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    cameraStreamRef.current = stream;
    cameraOnRef.current = true;
    setCameraOn(true);
    setLocalVideo(stream);
    return stream;
  }, []);

  const ensureMicrophone = useCallback(async () => {
    if (microphoneStreamRef.current) return microphoneStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not available in this browser.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = false;
    microphoneStreamRef.current = stream;
    return stream;
  }, []);

  const setMicrophone = useCallback(async (enabled: boolean) => {
    if (!isTeacher && !microphoneAllowedRef.current) {
      microphoneOnRef.current = false;
      setMicrophoneOn(false);
      return;
    }
    const stream = await ensureMicrophone();
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("No microphone was found.");
    track.enabled = enabled;
    await Promise.all([...peerConnectionsRef.current.values()].map(({ audioSender }) =>
      audioSender.replaceTrack(track)));
    microphoneOnRef.current = enabled;
    setMicrophoneOn(enabled);
    await heartbeatRef.current?.();
  }, [ensureMicrophone, isTeacher]);

  const upsertRemoteMedia = useCallback((participant: Participant, kind: MediaKind, track: MediaStreamTrack) => {
    const stream = new MediaStream([track]);
    setRemoteMedia((current) => [
      ...current.filter((entry) => entry.participantId !== participant.id || entry.kind !== kind),
      {
        participantId: participant.id,
        kind,
        name: participant.name,
        source: kind === "video" ? participant.screenOn ? "screen" : "camera" : "microphone",
        stream,
      },
    ]);
  }, []);

  useEffect(() => {
    let active = true;
    void ensureCamera().catch((reason: unknown) => {
      if (active) setError(mediaError(reason, "The camera could not be opened."));
    });
    return () => {
      active = false;
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
    for (const participant of participants) {
      peerProfilesRef.current.set(participant.id, participant);
    }
    setRemoteMedia((current) => current.map((entry) => {
      const participant = peerProfilesRef.current.get(entry.participantId);
      if (!participant || entry.kind !== "video") return entry;
      const source = participant.screenOn ? "screen" : "camera";
      return entry.source === source && entry.name === participant.name
        ? entry
        : { ...entry, source, name: participant.name };
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
      const camera = await ensureCamera();
      const microphone = await ensureMicrophone();
      const connection = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const videoTransceiver = connection.addTransceiver("video", { direction: "sendrecv" });
      const audioTransceiver = connection.addTransceiver("audio", { direction: "sendrecv" });
      const currentVideo = screenStreamRef.current?.getVideoTracks()[0] || camera.getVideoTracks()[0];
      const currentAudio = microphone.getAudioTracks()[0];
      await videoTransceiver.sender.replaceTrack(currentVideo || null);
      await audioTransceiver.sender.replaceTrack(currentAudio || null);
      const peerState: PeerConnectionState = {
        connection,
        videoSender: videoTransceiver.sender,
        audioSender: audioTransceiver.sender,
      };
      peerConnectionsRef.current.set(participant.id, peerState);
      connection.onicecandidate = (event) => {
        if (event.candidate && active) {
          void sendSignal(participant.id, "candidate", event.candidate.toJSON()).catch((reason: unknown) =>
            setError(mediaError(reason, "A live media connection could not be established.")));
        }
      };
      connection.ontrack = (event) => {
        const profile = peerProfilesRef.current.get(participant.id) || participant;
        upsertRemoteMedia(profile, event.track.kind === "video" ? "video" : "audio", event.track);
      };
      connection.onconnectionstatechange = () => {
        if (!active) return;
        if (connection.connectionState === "connected") {
          setMediaState("connected");
          setError("");
        } else if (connection.connectionState === "failed") {
          setMediaState("failed");
          setError("A participant connection failed. This network may require a TURN relay.");
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
        const nextProfiles = new Map(result.participants.map((participant) => [participant.id, participant]));
        peerProfilesRef.current = nextProfiles;
        setParticipants(result.participants);
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
      })
      .catch((reason: unknown) => {
        if (active) {
          setMediaState("failed");
          setError(mediaError(reason, "Camera access is required to join the live class."));
        }
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
      const stream = await ensureCamera();
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("No camera was found.");
      track.enabled = enabled;
      cameraOnRef.current = enabled;
      setCameraOn(enabled);
      await heartbeatRef.current?.();
    } catch (reason) {
      setError(mediaError(reason, "Your camera could not be updated."));
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
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    await Promise.all([...peerConnectionsRef.current.values()].map(({ videoSender }) =>
      videoSender.replaceTrack(cameraOnRef.current ? cameraTrack : null)));
    await heartbeatRef.current?.();
  }, []);

  const shareScreen = async () => {
    try {
      if (!isTeacher) return;
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("Choose a screen or window to share.");
      screenStreamRef.current = stream;
      await Promise.all([...peerConnectionsRef.current.values()].map(({ videoSender }) =>
        videoSender.replaceTrack(videoTrack)));
      videoTrack.addEventListener("ended", () => void stopScreenShare(), { once: true });
      screenOnRef.current = true;
      setScreenOn(true);
      await heartbeatRef.current?.();
      setError("");
    } catch (reason) {
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
  const screenVideo = remoteMedia.find((entry) => entry.kind === "video" && entry.source === "screen");
  const localScreen = screenOn ? screenStreamRef.current : null;
  const teacher = participants.find((participant) => participant.role === "teacher");
  const teacherStream = teacher?.id === participantIdRef.current
    ? (cameraOn ? localVideo : null)
    : remoteMedia.find((entry) =>
      entry.kind === "video" && entry.participantId === teacher?.id && entry.source === "camera")?.stream || null;
  const mainStream = localScreen || screenVideo?.stream || teacherStream || (isTeacher && cameraOn ? localVideo : null);
  const mainLabel = localScreen
    ? "Your shared screen"
    : screenVideo
      ? `${screenVideo.name}'s shared screen`
      : teacherStream
        ? `${teacherName}'s camera`
        : "Class camera preview";
  const activeStudents = participants.filter((participant) => participant.role === "student").length;

  return (
    <div className={styles.mediaClassroom}>
      <div className={styles.mediaMain}>
        {mainStream
          ? <VideoView stream={mainStream} label={mainLabel} className={styles.mediaMainVideo} />
          : (
            <div className={styles.mediaPlaceholder}>
              <span className={styles.mediaAvatar}>
                <ParticipantAvatar name={teacherName} photoUrl={teacher?.profilePhotoUrl || ""} gender={teacher?.gender || ""} />
              </span>
              <strong>{classStatus === "scheduled" ? "Your camera is ready" : mediaState === "failed" ? "Video unavailable" : "Waiting for video"}</strong>
              <span>{error || (isTeacher ? "Allow camera access to show your video." : "Your tutor's camera will appear here.")}</span>
            </div>
          )}
        {(screenVideo || localScreen) && (
          <span className={styles.screenShareBadge}>
            {localScreen ? "Your screen is shared" : `Screen shared by ${screenVideo?.name}`}
          </span>
        )}
        {!screenVideo && !localScreen && mainStream && <span className={styles.screenShareBadge}>{mainLabel}</span>}
        {remoteMedia.filter((entry) => entry.kind === "audio").map((entry) => (
          <AudioView key={`${entry.participantId}-${entry.kind}`} stream={entry.stream} />
        ))}
        <span className={styles.mediaConnection} role="status">
          {mediaState === "connected"
            ? "Video connected"
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
          <span>{activeStudents}</span>
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
          {visibleParticipants.map((participant) => {
            const isSelf = participant.id === participantIdRef.current;
            const video = isSelf
              ? (cameraOn ? localVideo : null)
              : remoteMedia.find((entry) =>
                entry.kind === "video" && entry.participantId === participant.id && entry.source === "camera")?.stream || null;
            return (
              <article className={styles.participantCard} key={participant.id}>
                <div className={styles.participantVideo}>
                  {video
                    ? <VideoView stream={video} label={`${participant.name}'s camera`} className={styles.participantVideoElement} />
                    : <ParticipantAvatar name={participant.name} photoUrl={participant.profilePhotoUrl} gender={participant.gender} />}
                  <span className={styles.participantMic} aria-label={participant.microphoneOn ? "Microphone enabled" : "Microphone muted"}>
                    {participant.microphoneOn ? "Mic on" : "Muted"}
                  </span>
                </div>
                <div className={styles.participantMeta}>
                  <strong>{participant.name}{isSelf ? " (you)" : ""}</strong>
                  {participant.role === "student" && isTeacher && (
                    <button
                      type="button"
                      onClick={() => void controlStudentMicrophone(participant.id, !participant.micAllowed)}
                    >
                      {participant.micAllowed ? "Mute" : "Unmute"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {participants.length === 0 && (
            <p className={styles.participantEmpty}>
              {classStatus === "scheduled" ? "Participants will appear when the class starts." : "Waiting for participants to join."}
            </p>
          )}
        </div>
      </aside>
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
          <button
            className={`${styles.mediaControlButton} ${screenOn ? styles.mediaControlActive : ""}`}
            type="button"
            onClick={() => screenOn ? void stopScreenShare() : void shareScreen()}
            aria-label={screenOn ? "Stop sharing screen" : "Share screen"}
          >
            <ControlIcon name="screen" />
            <span>{screenOn ? "Stop share" : "Share screen"}</span>
          </button>
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
        {error && <p className={styles.mediaError} role="alert">{error}</p>}
      </div>
    </div>
  );
}
