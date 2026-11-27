# Transgenerational Forces Group

The Next.js App Router application for the Transgenerational Forces Group
corporate website and its TGF Vocational Pathways learning platform. The
corporate homepage presents the group, subsidiaries, CSR programmes, news,
team, careers, community registration and contact form. The learning platform
continues at `/csr/tgf-vocational-pathways`, with student and teacher
workspaces and administrator controls.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and set private PostgreSQL, administrator,
   session and Cloudinary credentials. Never commit `.env`.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000` for the public site, `/student` to register or
   access student courses, `/teacher` for the teacher studio, `/portal` for
   staff account settings, or `/admin` for administrator controls.
5. To deploy, run `npm run build` and `npm start`. Configure the same secrets in
   your production hosting provider and set `NODE_ENV=production`.

The server applies all numbered SQL migrations on startup. The initial
migration seeds Bamenda, Yaounde, Douala and Buea. Administrators can add, edit,
reorder, hide, delete or add photos to locations; create team accounts; assign
organizational roles and subsidiaries; freeze, restore, reset or delete
accounts; publish board profiles by hierarchy; update the public flyer, accent
colour and training resumption date; edit the corporate homepage's company,
subsidiary, CSR, programme, newsroom, vacancy, community and contact content;
and manage programmes and module releases. Corporate content is published from
the administrator's Corporate content dashboard section. Team biographies and
photos use Board profiles; career applications, CVs, community registrations
and contact enquiries use Website submissions.
Students self-register, enroll in available programmes, and unlock released
modules in order by completing the preceding modules. Teachers can schedule
classes for their assigned modules and draw on a persisted, shared classroom
whiteboard. Class meeting URLs are supplied by administrators or teachers and
open in the configured external meeting service; embedded video conferencing
is not included.
Learner registration collects an international-format WhatsApp number. Once an
administrator approves an account, learners can sign in with their existing
email and password. Administrators can click the number in the account list to
open a prefilled WhatsApp approval message and press Send.

`.env` is excluded from Git. Keep it private and configure the same environment
variables in your production hosting provider before deployment. The
dashboards use signed, HTTP-only, twelve-hour session cookies. User sessions
check the account status against PostgreSQL, so frozen or deleted accounts lose
access. Temporary passwords must be changed at first sign-in. Student
registration grants learner access only; teaching and administrative access
must be assigned by an administrator. Photo uploads are signed server-side;
the Cloudinary secret is never sent to the browser. Whiteboard contents and
learner module completion are checked and saved server-side.

The supplied programme flyer and TGF Group organizational chart are stored in
`public/TWO/`. The public website uses the supplied company, TGFEA and TGFVP
reference materials; it does not invent missing contact details, staff
profiles, vacancy listings or subsidiary URLs. Corporate career applications,
community registrations and contact enquiries are stored in PostgreSQL and
reviewed from the administrator's Website submissions inbox. Career CVs are
stored as authenticated Cloudinary assets and can only be downloaded by an
authorized administrator. Deleting a career application also removes its CV.
Newsletter preferences are recorded, but automated newsletters and email
receipts are not configured.
Corporate homepage content is validated and stored in PostgreSQL. The public
site can read published content without signing in, but only administrators can
publish it. Unverified subsidiary websites and corporate contact details remain
unpublished until confirmed.

## Collaboration, timetables and live classes

The collaboration features add course-scoped student/tutor conversations,
private file attachments, browser voice notes, tutor-submitted weekly
Monday–Friday schedules, administrator timetable review, student timetable and
attendance views, notifications, and course-scoped class recordings. Database
migrations `018_timetables_chat_and_live_classes.sql` and
`019_course_scoped_learning_materials.sql`, plus `021_material_ai_week_plans.sql`
and `022_material_ai_curriculums.sql`, are applied by the existing startup
migration runner. For a pending PDF or DOCX, an administrator chooses 1 to 8
modules and reviews the platform-arranged draft before approval. The platform
extracts source text and distributes it in order across exactly four weekly
blocks per module, with five study days in each week and PDF page references
where available. If a recognized PDF or DOCX cannot yield readable text, it
creates a clearly flagged page/day schedule for administrator verification
instead of reporting a false content extraction success. Each module's capstone
is placed at the end of Week 4. Drafts remain private until approved. This
document-arrangement workflow does not use OpenAI. Teacher-submitted PDF, DOC
and DOCX curriculum drafts use the OpenAI Responses API; configure
`OPENAI_API_KEY` in `.env` and optionally set `OPENAI_MODEL` (defaults to
`gpt-4o-mini`) for that workflow. Teacher-submitted MP4, MOV and WebM courses
are analyzed as video with Gemini; configure `GEMINI_API_KEY` and optionally
set `GEMINI_MODEL` (defaults to `gemini-2.5-flash`). Videos can be up to 100 MB,
while documents remain limited to 10 MB. The admin receives the detected video
duration and a one-module-per-hour recommendation, capped at eight modules;
the module count can be changed before generating a draft. Video drafts retain
the same four weeks per module, five study days per week and capstone review.
Other supplementary materials are assigned to
a module and weekly block by the administrator before approval. Teachers can
expand each approved module to review its four-week, five-day outline and open
the assigned source pages. Enrolled learners see the same daily outline within
their released modules, with links that open the original PDF at the assigned
page, a daily answer form for questions and activities, and the module
capstone at the end of Week 4. Daily answers are submitted to the assigned
teacher for approval or feedback; this review does not change module access.

## Self-hosted mediasoup live classes and private recordings

Live audio/video is provided by the repository's self-hosted mediasoup SFU,
with Socket.IO signaling at `/live-class/socket.io`. A class's database session
UUID is the room key used by both the HTTP join endpoint and the SFU. The server
authorizes the assigned tutor, administrators, and active students with
approved course enrollment. Students connect and register attendance while
waiting for the tutor; the join acknowledgment includes the current class,
participant, attendance, and chat state before live updates are delivered.

The classroom puts the tutor or shared content on the main stage and participant
tiles alongside it. Students start muted, and the server checks microphone
permission before accepting audio. Tutor/admin mute controls update the
permission in the attendance record and are retained across refreshes and
reconnects. Camera or recording failure does not block joining or starting a
class. The classroom supports audio-only mode and displays connection state.

Class chat is stored in PostgreSQL and delivered to connected room participants
after the server verifies the saved message. Sender name, role, profile photo,
email, and timestamp come from the sender's account and saved message, not
client-supplied identity. Student email addresses are visible only to the
sender, tutor, and administrators by default. Set
`LIVE_CLASS_CHAT_SHOW_STUDENT_EMAILS=true` only if you explicitly want all
participants to see every sender's email.

The tutor's browser records the class in short chunks and uploads them to
private Cloudinary storage when configured. Recording failure does not prevent
the lesson from starting; a recording is marked ready only after the server
verifies the private uploaded asset. Playback uses authenticated server
endpoints that recheck role and enrollment. Legacy LiveKit recording records
and webhook handling remain for already archived sessions only; new classes do
not require LiveKit credentials or LiveKit Cloud.

### SFU, network, and storage setup

1. Run the application on its persistent custom Node server with
   `npm run dev` or the production `npm start` command. The server initializes
   mediasoup before accepting requests; a startup failure is surfaced rather
   than reporting the SFU as ready.
2. Set `MEDIASOUP_MIN_PORT` and `MEDIASOUP_MAX_PORT` to the desired RTP port
   range (defaults `40000`–`49999`), and allow that range through the host
   firewall and network security group over UDP and TCP. Set
   `MEDIASOUP_LISTEN_IP=0.0.0.0`; in production set
   `MEDIASOUP_ANNOUNCED_IP` to the server's reachable public IP. HTTPS is
   required for browser camera/microphone access.
3. STUN defaults to `stun:stun.l.google.com:19302`. For restrictive NATs and
   cross-network reliability, configure a TURN service with all three of
   `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`; partial TURN settings
   are rejected. STUN alone cannot guarantee connectivity through every
   firewall. Set `LIVE_CLASS_DEBUG=true` temporarily to log join, leave,
   transport, ICE, DTLS, and media signaling events; leave it false in normal
   production operation. Class capacity is capped at 16 students.
4. Configure private Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`) for browser recordings.
   The class can still run if recording is unavailable. The optional
   `LIVE_RECORDING_S3_*` variables support legacy LiveKit recording playback;
   they are not required for new mediasoup rooms.
