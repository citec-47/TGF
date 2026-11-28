# Live-Class Architecture Audit

## Tech stack

- Next.js 16, React 19, TypeScript 7, Node 20+
- PostgreSQL for class state, attendance, chat, and recording metadata
- Browser-to-browser WebRTC for live audio and video
- Authenticated database-backed API signaling with STUN and optional TURN
- Cloudinary private storage with server-issued recording signatures
- Tutor-side MediaRecorder, canvas/Web Audio composition, and IndexedDB queue
- Service worker Background Sync with page-level retry fallback

## Live-class files

- `app/live-class/page.tsx`, `classroom-client.tsx`, and `room.tsx` render the
  waiting room, recording lifecycle, upload queue, and classroom controls.
- `app/live-class/media-room.tsx` captures devices, exchanges peer signals,
  publishes/subscribes tracks, renders participants, and composes recording media.
- `app/live-class/recording-queue.ts` persists chunks and resumable upload state.
- `public/live-class-recording-sw.js` processes queued uploads with Background Sync.
- `server/collaboration.ts` implements join, start, end, cancel, attendance,
  chat, peer signaling, and recording routes.
- `server/live-session-validation.js` owns status transitions and join authorization.
- `server/live-session-attendance.js` stores and lists student attendance.
- `docs/LIVE_CLASS_SETUP.md` documents relay and recording configuration.

## Lifecycle

Scheduled classes are created from timetable slots or instant class invitations.
The tutor or an enrolled student joins through a server authorization endpoint.
The server creates or returns the stored random room name and the tutor/student
role. The tutor starts the class, changing scheduled to live. Students already
waiting receive the live status event or the polling/SSE fallback and join.
The tutor or an administrator can cancel a scheduled or live class. A live class
is changed to ended by the tutor. Browser peers exchange offers, answers, and ICE
candidates through authenticated API requests; media then flows peer-to-peer.

## Authorization

- Only the assigned tutor can start or end.
- Assigned tutors and administrators can cancel.
- Enrolled active learners can join live classes.
- Administrators cannot join live media rooms.
- Students may publish microphone audio when enabled by the tutor; the tutor can
  control student microphones.

## Recording

When the tutor starts a class, the browser automatically records the composed
participant video and available audio. MediaRecorder emits five-second chunks
that are committed to IndexedDB. At class end, the tutor's browser uploads the
recording directly to Cloudinary in resumable byte ranges, then asks the server
to verify and publish it. The local queue is cleared only after server
confirmation. Pending uploads retry on reconnect, on a periodic page timer, or
through Background Sync where supported. See `LIVE_CLASS_SETUP.md` for browser
and storage requirements.

## Removed architecture

Jitsi, mediasoup, Socket.IO, LiveKit, and the standalone SFU are not part of the
active path. STUN helps peers discover network routes; a separately provisioned
TURN relay is required for reliable calls across networks that block direct
peer-to-peer traffic. Deployments must keep relay credentials in the server
environment.
