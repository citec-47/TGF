# Live-Class Architecture Audit

## Phase 1 scope

This is a source-level audit of the existing live-class feature for the planned
Jitsi JaaS and tutor-browser recording rebuild. No feature code was changed.
The requested branch is `refactor/live-classes-jitsi`, based on `27a1e64`.
The only intended Phase 1 deliverable is this report; no `.env` file or secret
was inspected.

This audit did not run a real tutor/student class. End-to-end behavior across
separate devices and networks remains unverified and belongs in Phase 5.

## Structure and current stack

The repository is a Next.js 16 / React 19 / TypeScript 7 application on Node
20+, with PostgreSQL migrations and a mixture of Next route handlers and
dashboard markup loaded from `data/pages/`. The public tutor, student, and
admin dashboards load `public/collaboration.js`; the live-class page is a
React client.

The **active video stack is mediasoup plus Socket.IO**, not Jitsi or LiveKit:

- The active page is `app/live-class/page.tsx` → `classroom-client.tsx` →
  `room.tsx`; the client imports `mediasoup-client` and `socket.io-client`.
- `server/live-class-sfu.js` owns mediasoup workers, Socket.IO signaling,
  in-memory room state, participant presence, media permissions, and
  signaling. It uses `/live-class/socket.io`.
- The SFU can be attached to the custom Next Node server
  (`server/custom-server.mjs`) or run separately
  (`server/live-class-sfu-server.mjs`).
- `app/live-class/livekit-room.tsx` and `livekit-client` are legacy/unused by
  the active route. `server/livekit.js` and `livekit-server-sdk` remain for
  legacy LiveKit recording/webhook handling. Current join responses say
  `transport: "mediasoup"` and issue a mediasoup socket ticket.
- Cloudinary is used for private recording assets. Current recordings are
  recorded in the tutor's browser, queued in IndexedDB, sent to the app server,
  assembled on the server filesystem, then uploaded to Cloudinary.
- **There is no Jitsi/JaaS dependency, Jitsi integration, or `JITSI_*`
  configuration in the repository.**

## File inventory

### Active classroom and dashboard UI

- `app/live-class/page.tsx`, `app/live-class/classroom-client.tsx`,
  `app/live-class/room.tsx` — page entry, dynamic client loading, and active
  classroom UI/media client.
- `app/live-class/recording-queue.ts` — IndexedDB queue for chunks and
  per-session upload/finalization metadata.
- `app/live-class/livekit-room.tsx` — legacy LiveKit UI; not imported by the
  active classroom route.
- `app/teacher/page.tsx`, `app/student/page.tsx`, `app/admin/page.tsx` — load
  the respective `data/pages/*.html` content and include
  `public/collaboration.js`.
- `data/pages/teacher.html`, `data/pages/student.html`, `data/pages/admin.html`
  — dashboard live-class, attendance, and recording containers/actions.
- `public/collaboration.js` — schedule and instant-class cards, join links,
  attendance/recording lists, notifications, and recording playback.
- `public/admin.js`, `public/language.js`, `admin.css` — mediasoup status
  panel/text and classroom/dashboard styling.

### API, authorization, real-time, and persistence

- `app/api/[...path]/route.ts` — Node API catch-all, session-account access,
  migration initialization, and dispatch to the collaboration handler.
- `server/collaboration.ts` — collaboration endpoints for schedules, class
  creation/join/start/end, attendance, chat, microphone controls, recordings,
  playback, and legacy LiveKit webhooks.
- `server/live-class-auth.js` — signed 120-second, session-scoped Socket.IO
  tickets and active-user lookup.
- `server/live-class-validation.js` — mediasoup port, ICE/TURN, origin,
  capacity, and authorization configuration.
- `server/live-session-validation.js` — scheduled join-window and role checks.
- `server/live-session-attendance.js` — learner attendance upsert, leave-time
  accounting, and attendee listing.
- `server/live-session-chat.js`, `lib/live-class-events.js` — chat validation
  and real-time event topics.
- `server/live-class-sfu.js`, `server/custom-server.mjs`,
  `server/live-class-sfu-server.mjs` — active Socket.IO/mediasoup server and
  entrypoints.

### Recording, deployment, tests, and schema

- `server/live-recording-storage.js` — local chunk storage and part assembly.
- `server/recording-trash.js` — Cloudinary private asset deletion and retention.
- `server/livekit.js` — legacy LiveKit tokens, egress, storage, and webhook
  helpers.
- `README.md`, `.env.example`, `docs/LIVE_CLASS_SFU_DEPLOYMENT.md`,
  `package.json`, `package-lock.json`, `scripts/migrate.js` — current setup,
  dependencies, configuration, deployment, and migrations.
- Live-class schema migrations:
  `014_live_class_deletion_columns.sql`,
  `018_timetables_chat_and_live_classes.sql`,
  `025_live_recording_jobs.sql`,
  `026_weeklong_live_sessions_and_preferences.sql`,
  `030_live_class_groups.sql`,
  `031_browser_live_recording.sql`,
  `032_mediasoup_live_classes.sql`,
  `034_live_recording_admin_dismissal.sql`,
  `035_live_recording_chunk_queue.sql`,
  `039_live_recording_trash.sql`,
  `040_livekit_recordings.sql`,
  `041_live_session_chat.sql`,
  `042_live_class_microphone_permissions.sql`.
