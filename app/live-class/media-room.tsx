"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Device, type types } from "mediasoup-client";
import { io, type Socket } from "socket.io-client";
import styles from "./room.module.css";

type ParticipantRole = "teacher" | "student";
type MediaKind = "audio" | "video";

interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  micAllowed: boolean;
  microphoneOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  profilePhotoUrl: string;
  gender: string;
}

interface ProducerInfo {
  participantId: string;
  producerId: string;
  kind: MediaKind;
  name: string;
  role: ParticipantRole;
  source: "camera" | "screen" | "microphone";
}

interface MediaStreamEntry extends ProducerInfo {
  stream: MediaStream;
}

interface SocketResponse {
  ok: boolean;
  error?: string;
}

interface TransportParameters {
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: types.DtlsParameters;
  iceServers?: RTCIceServer[];
}

interface JoinResponse extends SocketResponse {
  participantId: string;
  role: ParticipantRole;
  microphoneAllowed: boolean;
  rtcCapabilities: types.RtpCapabilities;
  participants: Participant[];
  producers: ProducerInfo[];
  iceServers: RTCIceServer[];
}

interface CreateTransportResponse extends SocketResponse {
  params: TransportParameters;
}

interface ConsumeResponse extends SocketResponse {
  params: {
    id: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: types.RtpParameters;
    appData?: { source?: "camera" | "screen" | "microphone" };
  };
}

interface ProducerResponse extends SocketResponse {
  producerId: string;
}

interface LiveMediaRoomProps {
  sessionId: string;
  role: "teacher" | "learner";
  classStatus: "scheduled" | "live";
  teacherName: string;
}

function requestSocket<T extends SocketResponse>(
  socket: Socket,
  eventName: string,
  payload: object,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("The media server did not respond. Retry the connection.")), 15000);
    socket.emit(eventName, payload, (response: T) => {
      window.clearTimeout(timeout);
      if (!response?.ok) {
        reject(new Error(response?.error || "The live media request could not be completed."));
        return;
      }
      resolve(response);
    });
  });
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
  if (photoUrl) {
    return <img className={styles.participantAvatar} src={photoUrl} alt="" />;
  }
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

