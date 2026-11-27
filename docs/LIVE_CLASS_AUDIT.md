# Live-Class Architecture Audit

## Tech stack

- Next.js 16, React 19, TypeScript 7, Node 20+
- PostgreSQL for class state, attendance, chat, and recording metadata
- Jitsi JaaS (8x8.vc) External API for live audio/video
- Server-issued RS256 JaaS JWTs for join authorization
- Cloudinary SDK for private recording storage/signatures
- Browser IndexedDB and MediaRecorder for tutor-side recording (migration in progress)

## Live-class files

- `app/live-class/page.tsx`, `classroom-client.tsx`, `room.tsx` render the
  waiting room and Jitsi iframe.
- `server/collaboration.ts` implements join, start, end, cancel, attendance,
  chat, and recording routes.
- `server/jitsi.js` signs JaaS join tokens.
- `server/live-session-validation.js` owns status transitions and join authorization.
- `server/live-session-attendance.js` stores and lists student attendance.
- `db/migrations/043_jitsi_live_class_states.sql` adds explicit class states.
- `docs/LIVE_CLASS_SETUP.md` documents JaaS and Cloudinary configuration.

## Lifecycle

Scheduled classes are created from timetable slots or instant class invitations.
The tutor or an enrolled student joins through a server authorization endpoint.
The server creates or returns the stored random room name and the tutor/student
role. The tutor starts the class, changing scheduled to live. Students already
waiting receive the live status event or the polling/SSE fallback and join.
The tutor or an administrator can cancel a scheduled or live class. A live class
is changed to ended by the tutor.

## Authorization

- Only the assigned tutor can start or end.
- Assigned tutors and administrators can cancel.
- Enrolled active learners can join live classes.
- Administrators cannot join Jitsi rooms.
- Students receive participant moderator=false tokens; tutors receive true.

## Recording

The active implementation is no longer mediasoup or LiveKit. Legacy database
recording fields and migrations remain for historical records, but no legacy
Socket.IO, SFU, LiveKit SDK, or LiveKit webhook code is used.

Tutor browser recording and direct Cloudinary multipart upload are still being
completed. The previous server-chunk upload implementation must not be treated
as production-ready for this rebuild until browser capture, IndexedDB recovery,
and signed direct upload are finished.

## Removed architecture

Mediasoup, Socket.IO, media RTP ports, TURN/STUN media configuration, the
standalone SFU process, LiveKit SDK usage, LiveKit webhooks, and the dedicated
SFU deployment procedure were removed from active application code. Jitsi JaaS
must provide signaling and media reliability.
