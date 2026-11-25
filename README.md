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

## Browser WebRTC live classes

Live classes use Socket.IO for signaling and mediasoup for the SFU. LiveKit and
other paid video providers are not used. Run `npm install`, copy `.env.example`
to `.env`, set `DATABASE_URL` and `SESSION_SECRET`, then run `npm run dev`.
The custom server starts Next.js, Socket.IO and mediasoup together on `PORT`
(default 3000). Mediasoup is configured for 9–16 students by default and
creates UDP/TCP WebRTC transports on `MEDIASOUP_MIN_PORT` through
`MEDIASOUP_MAX_PORT`.

Browser camera and microphone access requires HTTPS, except for `localhost`.
Deploy behind a reverse proxy with WebSocket upgrade support and open the
mediasoup UDP/TCP port range to the public internet. Set `MEDIASOUP_ANNOUNCED_IP`
to the server's public IPv4 or DNS address. Configure STUN and coturn TURN:

- STUN: set `STUN_URL=stun:stun.example.com:3478`.
- TURN: set `TURN_URL=turn:turn.example.com:3478`, `TURN_USERNAME`, and
  `TURN_CREDENTIAL`.
- Free/open-source coturn setup on Ubuntu: install coturn, enable it in
  `/etc/turnserver.conf`, set `listening-port=3478`, `fingerprint`,
  `realm=<your-domain>`, and one-time or long-term credentials, open UDP/TCP
  3478 and the configured TURN relay UDP range, and use `turns:<domain>:3478`
  with TLS in production.

SMTP can be configured with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ADMIN_EMAIL`, and `MAIL_BATCH_SIZE`.
`RECORDING_PART_MINUTES` defaults to 15. Cloudinary credentials remain
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

Teachers start and end the class from the live-class page. Students start muted
and can only unmute after the server verifies the teacher and updates the
student tile. Camera, screen sharing, raised-hand and chat controls use the
mediasoup/Socket.IO connection and the existing session cookie. The teacher's
browser records automatically and sends five-second chunks to the server while
the class is live. Unsent chunks are kept in IndexedDB and retried in order
when connectivity returns; chunk numbers make server retries idempotent.
Keep the live-class page open after ending a class if some chunks are still
queued so the platform can finish uploading them and finalize the recording.

The teacher's live-class page also shows a separate attendance history, so
students remain listed there after disconnecting. Attendance history is stored
from the time this feature is deployed; earlier joins cannot be reconstructed
if they were not previously recorded.

### Manual live-class test checklist

1. Sign in as a teacher and open an assigned class; verify the Start class button.
2. Join in two other browsers or devices as enrolled students on different networks.
3. Confirm the teacher occupies the main stage and camera-on students appear in
   their own video tiles; camera-off students should show their profile avatars.
4. Confirm each student joins muted and no tile shows speaking permission.
5. Click one student tile to unmute it, then click again to mute it.
6. Test Mute all and Unmute all.
7. Select Share screen, verify the main view changes, then Stop sharing.
8. Verify raised hands appear on student tiles.
9. End the class and verify every participant sees the class-ended state.
10. Temporarily disconnect the teacher's internet; verify chunks queue locally,
   then reconnect and confirm they upload before the recording is finalized.