- Existing focused tests:
  `server/live-class-auth.test.js`,
  `server/live-class-validation.test.js`,
  `server/live-session-validation.test.js`,
  `server/live-session-attendance.test.js`,
  `server/live-session-chat.test.js`,
  `server/live-recording-storage.test.js`,
  `server/livekit.test.js`,
  `server/recording-trash.test.js`,
  `server/collaboration-validation.test.js`.
  There is no browser-level Jitsi or full tutor/student network integration
  test in the current test scripts.

## Current lifecycle and access rules

1. **Scheduled classes:** approved tutor timetables and slots are stored in
   `tgf_course_timetables` / `tgf_course_timetable_slots`. A join request opens
   15 minutes before the slot and creates or reuses the date-specific
   `tgf_live_sessions` row. Students can wait in the room before the tutor
   starts.
2. **Instant classes:** a tutor creates a group session. The server snapshots
   eligible group members into `tgf_live_session_invites` and creates
   notifications. The session and a random `tgf-live-{UUID}` room name are
   persisted before the tutor navigates to the classroom.
3. **Join/auth:** the collaboration API uses the existing signed account
   session and rejects inactive users. The assigned tutor is checked against
   the session; learners must have approved enrollment. The API returns the
   session UUID, role, current start state, room name, and a short-lived,
   session-scoped Socket.IO ticket. The SFU independently validates that
   ticket, rechecks the account/session/role/enrollment, and rejects ended
   classes.
4. **Presence/state:** the browser registers Socket.IO event handlers before
   emitting `live-class:join`. The SFU joins the session UUID room and returns
   an acknowledgement snapshot containing started state, participants,
   attendees, current producers, chat history, and media capabilities. It then
   emits presence/attendance changes. Reconnect repeats the join and obtains a
   fresh snapshot. The database session UUID is the Socket.IO room key; the
   separate stored `room_name` is not used as the mediasoup socket room key.
5. **Start/end:** only the assigned tutor can call the HTTP start/end
   endpoints. Start sets `started_at`; the tutor then emits
   `live-class:start`, which broadcasts to waiting participants. End sets
   `ended_at`, closes active attendance intervals, and broadcasts
   `live-class:end`/`live-class:ended`. The status is derived from timestamps;
   there is no explicit `scheduled | live | ended | cancelled` state column.
6. **Media:** clients establish mediasoup WebRTC send/receive transports over
   Socket.IO signaling. Camera, microphone, and screen share are published as
   mediasoup producers. The classroom renders a tutor/content stage and
   participant tiles. Learners start without server microphone permission;
   tutor/admin controls update permission in PostgreSQL and the SFU checks it
   before allowing a learner's microphone producer.
7. **Attendance/chat:** learner join/leave is recorded in
   `tgf_live_session_attendance`; live participant and attendance snapshots are
   broadcast. Chat is saved in PostgreSQL and broadcast only after server-side
   validation. Profile-photo fields are read with `to_jsonb(...)` fallbacks so
   deployments missing the optional column do not fail the chat query.
8. **Recording:** the tutor's browser uses `MediaRecorder` on a canvas stream
   and Web Audio. Five-second chunks are written to IndexedDB and uploaded to
   the app server while recording. At end, the server groups chunks into parts
   (default 15 minutes via `RECORDING_PART_MINUTES`), concatenates them on its
   local filesystem, and uploads each part to private Cloudinary storage using
   server credentials and a 5 MB Cloudinary chunk size. Playback checks tutor
   or enrolled-student access and serves authenticated video/part endpoints.
   The dashboard plays ready parts in order.

## Findings and known gaps

