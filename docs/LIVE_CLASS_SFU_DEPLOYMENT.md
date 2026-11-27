# Deploying the live-class SFU beside Vercel

Vercel can host the website and API, but it does not keep the mediasoup worker
and Socket.IO service running between requests. Run this SFU on a persistent
Linux host with a public static IP; the website and authorized join APIs can
remain on Vercel.

## 1. Provision the host and DNS

- Create an `A` record such as `live.transgenerationalforces.com` pointing to
  the SFU host's static public IPv4 address. Do this only after the host exists.
- Install the supported Node.js version (20 or later), Git, and the native
  build tools needed by mediasoup. Clone the same application revision and run
  `npm ci`.
- Ensure the host can reach the application's PostgreSQL database over TLS.
  Prefer a private network or database IP allowlist over exposing PostgreSQL
  publicly.
- Allow inbound TCP 443 for HTTPS/WebSocket traffic and UDP **and** TCP
  `40000-49999` for mediasoup media traffic. Restrict SSH separately.
- Configure a TLS reverse proxy for `live.transgenerationalforces.com` to
  forward requests to `127.0.0.1:3001` without changing the
  `/live-class/socket.io` path. For example, Caddy's `reverse_proxy` supports
  WebSocket upgrades automatically.

## 2. Configure secrets and environment

Set environment variables through the host's secret manager or service manager,
not in Git. The SFU host needs:

- `DATABASE_URL`: the same application database used by the Vercel API.
- `SESSION_SECRET`: the same current signing secret used by the Vercel API.
  Rotate any credential that has been exposed before deployment, then update
  both environments together.
- `MEDIASOUP_LISTEN_IP=0.0.0.0` and `MEDIASOUP_ANNOUNCED_IP` set to the SFU
  host's public IP.
- `MEDIASOUP_MIN_PORT=40000` and `MEDIASOUP_MAX_PORT=49999` (or a matching,
  firewall-opened range).
- `LIVE_CLASS_WEB_ORIGINS=https://www.transgenerationalforces.com,https://transgenerationalforces.com`
  with each permitted web origin listed exactly, without a trailing slash.
- `LIVE_CLASS_SFU_HOST=0.0.0.0` and `LIVE_CLASS_SFU_PORT=3001`.
- `STUN_URL`, plus `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` together
  for reliable connectivity through restrictive networks. TURN is strongly
  recommended; STUN alone cannot traverse every firewall.
- `LIVE_CLASS_DEBUG=false` in normal operation. Enable it temporarily for
  diagnostics, then disable it.

The Vercel project needs the same `SESSION_SECRET` and must set
`NEXT_PUBLIC_LIVE_CLASS_SFU_URL=https://live.transgenerationalforces.com`.
This value is embedded into the client bundle, so redeploy the Vercel project
after setting or changing it. Keep database and TURN credentials server-side;
never put them in `NEXT_PUBLIC_*`.

## 3. Start and verify the service

Start the standalone service from the application checkout:

```sh
npm run start:sfu
```

Run it under a process manager such as systemd so it restarts on host reboot
and after an unexpected exit. Its readiness endpoint is
`https://live.transgenerationalforces.com/health`; it should return
`{"ok":true,"service":"live-class-sfu"}`. Confirm the TLS proxy preserves
WebSocket upgrades and that UDP/TCP media ports are reachable before testing a
class.

The Vercel API creates a signed, class-scoped socket ticket only after the
existing account, tutor assignment, and student enrollment checks succeed.
Tickets expire after two minutes; the browser requests a fresh authorized
ticket when reconnecting. The SFU validates the ticket, checks the account
again in PostgreSQL, and retains the existing class-role and enrollment
authorization. Do not copy login cookies to the SFU subdomain.

## 4. Production acceptance test

After both deployments use the same rotated `SESSION_SECRET` and the DNS record
has propagated:

1. Check `/health` and verify the browser's socket handshake reaches the SFU
   host directly, with no Vercel redirect.
2. Start a class as its assigned tutor, then join as an enrolled student from
   another network. Test tutor-first and student-first order, two-way audio
   and video, waiting-room transition, participant/attendance updates, and
   reconnect after a brief network interruption.
3. Confirm an unassigned tutor and a non-enrolled student are rejected.
4. Verify the media connection over the configured TURN service where direct
   UDP connectivity is blocked.

The implementation and health endpoint do not prove the production network,
TURN service, credentials, or database connectivity are configured correctly.
Do not announce live classes as production-ready until this acceptance test
passes.
