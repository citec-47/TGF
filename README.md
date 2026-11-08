# TGF Vocational Pathways

A Next.js App Router application for discovering TGF Vocational Pathways
programmes, current locations, admissions updates, subsidiaries, careers and
contact information. Visitors can meet the TGF Group leadership, register and
enroll in vocational programmes, study released modules, and attend scheduled
live classes. The platform includes student and teacher workspaces and an
administrator dashboard for the public site and learning operations.

## Run locally

1. Rotate any database or Cloudinary credentials previously shared in chat
   before using them in production.
2. Install Node.js 20 or later.
3. A local `.env` has been created using the supplied PostgreSQL and Cloudinary
   credentials and independently generated admin/session secrets. Inspect it
   locally and replace or rotate the credentials as needed. `.env.example`
   shows the variable names; `.env` is ignored by Git and must never be committed.
4. Run `npm install`, then `npm run dev`.
5. Open `http://localhost:3000` for the public site, `/student` to register or
   access student courses, `/teacher` for the teacher studio, `/portal` for
   staff account settings, or `/admin` for administrator controls.
6. To deploy, run `npm run build` and `npm start`. Configure the same secrets in
   your production hosting provider and set `NODE_ENV=production`.

The server applies all numbered SQL migrations on startup. The initial
migration seeds Bamenda, Yaounde, Douala and Buea. Administrators can add, edit,
reorder, hide, delete or add photos to locations; create team accounts; assign
organizational roles and subsidiaries; freeze, restore, reset or delete
accounts; publish board profiles by hierarchy; update the public flyer, accent
colour and training resumption date; and manage programmes and module releases.
Students self-register, enroll in available programmes, and unlock released
modules in order by completing the preceding modules. Teachers can schedule
classes for their assigned modules and draw on a persisted, shared classroom
whiteboard. Class meeting URLs are supplied by administrators or teachers and
open in the configured external meeting service; embedded video conferencing
is not included.

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
`public/TWO/` for the public website. The enquiry form opens
a prefilled WhatsApp message for review and sending; it does not store or
submit applicant data. The 2026 intake is shown as closed because the
application window on the flyer ended October 30, 2026.
