# Browser Recording Setup

Live classes use the existing class status, attendance, and chat features. They
do not provide a remote audio/video meeting. The tutor's browser records the
selected tab or screen and microphone, stores chunks locally in IndexedDB, and
uploads the finished recording directly to Cloudinary. No Jitsi, SFU, or
signaling service is used.

## Cloudinary

1. Create a Cloudinary account at https://cloudinary.com/users/register_free.
2. From the Cloudinary Console, copy the Cloud Name and API Key.
3. Keep the API Secret private; set all three values on the server:

```text
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

The class page requests a short-lived signed upload authorization from the
server. The API Secret is never sent to the browser. Chunked uploads use 6 MiB
chunks and retry transient failures; recordings remain in IndexedDB for retry
if upload or completion fails.

## Local run

```sh
npm ci
npm run db:migrate
npm run dev
```

Sign in as the class tutor, open a scheduled class, and select **Start class &
record**. In the browser picker, select **This tab** and enable **Share tab
audio**. Microphone permission is requested once. If microphone access is
denied, the screen/tab recording can continue with an explicit warning. End the
class to upload and save the recording. Keep the page open until upload finishes.

Use current Chrome or Edge over HTTPS; localhost is normally treated as a
secure context. `getDisplayMedia` and tab-audio capture are not supported in
every browser. Recording relies on the tutor's device, browser, and connection.
Closing the tab while recording triggers a browser warning; chunks already
saved to IndexedDB can be uploaded when the tutor reopens that class page.

Set `NEXT_PUBLIC_LIVE_CLASS_DEBUG=true` only while diagnosing class and browser
recording events. Set it to `false` in normal operation.

## Production

Set the three Cloudinary variables in the hosting provider's server-side
environment settings and redeploy. Do not use `NEXT_PUBLIC_` for credentials.
Apply database migrations with the server-side `DATABASE_URL` before opening
live classes.

Cloudinary free-plan storage, bandwidth, and file limits may change. Check the
current plan details at https://cloudinary.com/pricing.
