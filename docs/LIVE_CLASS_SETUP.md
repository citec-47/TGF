# Live Class Setup

Live classes use browser-to-browser WebRTC for real-time video, audio, and tutor
screen sharing. Authenticated API endpoints exchange WebRTC signaling through
the application's database, so no dedicated media server or WebSocket service
is needed. The tutor's browser records the selected tab or screen and
microphone, stores chunks locally in IndexedDB, and automatically uploads a
recording snapshot every 30 seconds. The final snapshot is uploaded when the
class ends.

## Local setup

```sh
npm ci
npm run db:migrate
npm run dev
```

Apply database migrations before opening classes. Use current Chrome or Edge
over HTTPS (localhost is normally a secure context). Participants must allow
camera and microphone access; students start muted and the tutor can control
individual microphones or mute/unmute the class. Only the tutor can share a
screen. Peer-to-peer media sends one stream to each connected participant, so
network and device load increase with class size.

Set `STUN_URL` to a public STUN service to help peers discover reachable
addresses. Some networks block direct peer connections; for those, configure
all three TURN settings: `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`.
TURN credentials are delivered only to authenticated participants in a live
class, but should still be kept in the server environment.

## Browser recording

Starting a class prompts the tutor to choose a tab, window, or screen and
authorize capture. Choose **This tab** and enable **Share tab audio** when
available. Browser capture requires this user gesture and permission; students
do not record. The tutor's browser saves recording chunks in IndexedDB and
uploads a recording snapshot every 30 seconds while class is live. It sends a
final snapshot when the class ends. Keep the class page open until that save
finishes. If an automatic save fails, the tutor's browser retries at the next
30-second interval; if the final save fails, the tutor can retry while the
saved chunks remain available in that browser.

Configure the recording-storage credentials in the server environment:

```text
CLOUDINARY_CLOUD_NAME=<account-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Do not expose these values with `NEXT_PUBLIC_` prefixes. Recording availability
depends on the tutor's browser, device, and network. Tab-audio capture is not
supported in every browser.

Set `NEXT_PUBLIC_LIVE_CLASS_DEBUG=true` only while diagnosing browser recording
and class-status issues; leave it `false` during normal operation.
