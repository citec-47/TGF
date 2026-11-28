# Live Class Setup

Live classes use the self-hosted mediasoup media service for real-time video,
audio, and tutor screen sharing. Chat and class status use the existing
collaboration API. The tutor's browser records the selected tab or screen and
microphone, stores chunks locally in IndexedDB, and automatically uploads a
recording snapshot every 30 seconds. The final snapshot is uploaded when the
class ends.

## Local setup

```sh
npm ci
npm run db:migrate
npm run dev
```

The custom server starts the media service when `MEDIASOUP_ENABLED=true`. For
local development, set:

```text
MEDIASOUP_ENABLED=true
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
```

## Production media networking

Run the custom server entry point (`npm start`), rather than a standalone
Next.js server. Set `MEDIASOUP_ENABLED=true` and `MEDIASOUP_ANNOUNCED_IP` to the
media server's public IPv4 or IPv6 address. Allow inbound UDP and TCP traffic on the
configured `MEDIASOUP_MIN_PORT`–`MEDIASOUP_MAX_PORT` range (defaults:
40000–49999). Keep the range consistent between the server configuration and
firewall.

For networks that block direct media connections, configure a STUN server with
`STUN_URL`, or configure all three TURN settings: `TURN_URL`, `TURN_USERNAME`,
and `TURN_CREDENTIAL`. Store TURN credentials only in the server environment.
`LIVE_CLASS_MAX_STUDENTS` can be set from 1 to 16.

Apply database migrations before opening classes. Use current Chrome or Edge
over HTTPS (localhost is normally a secure context). Participants must allow
camera and microphone access; students start muted and the tutor can control
individual microphones or mute/unmute the class. Only the tutor can share a
screen.

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