function VideoView({
  stream,
  label,
  className,
}: {
  stream: MediaStream;
  label: string;
  className: string;
}) {
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
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<types.Transport | null>(null);
  const receiveTransportRef = useRef<types.Transport | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraProducerRef = useRef<types.Producer | null>(null);
  const microphoneProducerRef = useRef<types.Producer | null>(null);
  const screenVideoProducerRef = useRef<types.Producer | null>(null);
  const screenAudioProducerRef = useRef<types.Producer | null>(null);
  const consumersRef = useRef(new Map<string, types.Consumer>());
  const pendingProducersRef = useRef(new Map<string, ProducerInfo>());
  const participantIdRef = useRef("");
  const microphoneAllowedRef = useRef(isTeacher);

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
    setLocalVideo(stream);
    setCameraOn(true);
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

  const upsertParticipant = useCallback((incoming: Participant) => {
    setParticipants((current) => [
      ...current.filter((participant) =>
        participant.id !== incoming.id || participant.role !== incoming.role),
      incoming,
    ]);
  }, []);

  const removeRemoteMedia = useCallback((producerId: string) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      consumersRef.current.delete(producerId);
      consumer.close();
    }
    setRemoteMedia((current) => current.filter((entry) => entry.producerId !== producerId));
  }, []);

  const consumeProducer = useCallback(async (producer: ProducerInfo) => {
    const socket = socketRef.current;
    const device = deviceRef.current;
    const receiveTransport = receiveTransportRef.current;
    if (!socket || !device || !receiveTransport) {
      pendingProducersRef.current.set(producer.producerId, producer);
      return;
    }
    if (consumersRef.current.has(producer.producerId)) return;
    const response = await requestSocket<ConsumeResponse>(socket, "live-class:consume", {
      transportId: receiveTransport.id,
      producerId: producer.producerId,
      rtpCapabilities: device.rtpCapabilities,
    });
    const consumer = await receiveTransport.consume({
      id: response.params.id,
      producerId: response.params.producerId,
      kind: response.params.kind,
      rtpParameters: response.params.rtpParameters,
      appData: { source: response.params.appData?.source || producer.source },
    });
    consumersRef.current.set(producer.producerId, consumer);
    const stream = new MediaStream([consumer.track]);
    const source = response.params.appData?.source || producer.source;
    setRemoteMedia((current) => [
      ...current.filter((entry) => entry.producerId !== producer.producerId),
      { ...producer, source, stream },
    ]);
    consumer.on("transportclose", () => removeRemoteMedia(producer.producerId));
    consumer.on("trackended", () => removeRemoteMedia(producer.producerId));
    await requestSocket(socket, "live-class:resume-consumer", { consumerId: consumer.id });
  }, [removeRemoteMedia]);

  const publishTrack = useCallback(async (
    track: MediaStreamTrack,
    source: "camera" | "screen" | "microphone",
  ) => {
    const transport = sendTransportRef.current;
    if (!transport) return null;
    return transport.produce({
      track,
      encodings: track.kind === "video" ? [{ maxBitrate: 500_000 }] : undefined,
      appData: { source },
    });
  }, []);

  const setMicrophone = useCallback(async (enabled: boolean) => {
    if (!isTeacher && !microphoneAllowedRef.current) {
      setMicrophoneOn(false);
      return;
    }
    const stream = await ensureMicrophone();
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("No microphone was found.");
    track.enabled = enabled;
    const producer = microphoneProducerRef.current;
    if (enabled && !producer) {
      microphoneProducerRef.current = await publishTrack(track, "microphone");
    } else if (enabled && producer?.paused) {
      producer.resume();
    } else if (!enabled && producer && !producer.paused) {
      producer.pause();
    }
    setMicrophoneOn(enabled);
  }, [ensureMicrophone, isTeacher, publishTrack]);

  useEffect(() => {
    let active = true;
    if (classStatus === "scheduled") {
      setMediaState("waiting");
    }
    void ensureCamera().catch((reason: unknown) => {
      if (active) setError(mediaError(reason, "The camera could not be opened."));
    });
    if (isTeacher) {
      void ensureMicrophone().catch((reason: unknown) => {
        if (active) setError(mediaError(reason, "The microphone could not be opened."));
      });
    }
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
  }, [ensureCamera, ensureMicrophone, isTeacher]);

  useEffect(() => {
    if (classStatus !== "live") {
      setMediaState("waiting");
      return;
    }
    let active = true;
    let socket: Socket | null = null;

    const connect = async () => {
      setMediaState("connecting");
      setError("");
      try {
        socket = io({
          path: "/live-class/socket.io",
          autoConnect: false,
          transports: ["websocket", "polling"],
        });
        socketRef.current = socket;
        socket.on("connect_error", (reason) => {
          if (active) {
            setMediaState("failed");
            setError(mediaError(reason, "The live media connection could not be reached."));
          }
        });
        socket.on("live-class:participants", (entries: Participant[]) => {
          if (active) setParticipants(entries);
        });
        socket.on("live-class:participant-state", (participant: Participant) => {
          if (active) upsertParticipant(participant);
        });
        socket.on("live-class:new-producer", (producer: ProducerInfo) => {
          void consumeProducer(producer).catch((reason: unknown) => {
            if (active) setError(mediaError(reason, "A participant's media could not be received."));
          });
        });
        socket.on("live-class:microphone", (event: { allowed: boolean; message?: string }) => {
          microphoneAllowedRef.current = event.allowed;
          setMicrophoneAllowed(event.allowed);
          if (event.allowed) {
            void setMicrophone(true).catch((reason: unknown) =>
              setError(mediaError(reason, "The microphone could not be enabled.")));
          } else {
            const track = microphoneStreamRef.current?.getAudioTracks()[0];
            if (track) track.enabled = false;
            if (microphoneProducerRef.current && !microphoneProducerRef.current.paused) {
              microphoneProducerRef.current.pause();
            }
            setMicrophoneOn(false);
          }
        });
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("The live media connection timed out.")), 15000);
          socket?.once("connect", () => {
            window.clearTimeout(timeout);
            resolve();
          });
          socket?.once("connect_error", (reason) => {
            window.clearTimeout(timeout);
            reject(reason);
          });
          socket?.connect();
        });
        const joined = await requestSocket<JoinResponse>(socket, "live-class:join", { sessionId });
        const device = new Device();
        await device.load({ routerRtpCapabilities: joined.rtcCapabilities });
        if (!active) return;
        deviceRef.current = device;
        participantIdRef.current = joined.participantId;
        microphoneAllowedRef.current = joined.microphoneAllowed;
        setMicrophoneAllowed(joined.microphoneAllowed);
        setParticipants(joined.participants);

        const createTransport = async (direction: "send" | "receive") => {
          const created = await requestSocket<CreateTransportResponse>(
            socket!,
            "live-class:create-transport",
            { direction },
          );
          const options = { ...created.params, iceServers: joined.iceServers };
          const transport = direction === "send"
            ? device.createSendTransport(options)
            : device.createRecvTransport(options);
          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            void requestSocket(socket!, "live-class:connect-transport", {
              transportId: transport.id,
              dtlsParameters,
            }).then(() => callback()).catch((reason: unknown) =>
              errback(reason instanceof Error ? reason : new Error("The media transport could not connect.")));
          });
          if (direction === "send") {
            transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
              void requestSocket<ProducerResponse>(socket!, "live-class:produce", {
                transportId: transport.id,
                kind,
                rtpParameters,
                source: appData?.source,
              }).then((response) => callback({ id: response.producerId })).catch((reason: unknown) =>
                errback(reason instanceof Error ? reason : new Error("Your media could not be shared.")));
            });
          }
          transport.on("connectionstatechange", (state) => {
            if (!active) return;
            if (state === "connected") setMediaState("connected");
            if (state === "failed" || state === "disconnected") {
              setMediaState("failed");
              setError("The live media connection was interrupted. Check your network and rejoin.");
            }
          });
          return transport;
        };
        sendTransportRef.current = await createTransport("send");
        receiveTransportRef.current = await createTransport("receive");

        for (const producer of joined.producers) {
          void consumeProducer(producer).catch((reason: unknown) => {
            if (active) setError(mediaError(reason, "A participant's media could not be received."));
          });
        }
        for (const producer of pendingProducersRef.current.values()) {
          void consumeProducer(producer).catch((reason: unknown) => {
            if (active) setError(mediaError(reason, "A participant's media could not be received."));
          });
        }
        pendingProducersRef.current.clear();

        try {
          const stream = await ensureCamera();
          const track = stream.getVideoTracks()[0];
          if (track && track.enabled && active) {
            cameraProducerRef.current = await publishTrack(track, "camera");
          }
        } catch (reason) {
          setError(mediaError(reason, "Your camera could not be shared."));
        }
        if (isTeacher || joined.microphoneAllowed) {
          try {
            await setMicrophone(true);
          } catch (reason) {
            setError(mediaError(reason, "Your microphone could not be enabled."));
          }
        }
        if (active) setMediaState("connected");
      } catch (reason) {
        if (active) {
          setMediaState("failed");
          setError(mediaError(reason, "The live class media could not be started."));
        }
      }
    };

    void connect();
    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
      deviceRef.current = null;
      for (const consumer of consumersRef.current.values()) consumer.close();
      consumersRef.current.clear();
      pendingProducersRef.current.clear();
      setRemoteMedia([]);
      setParticipants([]);
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      for (const producer of [
        cameraProducerRef.current,
        microphoneProducerRef.current,
        screenVideoProducerRef.current,
        screenAudioProducerRef.current,
      ]) producer?.close();
      cameraProducerRef.current = null;
      microphoneProducerRef.current = null;
      screenVideoProducerRef.current = null;
      screenAudioProducerRef.current = null;
      sendTransportRef.current?.close();
      receiveTransportRef.current?.close();
      sendTransportRef.current = null;
      receiveTransportRef.current = null;
      microphoneAllowedRef.current = isTeacher;
      setMicrophoneOn(false);
      setScreenOn(false);
    };
  }, [
    classStatus,
    consumeProducer,
    ensureCamera,
    isTeacher,
    publishTrack,
    sessionId,
    setMicrophone,
    upsertParticipant,
  ]);

  const updateCamera = async (enabled: boolean) => {
    try {
      const stream = await ensureCamera();
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("No camera was found.");
      track.enabled = enabled;
      if (enabled && !cameraProducerRef.current) {
        cameraProducerRef.current = await publishTrack(track, "camera");
      } else if (enabled && cameraProducerRef.current?.paused) {
        cameraProducerRef.current.resume();
      } else if (!enabled && cameraProducerRef.current && !cameraProducerRef.current.paused) {
        cameraProducerRef.current.pause();
      }
      if (socketRef.current?.connected) {
        await requestSocket(socketRef.current, "live-class:video-mode", { enabled });
      }
      setCameraOn(enabled);
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

  const stopScreenShare = useCallback(() => {
    for (const producer of [screenVideoProducerRef.current, screenAudioProducerRef.current]) {
      producer?.close();
    }
    screenVideoProducerRef.current = null;
    screenAudioProducerRef.current = null;
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenOn(false);
  }, []);

  const shareScreen = async () => {
    try {
      if (!isTeacher) return;
      if (!sendTransportRef.current) throw new Error("Join the live class before sharing your screen.");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("Choose a screen or window to share.");
      screenStreamRef.current = stream;
      screenVideoProducerRef.current = await publishTrack(videoTrack, "screen");
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) screenAudioProducerRef.current = await publishTrack(audioTrack, "screen");
      videoTrack.addEventListener("ended", stopScreenShare, { once: true });
      setScreenOn(true);
      setError("");
    } catch (reason) {
      setError(mediaError(reason, "Your screen could not be shared."));
    }
  };

  const controlStudentMicrophone = async (participantId: string, allowed: boolean) => {
    if (!socketRef.current) return;
    try {
      await requestSocket(socketRef.current, "live-class:mute", { participantId, allow: allowed });
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
              <strong>{classStatus === "scheduled" ? "Your camera is ready" : "Waiting for video"}</strong>
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
          <AudioView key={entry.producerId} stream={entry.stream} />
        ))}
        <span className={styles.mediaConnection} role="status">
          {mediaState === "connected"
            ? "Video connected"
            : mediaState === "connecting"
              ? "Connecting video…"
              : mediaState === "failed"
                ? "Video unavailable"
                : "Camera preview"}
        </span>
      </div>
      <aside className={styles.participantRail} aria-label="Class participants">
        <div className={styles.participantRailHeader}>
          <strong>Participants</strong>
          <span>{participants.length}</span>
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
              <article className={styles.participantCard} key={`${participant.role}-${participant.id}`}>
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
            onClick={() => screenOn ? stopScreenShare() : void shareScreen()}
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
