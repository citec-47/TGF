"use client";

import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
} from "livekit-client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { RefCallback } from "react";

interface JoinResponse {
  token?: string;
  liveKitUrl?: string;
  role?: "teacher" | "learner" | "administrator";
  sessionId: string;
  programmeTitle: string;
  teacherName: string;
  teacherId: string;
  startsAt?: string;
  endsAt?: string;
  waitingForTeacher?: boolean;
}

interface LiveChatMessage {
  id: string;
  participantId: string;
  name: string;
  body: string;
  sentAt: string;
}

interface ParticipantRow {
  participant: Participant;
  tracks: Array<{ key: string; track: NonNullable<TrackPublication["track"]>; video: boolean }>;
}

function MediaTrack({
  track,
  video,
  label,
}: {
  track: NonNullable<TrackPublication["track"]>;
  video: boolean;
  label: string;
}) {
  const ref = useCallback((element: HTMLMediaElement | null) => {
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return video
    ? <video className="livekit-video" ref={ref as RefCallback<HTMLVideoElement>} autoPlay playsInline aria-label={label} />
    : <audio ref={ref as RefCallback<HTMLAudioElement>} autoPlay />;
}

function getParticipantTracks(participant: Participant): ParticipantRow["tracks"] {
  const tracks: ParticipantRow["tracks"] = [];
  for (const publication of participant.trackPublications.values()) {
    if (!publication.track) continue;
    const video = publication.kind === Track.Kind.Video;
    if (participant.isLocal && !video) continue;
    tracks.push({
      key: `${participant.identity}:${publication.source}`,
      track: publication.track,
      video,
    });
  }
  return tracks;
}

function LiveClassRoom() {
  const search = useSearchParams();
  const liveSessionId = search.get("sessionId") || "";
  const slotId = search.get("slotId") || "";
  const classDate = search.get("date") || "";
  const [room, setRoom] = useState<Room | null>(null);
  const [info, setInfo] = useState<JoinResponse | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [status, setStatus] = useState("Connecting to your class…");
  const [error, setError] = useState("");
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [recordingConfirmed, setRecordingConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);

  const isTutor = info?.role === "teacher";
  const isAdministrator = info?.role === "administrator";

  const refreshParticipants = useCallback((currentRoom: Room) => {
    const all: Participant[] = [currentRoom.localParticipant, ...currentRoom.remoteParticipants.values()];
    setParticipants(all.map((participant) => ({
      participant,
      tracks: getParticipantTracks(participant),
    })));
  }, []);

  useEffect(() => {
    if (!liveSessionId && (!slotId || !/^\d{4}-\d{2}-\d{2}$/.test(classDate))) {
      setError("Choose a live class invitation or a valid class from your timetable.");
      return;
    }

    let active = true;
    let currentRoom: Room | undefined;
    let joinTimer = 0;
    const connectToRoom = async (result: JoinResponse) => {
      if (!result.token || !result.liveKitUrl) {
        throw new Error("The server did not issue a valid class access token.");
      }
      setInfo(result);
      if (result.role !== "teacher") setRecordingConfirmed(true);
      currentRoom = new Room({ adaptiveStream: true, dynacast: true });
      currentRoom.on(RoomEvent.TrackSubscribed, (_track, _publication, participant) => {
        refreshParticipants(currentRoom!);
        if (participant.identity) setStatus("");
      });
      currentRoom.on(RoomEvent.TrackUnsubscribed, () => refreshParticipants(currentRoom!));
      currentRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        refreshParticipants(currentRoom!);
        if (participant.identity === result.teacherId) setStatus("");
      });
      currentRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        refreshParticipants(currentRoom!);
        if (result.role === "learner" && participant.identity === result.teacherId) {
          setStatus("Your tutor disconnected. Waiting for them to reconnect…");
        }
      });
      currentRoom.on(RoomEvent.LocalTrackPublished, () => refreshParticipants(currentRoom!));
      currentRoom.on(RoomEvent.LocalTrackUnpublished, () => refreshParticipants(currentRoom!));
      currentRoom.on(RoomEvent.ActiveSpeakersChanged, (activeSpeakers) => {
        setSpeakers(activeSpeakers.map((participant) => participant.identity));
      });
      currentRoom.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (!participant) return;
        const message = new TextDecoder().decode(payload);
        if (topic === "tgf-live-chat") {
          try {
            const parsed = JSON.parse(message) as { body?: unknown };
            const body = parsed.body;
            if (typeof body !== "string" || body.trim().length === 0 || body.length > 500) return;
            setChatMessages((previous) => [...previous.slice(-99), {
              id: `${participant.identity}-${Date.now()}-${previous.length}`,
              participantId: participant.identity,
              name: participant.name || participant.identity,
              body,
              sentAt: new Date().toISOString(),
            }]);
          } catch {
            return;
          }
          return;
        }
        if (topic !== "tgf-live-hand") return;
        setRaisedHands((previous) => {
          const next = new Set(previous);
          if (message === "hand-up") next.add(participant.identity);
          if (message === "hand-down") next.delete(participant.identity);
          return next;
        });
      });
      currentRoom.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
        setStatus(connectionState === ConnectionState.Connected ? "" : "Reconnecting to class…");
      });
      await currentRoom.connect(result.liveKitUrl, result.token);
      if (!active) {
        await currentRoom.disconnect();
        return;
      }
      setRoom(currentRoom);
      refreshParticipants(currentRoom);
      setStatus("");
      if (result.role === "teacher") {
        try {
          const response = await fetch(`/api/collaboration/sessions/${encodeURIComponent(result.sessionId)}/start`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const startResult = await response.json() as { error?: string };
          if (!response.ok) throw new Error(startResult.error || "The lesson could not be started.");
          setRecordingConfirmed(true);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "The lesson could not be started.");
          await currentRoom.disconnect();
          if (active) {
            setRoom(null);
            setStatus("The class is closed until automatic recording can be started.");
          }
        }
      }
    };

    const requestJoin = async () => {
      try {
        const joinUrl = liveSessionId
          ? `/api/collaboration/live-sessions/${encodeURIComponent(liveSessionId)}/join`
          : `/api/collaboration/sessions/${encodeURIComponent(slotId)}/join`;
        const response = await fetch(joinUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(liveSessionId ? {} : { classDate }),
        });
        const result = await response.json() as JoinResponse & { error?: string };
        if (!response.ok) throw new Error(result.error || "This class could not be joined.");
        if (!active) return;
        setInfo(result);
        if (result.waitingForTeacher) {
          setStatus("Waiting for teacher to start");
          joinTimer = window.setTimeout(() => void requestJoin(), 3000);
          return;
        }
        await connectToRoom(result);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The class could not be joined.");
      }
    };

    void requestJoin();
    return () => {
      active = false;
      window.clearTimeout(joinTimer);
      if (currentRoom) void currentRoom.disconnect();
    };
  }, [classDate, liveSessionId, refreshParticipants, slotId]);

  useEffect(() => {
    if (!room) return;
    const update = () => refreshParticipants(room);
    room.on(RoomEvent.TrackMuted, update);
    room.on(RoomEvent.TrackUnmuted, update);
    return () => {
      room.off(RoomEvent.TrackMuted, update);
      room.off(RoomEvent.TrackUnmuted, update);
    };
  }, [refreshParticipants, room]);

  const localParticipant = room?.localParticipant;
  const isHandRaised = localParticipant ? raisedHands.has(localParticipant.identity) : false;

  const joinDisplay = useMemo(() => info
    ? info.startsAt
      ? `${new Intl.DateTimeFormat("en-CM", { dateStyle: "full", timeStyle: "short" }).format(new Date(info.startsAt))}`
      : "On-demand live class"
    : "", [info]);

  async function toggleMicrophone() {
    if (!localParticipant) return;
    setBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!micEnabled);
      setMicEnabled(!micEnabled);
      setError("");
    } catch {
      setError("Your microphone is muted by default. Ask the tutor to allow you to speak.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCamera() {
    if (!localParticipant || !isTutor) return;
    setBusy(true);
    try {
      await localParticipant.setCameraEnabled(!cameraEnabled);
      setCameraEnabled(!cameraEnabled);
      setError("");
    } catch {
      setError("Camera access is unavailable. Check your browser permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleScreenShare() {
    if (!localParticipant || !isTutor) return;
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(!screenShareEnabled);
      setScreenShareEnabled(!screenShareEnabled);
      setError("");
    } catch {
      setError("Screen sharing is unavailable. Check your browser permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRaisedHand() {
    if (!localParticipant || !room) return;
    const next = !isHandRaised;
    try {
      await localParticipant.publishData(new TextEncoder().encode(next ? "hand-up" : "hand-down"), {
        reliable: true,
        topic: "tgf-live-hand",
      });
      setRaisedHands((previous) => {
        const updated = new Set(previous);
        if (next) updated.add(localParticipant.identity);
        else updated.delete(localParticipant.identity);
        return updated;
      });
    } catch {
      setError("Your hand could not be raised. Please try again.");
    }
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = chatDraft.trim();
    if (!localParticipant || !body || body.length > 500) return;
    try {
      await localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ body })), {
        reliable: true,
        topic: "tgf-live-chat",
      });
      setChatMessages((previous) => [...previous.slice(-99), {
        id: `${localParticipant.identity}-${Date.now()}-${previous.length}`,
        participantId: localParticipant.identity,
        name: localParticipant.name || localParticipant.identity,
        body,
        sentAt: new Date().toISOString(),
      }]);
      setChatDraft("");
      setError("");
    } catch {
      setError("Your message could not be sent. Please try again.");
    }
  }

  async function setStudentMicrophone(userId: string, allowMicrophone: boolean) {
    if (!info) return;
    try {
      const response = await fetch(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/microphone`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, allowMicrophone }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Microphone settings could not be changed.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Microphone settings could not be changed.");
    }
  }

  async function setAllStudentMicrophones(allowMicrophone: boolean) {
    await setStudentMicrophone("all", allowMicrophone);
  }

  async function endLesson() {
    if (!info || !isTutor || ending ||
        !window.confirm("End this lesson for everyone? The recording will be finalized after the class ends.")) return;
    setEnding(true);
    try {
      const response = await fetch(`/api/collaboration/sessions/${encodeURIComponent(info.sessionId)}/end`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The lesson could not be ended.");
      await room?.disconnect();
      window.location.href = "/teacher#teacher-recordings";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The lesson could not be ended.");
      setEnding(false);
    }
  }

  async function leaveClass() {
    await room?.disconnect();
    window.location.href = isTutor ? "/teacher#teacher-recordings"
      : isAdministrator ? "/admin#admin-general-classes" : "/student#student-upcoming-classes";
  }

  return (
    <section className="livekit-room" aria-label="Live class">
      <header className="livekit-header">
        <div>
          <p className="eyebrow"><span /> TGFVP live classroom</p>
          <h1>{info?.programmeTitle || "Live class"}</h1>
          <p className="admin-intro">{joinDisplay}{info ? ` · Tutor: ${info.teacherName}` : ""}</p>
        </div>
        <div className="livekit-header-actions">
          {room && recordingConfirmed && <span className="livekit-recording-badge"><span /> Recording automatically</span>}
          {isTutor && room && !recordingConfirmed && <span className="livekit-recording-badge is-starting">Starting recording…</span>}
          {isTutor && room && recordingConfirmed && (
            <button className="button button-danger" type="button" onClick={() => void endLesson()} disabled={ending}>
              {ending ? "Ending lesson…" : "End lesson"}
            </button>
          )}
          <button className="button button-quiet" type="button" onClick={() => void leaveClass()}>Leave class</button>
        </div>
      </header>
      {status && <p className="admin-intro" role="status">{status}</p>}
      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {!room && info?.waitingForTeacher && (
        <div className="livekit-waiting-room" role="status">
          <span className="livekit-waiting-indicator" />
          <div>
            <strong>Waiting for your tutor</strong>
            <p>Your class will open here as soon as the tutor starts the lesson.</p>
          </div>
        </div>
      )}
      <div className="livekit-controls">
        <button className="button button-dark" type="button" onClick={() => void toggleMicrophone()} disabled={!room || busy || (isTutor && !recordingConfirmed)}>
          {micEnabled ? "Mute microphone" : "Turn on microphone"}
        </button>
        {isTutor
          ? <>
              <button className="button button-dark" type="button" onClick={() => void toggleCamera()} disabled={!room || busy || !recordingConfirmed}>
                {cameraEnabled ? "Turn camera off" : "Turn camera on"}
              </button>
              <button className="button button-dark" type="button" onClick={() => void toggleScreenShare()} disabled={!room || busy || !recordingConfirmed}>
                {screenShareEnabled ? "Stop sharing" : "Share screen"}
              </button>
            </>
          : <button className="button button-dark" type="button" onClick={() => void toggleRaisedHand()} disabled={!room}>
              {isHandRaised ? "Lower hand" : "Raise hand"}
            </button>}
        {isTutor && <>
          <button className="button button-quiet" type="button" onClick={() => void setAllStudentMicrophones(false)} disabled={!room || !recordingConfirmed}>
            Mute all students
          </button>
          <button className="button button-quiet" type="button" onClick={() => void setAllStudentMicrophones(true)} disabled={!room || !recordingConfirmed}>
            Allow all students to speak
          </button>
        </>}
      </div>
      <div className="livekit-layout">
        <div className="livekit-video-grid">
          {participants.map(({ participant, tracks }) => (
            <article className={speakers.includes(participant.identity) ? "livekit-participant is-speaking" : "livekit-participant"} key={participant.identity}>
              <div className="livekit-media">
                {tracks.map(({ key, track, video }) => (
                  <MediaTrack key={key} track={track} video={video} label={`${participant.name || participant.identity} video`} />
                ))}
                {!tracks.some((entry) => entry.video) && <span className="livekit-avatar">{(participant.name || participant.identity).slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="livekit-participant-label">
                {isTutor && !participant.isLocal
                  ? <button
                      className="livekit-participant-name"
                      type="button"
                      onClick={() => void setStudentMicrophone(participant.identity, !participant.isMicrophoneEnabled)}
                      title={participant.isMicrophoneEnabled ? "Mute this participant" : "Allow this participant to speak"}
                      disabled={!recordingConfirmed}
                    >
                      {participant.name || participant.identity}
                    </button>
                  : <strong>{participant.name || participant.identity}</strong>}
                <span className="livekit-mic-state">
                  {participant.isMicrophoneEnabled ? "Microphone on" : "Microphone muted"}
                </span>
                {speakers.includes(participant.identity) && <span>Speaking</span>}
                {raisedHands.has(participant.identity) && <span>Hand raised</span>}
              </div>
            </article>
          ))}
        </div>
        <aside className="livekit-roster" aria-label="Class attendance">
          <h2>In class <span>{participants.length}</span></h2>
          <ul>
            {participants.map(({ participant }) => (
              <li key={participant.identity}>
                <span>{participant.name || participant.identity}</span>
                <small>{participant.isMicrophoneEnabled ? "Mic on" : "Muted"}</small>
                {raisedHands.has(participant.identity) && <strong> · Hand raised</strong>}
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <section className="livekit-chat" aria-label="Class chat">
        <header>
          <h2>Class chat</h2>
          <p>Messages are visible to everyone in this live class.</p>
        </header>
        <div className="livekit-chat-messages" role="log" aria-live="polite">
          {chatMessages.length === 0 && <p className="livekit-chat-empty">No messages yet. Send a message to get started.</p>}
          {chatMessages.map((message) => (
            <article
              className={message.participantId === localParticipant?.identity ? "livekit-chat-message is-mine" : "livekit-chat-message"}
              key={message.id}
            >
              <div><strong>{message.name}</strong><time dateTime={message.sentAt}>
                {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.sentAt))}
              </time></div>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
        <form className="livekit-chat-form" onSubmit={(event) => void sendChatMessage(event)}>
          <label className="sr-only" htmlFor="live-class-chat-message">Write a message</label>
          <input
            id="live-class-chat-message"
            type="text"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="Write a message…"
            maxLength={500}
            disabled={!room}
          />
          <button className="button button-dark" type="submit" disabled={!room || !chatDraft.trim()}>Send</button>
        </form>
      </section>
    </section>
  );
}

export default LiveClassRoom;
