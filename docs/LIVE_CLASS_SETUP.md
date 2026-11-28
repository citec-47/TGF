# Live Class Setup

Live classes use browser-to-browser WebRTC for real-time video and audio.
Authenticated API endpoints exchange WebRTC signaling through the application's
database. The tutor's browser automatically records the composed class media,
stores five-second chunks in IndexedDB, and uploads the completed recording to
Cloudinary after the class ends. Uploads resume from the last confirmed byte.

## Local setup

```sh
npm ci
npm run db:migrate
npm run dev
```

Apply database migrations before opening classes. Use current Chrome or Edge
over HTTPS (localhost is normally a secure context). Participants must allow
camera and microphone access. Cameras start on by default, and each participant
can stop or restart their video independently of audio. Students start muted and
the tutor can control individual microphones or mute/unmute the class. Only the
tutor can share a screen. Peer-to-peer media sends streams to connected
participants, so network and device load increase with class size.

Set `STUN_URL` to a public STUN service to help peers discover reachable
addresses. Configure a real TURN relay for reliable calls between cellular,
mobile, and restricted networks. Set all three `TURN_URL`, `TURN_USERNAME`, and
`TURN_CREDENTIAL` values; `TURN_URL` accepts a comma-separated list. Without a
working relay, WebRTC may connect on one network but fail between a laptop and
phone on different networks. TURN credentials are sent only to authenticated
participants in a live class and must remain in the server environment.

## Browser recording

Recording starts automatically when the tutor starts the class; it does not
open a screen-sharing picker. The recording includes participant video tiles
and available microphone/remote audio. Five-second chunks are written to
IndexedDB as they are recorded. Ending or cancelling the class uses the same
finalization flow; local data is deleted only after Cloudinary and the
application server confirm success. Online events and a periodic page retry
cover browsers without Background Sync; supported browsers can continue queued
uploads through the service worker after the tab closes. Pending recordings
resume on the next classroom load in the same browser profile.

Configure the recording-storage credentials in the server environment:

```text
CLOUDINARY_CLOUD_NAME=<account-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Do not expose these values with `NEXT_PUBLIC_` prefixes. Recording requires a
secure context, camera/microphone permission, and browser support for
`MediaRecorder`, canvas capture, and Web Audio. Offline recording data uses
browser-managed IndexedDB quota, so long classes need sufficient local storage.
Background Sync support varies by browser; the page retry remains the fallback.

Set `NEXT_PUBLIC_LIVE_CLASS_DEBUG=true` only while diagnosing browser recording
and class-status issues; leave it `false` during normal operation.
