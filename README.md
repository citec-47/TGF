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

## Browser-recorded live classes

Live classes provide class status, attendance, and chat; they do not include a
remote video-conferencing service. The tutor's browser captures a selected tab
or screen and microphone using `getDisplayMedia` and `MediaRecorder`, saves
chunks in IndexedDB, then uploads the recording directly to Cloudinary using a
short-lived server signature. Cloudinary credentials remain server-only.

Run `npm run db:migrate` before starting classes. Configure
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the
server. Tutors should use current Chrome or Edge over HTTPS, choose "This tab",
and enable "Share tab audio" when prompted. Screen/tab recording depends on the
tutor's browser, device, and connection; tab-audio capture is not supported in
every browser. Cloudinary plan limits vary; see
https://cloudinary.com/pricing.

Set `NEXT_PUBLIC_LIVE_CLASS_DEBUG=true` temporarily for browser recording and
class-status logs. See [docs/LIVE_CLASS_SETUP.md](./docs/LIVE_CLASS_SETUP.md)
for setup and deployment.
