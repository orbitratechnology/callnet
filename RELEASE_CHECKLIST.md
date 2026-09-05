# Callnet release checklist

This checklist is the release boundary for the current Expo SDK 57 development-build workflow.

## Implemented in source

- [x] Firebase email/password and Google identity flow.
- [x] Readable usernames and Firebase profile/avatar persistence.
- [x] Known-user contact search and local recent-call history.
- [x] Voice and video call screens with mute, speaker/earpiece, camera toggle, and camera switching.
- [x] WebRTC media cleanup for tracks, peer connection, audio routing, pending SDP/ICE, and repeated teardown.
- [x] Cloudflare Worker WebSocket signaling with Firebase token verification and Durable Objects.
- [x] TURN credentials served by the authenticated Worker without exposing the Metered API key to the mobile app.
- [x] `expo-callkit-telecom` adapter for native outgoing/incoming call surfaces.
- [x] Android killed-app terminal event receiver and authenticated event flush on app resume.
- [x] Privacy explanation, accessible labels, 44-point icon targets, and reduced-motion handling for image transitions.
- [x] Developer-only diagnostics redaction for URLs, bearer tokens, query secrets, and long secret-like values.

## Explicitly deferred by product instruction

- [ ] APNs provider secrets for iOS background VoIP calls.
- [ ] Native development-client rebuild after the latest native changes.
- [ ] Final iOS/Android physical-device acceptance testing.

These items must remain unchecked until they are deliberately scheduled. The app is not a production release candidate while any required device/native gate remains deferred.

## Operator gate before release

- [ ] Install dependencies and regenerate native projects.
- [ ] Build and install fresh development clients on the target iOS and Android devices.
- [ ] Verify foreground, background, and locked-device incoming-call behavior.
- [ ] Verify voice and video calls through the deployed Worker.
- [ ] Verify permission denial and recovery.
- [ ] Verify mute, speaker/earpiece, Bluetooth, camera toggle, camera switching, and repeated end/start cycles.
- [ ] Verify no microphone, camera, native call UI, or timer remains active after ending.
- [ ] Confirm production Firebase rules, Cloudflare secrets, TURN configuration, and push credentials.
- [ ] Redeploy the Worker after configuration changes and verify `/health` and authenticated `/ice-servers` behavior.
- [ ] Review privacy copy, accessibility labels, diagnostics, and store metadata.
