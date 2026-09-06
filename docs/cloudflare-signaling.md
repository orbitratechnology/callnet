# Cloudflare signaling

Callnet signaling is a Cloudflare Worker backed by Durable Objects. The Worker is the source of truth for authenticated WebSocket routing, call authorization, terminal state, and short-lived active-call coordination.

## Deployed service

- Worker: `callnet-signaling`
- Initial endpoint: `https://callnet-signaling.orbitra-technology.workers.dev`
- WebSocket endpoint: `wss://callnet-signaling.orbitra-technology.workers.dev/ws`
- Health check: `GET /health`
- Authenticated TURN endpoint: `GET /ice-servers`
- Authenticated active-call reconciliation: `GET /calls/active`

The mobile app reads the endpoint from `EXPO_PUBLIC_SIGNALING_URL`. The value may be an HTTP(S) base URL; the mobile transport converts it to `ws://` or `wss://` for `/ws`, while HTTP APIs remain on the HTTP(S) form.

## Deploy and verify

Run these commands from `workers/` after Wrangler authentication:

```powershell
bun x wrangler whoami
bun x wrangler types --config wrangler.jsonc
bun run check
bun x wrangler deploy --config wrangler.jsonc
Invoke-RestMethod https://callnet-signaling.orbitra-technology.workers.dev/health
```

The deployment must keep `USER_SESSION` and `CALL_SESSION` Durable Object bindings and the SQLite migration in `wrangler.jsonc`. Do not add a Dockerfile, Firebase Function, Cloud Run service, or in-memory global registry for signaling.

## Secrets

Server-only values are synchronized from Doppler through the repository script:

```powershell
bun run worker:sync-secrets
```

Required Wrangler secrets are `FIREBASE_SERVICE_ACCOUNT_EMAIL`, `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`, and `METERED_TURN_API_KEY`. Never put these values in the mobile app, source control, command arguments, or logs. Firebase project ID and other non-secret routing configuration remain Wrangler variables.

## Runtime rules

- WebSocket authentication uses the Firebase ID token in the subprotocol handshake; tokens are not placed in the URL.
- Durable Objects route by Firebase UID and call ID, so devices signed into one account can receive that account’s call events.
- SDP and ICE are relayed only for the active call and are not permanently stored.
- Terminal events are idempotent and clear both participants’ active snapshots, including when the peer is offline.
- `GET /calls/active` is used after authenticated reconnect to reconcile native call UI after process death or suspension.

## Bounded checks

`bun run check` is the local static verification command. The Worker integration suite requires a compatible local Cloudflare runtime and configured test secrets; if that environment is unavailable, report the limitation rather than starting an unbounded local Worker or test process.
