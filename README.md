# TGF Vocational Pathways

A Next.js App Router application for discovering TGF Vocational Pathways
programmes, current locations, admissions updates, subsidiaries, careers and
contact information. It includes a team portal and an administrator dashboard
for accounts, locations and public-site settings.

## Run locally

1. Rotate any database or Cloudinary credentials previously shared in chat
   before using them in production.
2. Install Node.js 20 or later.
3. A local `.env` has been created using the supplied PostgreSQL and Cloudinary
   credentials and independently generated admin/session secrets. Inspect it
   locally and replace or rotate the credentials as needed. `.env.example`
   shows the variable names; `.env` is ignored by Git and must never be committed.
4. Run `npm install`, then `npm run dev`.
5. Open `http://localhost:3000` for the public site, `/portal` for team
   sign-in, or `/admin` for the administrator dashboard.
6. To deploy, run `npm run build` and `npm start`. Configure the same secrets in
   your production hosting provider and set `NODE_ENV=production`.

The server applies all numbered SQL migrations on startup. The initial
migration seeds Bamenda, Yaounde, Douala and Buea. Administrators can add, edit,
reorder, hide, delete or add photos to locations; create team accounts; assign
organizational roles and subsidiaries; freeze, restore, reset or delete
accounts; and update the public flyer, accent colour and training resumption
date. Published locations and settings are read from PostgreSQL.

`.env` is excluded from Git. Keep it private and configure the same environment
variables in your production hosting provider before deployment. The
dashboards use signed, HTTP-only, twelve-hour session cookies. User sessions
check the account status against PostgreSQL, so frozen or deleted accounts lose
access. Temporary passwords must be changed at first sign-in. Photo uploads are
signed server-side; the Cloudinary secret is never sent to the browser.

The supplied programme flyer and TGF Group organizational chart are stored in
`public/TWO/` for the public website. The enquiry form opens
a prefilled WhatsApp message for review and sending; it does not store or
submit applicant data. The 2026 intake is shown as closed because the
application window on the flyer ended October 30, 2026.