| Finding | Evidence and impact |
|---|---|
| Current implementation is not Jitsi. | Active route imports mediasoup; join APIs return `transport: "mediasoup"`; package/config/README are mediasoup-oriented. The LiveKit UI is not wired to the active route. The requested rebuild therefore has not started yet. |
| Production mediasoup requires a separate persistent media service. | The custom server creates mediasoup workers and opens RTP ports; the standalone SFU has its own process/health endpoint. README and `docs/LIVE_CLASS_SFU_DEPLOYMENT.md` explicitly state serverless Vercel cannot host the SFU. The supplied production browser trace showed `wss://www.transgenerationalforces.com/live-class/socket.io` receiving HTTP 308 during the WebSocket handshake, which is not a valid Socket.IO upgrade response. This trace is historical user-provided evidence, not a fresh production retest. Commit `27a1e64` adds a fail-fast guard against missing/same-origin SFU configuration; deployment status is not verified here. |
| TURN is optional, so cross-network media is not guaranteed. | `STUN_URL` defaults to Google STUN; TURN is added only when all three TURN settings exist. Validation does not require TURN in production. STUN-only paths can fail behind restrictive NAT/firewalls, consistent with the README warning. |
| Recording capture differs from the requested tab-capture design. | The active recording uses `canvas.captureStream(20)` and one `mediaVideoRef` source, plus tutor microphone and consumed remote audio. `getDisplayMedia()` is used by the separate screen-share control, not as the recording's required tab/audio capture flow. The recording canvas does not compose all participant video tiles. |
| Crash recovery is incomplete after a class ends. | IndexedDB persists chunks, but `restoreRecordingQueue()` is called from `startAutomaticRecording()`, which requires a successful class join/start. Ended sessions are rejected by join endpoints, and the dashboard says failed uploads can be retried while the classroom page remains open. There is no `beforeunload` recording warning or dashboard recovery entry point. Thus the current source does not establish that a tutor can reopen an ended class and resume queued uploads. |
| The current browser-recording upload path differs from the requested Cloudinary flow. | Active client calls `recording-chunk` and `recording-finalize`; the server stores local files and uploads them to Cloudinary after end. A signed-upload endpoint exists but is not used by the active room. Uploads are server-side, not direct browser chunked uploads, and current parts default to 15 minutes. |
| Session state and attendance schema are narrower than the requested model. | `tgf_live_sessions` has `started_at`/`ended_at`, not a lifecycle enum or cancelled state. `markLiveSessionParticipantJoined()` inserts `participant_role = 'learner'`; tutor joins are not inserted into this attendance table. Existing rows do preserve user/session IDs and timestamps for learners. |
| Generic API errors obscure some root causes. | The collaboration catch block logs a server error code but returns the generic “classroom service is temporarily unavailable” response for session routes. Database migration, configuration, and other internal errors therefore look alike to users. |
| The room state is process-local. | SFU rooms/participants are held in in-memory `Map`s in `server/live-class-sfu.js`; no cross-process Socket.IO adapter or shared SFU room state is configured. The documented single persistent SFU process is the supported topology. |
| Some existing permissions and UI requirements need a design pass. | Tutor ownership and approved enrollment are checked server-side; the server enforces default learner microphone denial and exposes mute controls. Current UI already has a stage/tiles and raise-hand state, but no evidence of active-speaker detection or tile virtualization. Instant-class invitations are group-scoped, while the join check is course-enrollment based rather than checking membership in the invite table. |

## Recent relevant history

- `27a1e64` — fail fast without a dedicated SFU origin.
- `8943881` — separate SFU configuration and chat profile-column fallback.
- `fc22c5d` — LiveKit reconnect/slow-network recovery (legacy implementation).
- `a13cd90` — earlier LiveKit classroom implementation.

This history shows the active implementation moved through LiveKit and was
restored to mediasoup; the current branch starts after the mediasoup production
configuration changes. The class media architecture in this audit is based on
the current checked-out source, not assumptions from those older commits.

## Anticipated implementation scope (not started)

Pending approval, the likely live-class-only change set is:

- Replace the active mediasoup classroom client and signaling with a Jitsi
  JaaS iframe integration; add a server-only JaaS token helper and
  tutor/student-authorized join-token endpoint.
- Adapt the collaboration session start/end/join routes and additive database
  migration(s) for explicit lifecycle state, unique room identity, recording
  metadata, and the required authorization/persistence behavior.
- Replace the current chunk-to-server recording flow with tutor-browser
  display/tab capture, microphone/audio mixing, IndexedDB recovery, signed
  Cloudinary uploads, recording metadata, and authorized replay.
- Remove active mediasoup server/configuration/dependencies and retire its
  deployment documentation/status UI. Keep historical migrations and legacy
  recording data readable; do not delete migration history.
- Update only the directly related classroom, dashboard class/recording UI,
  styles, `.env.example`, README/setup docs, and focused live-class tests.

Expected files for that work include `app/live-class/*`,
`server/collaboration.ts`, the live-class auth/validation/SFU/recording modules,
`app/api/[...path]/route.ts` only where collaboration dispatch needs changes,
`server/custom-server.mjs`, relevant dashboard assets under `data/pages/` and
`public/`, `admin.css`, `db/migrations/` (new additive migration),
`package.json`/`package-lock.json`, `.env.example`, README/docs, and existing
live-class tests. Authentication, users, courses, payments, and unrelated
pages are out of scope. The exact edit list should be finalized before Phase 2;
no implementation changes have been made in those files.

## Phase 1 outcome

The repository currently runs mediasoup/Socket.IO for live media, with legacy
LiveKit recording code and a separate browser-to-server-to-Cloudinary recording
pipeline. The main production dependency is a persistent, reachable SFU host;
the provided 308 trace is consistent with the site URL being used as the
WebSocket endpoint. The Jitsi/JaaS and direct browser-to-Cloudinary design
requires the Phase 2+ changes listed above.

No end-to-end live-class, Jitsi, Cloudinary upload, or browser recovery test was
performed in this audit. Phase 5 must verify those behaviors with real tutor
and student accounts and separate devices/networks before any production push.
