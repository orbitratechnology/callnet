# Callnet Phase 6B — Background push delivery

Status: implemented in source; credentials, deployment, native rebuild, and device verification are pending.

## Completed

- [x] Added `workers/src/push-dispatch.ts` for authenticated Firestore device-token reads.
- [x] Added FCM HTTP v1 data-message delivery using the `incomingCall` payload required by `expo-callkit-telecom`.
- [x] Added APNs VoIP delivery with token-based provider JWTs, `voip` push type, `.voip` topic, and immediate priority.
- [x] Added bounded token count, response size limits, token de-duplication, provider validation, and redacted failure codes.
- [x] Changed offline invite handling to retain the Durable Object call session when at least one push succeeds.
- [x] Added payload and no-credential unit coverage.
- [x] Declared the Firebase service-account secrets in Wrangler as required deployment inputs.
- [x] Set an explicit iOS bundle identifier to keep the APNs topic stable.

## Operator setup before deployment

Firebase service-account secrets are configured on the Worker. Do not commit the values or place them in the Expo `.env` files. APNs credentials remain to be configured when the Apple Team ID, Key ID, and `.p8` key are available:

```powershell
bun x wrangler secret put APNS_TEAM_ID --config workers/wrangler.jsonc
bun x wrangler secret put APNS_KEY_ID --config workers/wrangler.jsonc
bun x wrangler secret put APNS_PRIVATE_KEY --config workers/wrangler.jsonc
```

The APNs values are optional for an Android-only deployment, but iOS background calls remain unavailable until they are configured. `APNS_HOST` defaults to the production APNs host and may be set to the Apple sandbox host for a sandbox-only setup. `APNS_BUNDLE_ID` is the non-secret Wrangler variable `com.orbitratech.callnet`.

## Remaining gate

- [x] Ran `bun x wrangler types --config workers/wrangler.jsonc` after config changes.
- [x] Ran bounded Worker checks and deployed the Worker after the required secrets existed.
- [x] Verified `https://callnet-signaling.orbitra-technology.workers.dev/health` returned `status: ok`.
- [ ] Rebuild the development client after dependencies/config changes.
- [ ] Verify foreground, background, locked-device, answer, reject, timeout, and end behavior on both platforms.
- [ ] Add the Android killed-app receiver and its authenticated terminal-event handoff before claiming killed-app decline propagation.
