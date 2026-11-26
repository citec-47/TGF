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

## Managed live classes and private recordings

Live classes use LiveKit Cloud for managed WebRTC rooms and optional Egress
recordings. The responsive React classroom puts the tutor or tutor screen share
on the main stage and participants in a paginated side strip. PostgreSQL-backed
server checks issue room-scoped tokens only to the assigned tutor, active
administrators, and students with an approved course enrollment. Students can
join the room while waiting for the tutor; the client rechecks current class
state after subscribing to room events so a missed start event does not strand
them in the waiting room. The room reports connecting, connected, reconnecting,
waiting and failed states.

Students join with camera permission but no microphone-publish permission.
Only the assigned tutor or an administrator can enable or revoke a student's
microphone through a server-authorized LiveKit permission update. The setting
is persisted with session attendance and applied to subsequent joins.
Participant and attendance changes are refreshed in real time. Learner camera
video starts at low resolution, and the classroom supports manual audio-only
mode and switches off local video when LiveKit reports a poor connection.
Camera or video failure does not block audio participation.

Class chat is persisted per session, authorized using the same course
enrollment, and delivered through reliable LiveKit room data; messages load
from the server after joining or refreshing.

Chat sender names, role and profile photo are read from the account record.
Student email addresses are visible only to the sender, tutor and
administrators by default. Set `LIVE_CLASS_CHAT_SHOW_STUDENT_EMAILS=true` in
the server environment only if you explicitly want every participant to see
all sender emails.

The tutor starts and ends the session in the classroom. When Egress and private
object storage are configured, LiveKit records the room to an S3-compatible
bucket (Cloudflare R2 is the recommended low-cost option). Recording failure
does not prevent the live lesson from starting. The app only marks a recording
ready after Egress completes and the server verifies the MP4 exists. Playback
streams through an authenticated server endpoint that rechecks the viewer's
role/enrollment; the bucket must not be made public. Enrolled students, the
assigned tutor, and administrators receive in-app notifications and, when
SMTP is configured, recording-ready emails.

### Provider and storage setup

1. Create a LiveKit Cloud account and project. LiveKit currently lists a $0
   Build plan; real-time media and recording/export usage is metered by time
   and data transfer, so check project quotas and current rates before
   production use. This app does not use LiveKit's agent or inference products.
   See [LiveKit Cloud pricing](https://livekit.com/pricing) and
   [LiveKit billing details](https://docs.livekit.io/deploy/admin/billing/).
2. From the project settings, copy its WebSocket URL, API key, and API secret.
   Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `.env` and
   in the production server's secret manager. Use `wss://` in production.
3. Create a **private** Cloudflare R2 bucket and an S3-compatible key with
   object read/write access for that bucket. Set `LIVE_RECORDING_S3_BUCKET`,
   `LIVE_RECORDING_S3_REGION=auto`,
   `LIVE_RECORDING_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
   `LIVE_RECORDING_S3_ACCESS_KEY`, and `LIVE_RECORDING_S3_SECRET`. Keep bucket
   public access disabled. R2 Standard currently includes 10 GB-month storage,
   1 million Class A requests, and 10 million Class B requests monthly; beyond
   that, storage and request charges apply, with no egress bandwidth charge.
   See [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).
   `LIVE_RECORDING_S3_PREFIX` is optional and defaults to `tgfvp/live-classes`.
   AWS S3 can be used instead by setting its bucket, region, HTTPS endpoint,
   and credentials.
4. In LiveKit Cloud project settings, add the webhook URL
   `https://<your-domain>/api/collaboration/livekit/webhook`. The endpoint
   verifies LiveKit's signature with the project API credentials and consumes
   Egress completion events. Do not expose this endpoint through a proxy that
   changes the request body or authorization header.
5. To deliver emails, configure the existing `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` variables. Set
   `APP_BASE_URL` to the public HTTPS origin so the email link points to the
   deployed site. In-app notifications work independently; incomplete SMTP
   configuration is logged by the server.
6. Run `npm run db:migrate` against the production `DATABASE_URL` to apply
   migration `040_livekit_recordings.sql` and any other pending migrations,
   including `041_live_session_chat.sql` and
   `042_live_class_microphone_permissions.sql`, then restart the Node server.
   Keep `DATABASE_URL`, `SESSION_SECRET`, and all provider credentials
   server-side. Do not add them to `NEXT_PUBLIC_*`, source files, or Git.

LiveKit Cloud replaces the custom mediasoup SFU and browser-side chunk
recording, so the app server no longer needs the mediasoup UDP port range or a
self-hosted TURN service for classes. The site still runs as the existing
Next.js App Router application on its custom persistent Node server; configure
that server with the environment variables above. The `.vercel` project
metadata in this repository does not establish that the current production
host runs the custom server, so confirm the live deployment target before
releasing the feature.

### Manual live-class verification

1. Sign in as the assigned tutor, open an assigned course class, and start it.
   Confirm the class starts even if recording is unavailable; when Egress is
   configured, confirm the recording badge appears.
2. Join from two separate browsers as active students with approved enrollment.
   Confirm the tutor is large and both student faces appear in the side strip.
3. Try the same join link as a student without approved enrollment; the server
   must reject the request.
4. Confirm students join muted and cannot publish microphone audio until the
   tutor or administrator allows it. Test per-student and all-student mute
   controls, camera off/on, camera-permission denial, reconnecting after a
   temporary network loss, audio-only mode, and Leave class.
5. End the class as the tutor. Confirm all participants are disconnected and,
   when recording is configured, the recording changes from processing to ready
   after the Egress webhook.
6. Verify that approved students, the assigned tutor, and administrators can
   play the recording, and that an unrelated account cannot. Confirm the
   bucket remains private and email/in-app notifications are delivered.
