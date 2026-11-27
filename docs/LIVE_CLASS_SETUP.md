# Live Class Setup

## Jitsi JaaS

1. Create or sign in to an 8x8 JaaS account at https://jaas.8x8.vc/.
2. Create an application and copy its App ID.
3. Create an API key and copy the Key ID (JITSI_KID).
4. Download the RSA private key associated with the API key.
5. Set these server variables:

```text
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=<your-app-id>
JITSI_KID=<your-key-id>
JITSI_PRIVATE_KEY=<PEM private key>
```

JaaS rooms use the stored random room name and the app ID as their iframe room
scope. JWTs are signed on the server with RS256 and expire after 15 minutes.
Never expose JITSI_PRIVATE_KEY through NEXT_PUBLIC_* variables or source files.

## Cloudinary

1. Create a Cloudinary account.
2. Open the account dashboard and copy Cloud Name and API Key.
3. Generate or copy the API Secret.
4. Set these server variables:

```text
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

The API Secret remains server-only. Existing browser recording code should
request server signatures before direct upload; do not place the secret in a
browser bundle.

## Local run

```sh
npm ci
npm run db:migrate
npm run dev
```

Open the site through HTTPS for camera and microphone testing. localhost is
normally treated as a secure browser context.

Set `LIVE_CLASS_DEBUG=true` only while diagnosing join or Jitsi events.
Set it to `false` in normal operation.

## Vercel and production

Set JITSI_* and Cloudinary server variables in the Vercel project environment
settings for Production and Preview as needed, then redeploy. The Jitsi
External API script is loaded from JITSI_DOMAIN in the browser; Jitsi media
does not require a custom Socket.IO or RTP deployment.

Database migrations must be applied with the server-side DATABASE_URL before
live classes are opened.

## Free-tier and browser limitations

- JaaS and Cloudinary provide limited free-tier monthly usage and storage.
  Verify the current limits on https://jaas.8x8.vc/pricing and
  https://cloudinary.com/pricing.
- JaaS and Cloudinary free-tier limits can change. Production use requires
  monitoring account usage and billing limits.
- Browser tab recording depends on the tutor's browser and device.
  Chrome or Edge is recommended. "This tab" and "Share tab audio" must be
  selected. Tab-audio capture is not supported in every browser.