5. To deliver recording-ready emails, configure `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`; set `APP_BASE_URL`
   to the public HTTPS origin. In-app notifications work independently.
6. Run `npm run db:migrate` with the server-side `DATABASE_URL` to apply all
   pending database migrations, including the live-class attendance,
   microphone-permission, chat, and legacy recording migrations. Keep
   `DATABASE_URL`, `SESSION_SECRET`, TURN credentials, and Cloudinary secrets
   server-side. Do not add them to `NEXT_PUBLIC_*`, source files, or Git.

The `.vercel` project metadata does not establish that the production host
supports a persistent Node process or mediasoup's RTP port range. Confirm the
deployment host, firewall, public announced IP, and TURN reachability before
releasing live classes; a static/serverless deployment cannot host this SFU.

### Manual live-class verification

1. Sign in as the assigned tutor, open an assigned course class, and start it.
   Confirm the class starts even if recording is unavailable.
2. Join from two separate browsers as active students with approved enrollment.
   Confirm the tutor is large and both student faces appear in the side strip.
3. Try the same join link as a student without approved enrollment; the server
   must reject the request.
4. Confirm students join muted and cannot publish microphone audio until the
   tutor or administrator allows it. Test per-student and all-student mute
   controls, camera off/on, camera-permission denial, reconnecting after a
   temporary network loss, audio-only mode, and Leave class.
5. End the class as the tutor. Confirm all participants are disconnected and,
   when recording is configured, the private recording is verified and marked
   ready.
6. Verify that approved students, the assigned tutor, and administrators can
   play the recording, and that an unrelated account cannot. Confirm the
   bucket remains private and email/in-app notifications are delivered.
