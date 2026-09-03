# Callnet Phase 6 — Native incoming-call integration

Status: implemented in source; native rebuild and device verification are pending.

## Completed

- [x] Added `expo-callkit-telecom` integration behind a small app-owned adapter.
- [x] Added native outgoing-call start, incoming-call reporting, answer, end, mute, video-state, and media-connected lifecycle hooks.
- [x] Restored an active native incoming call into the authenticated Callnet controller after a cold start.
- [x] Registered VoIP push tokens and persisted only the token type, token, platform, and update time under the owning Firebase user.
- [x] Added Firestore rules for owner-only device-token writes with bounded fields.
- [x] Switched the WebRTC runtime import to `@livekit/react-native-webrtc`, which is the required peer for the current Callnet Telecom package.
- [x] Added iOS VoIP/audio background modes, Android Telecom permissions, Android API 26 minimum, and the required Expo config plugins.

## Not yet passed

- [ ] Install dependencies and rebuild the development client on Android and iOS.
- [ ] Configure a production push sender for FCM and APNs VoIP pushes.
- [ ] Add the Android killed-app event receiver before relying on JS to report a system decline while the app is killed.
- [ ] Run the two-device native incoming-call acceptance gate.

The push sender and device gate remain separate follow-up work. This phase does not claim background, locked-device, or killed-app behavior as verified.
