# Native call UI

Callnet uses `expo-callkit-telecom` as the OS call-surface adapter. The adapter is in [native-call-ui.ts](../src/features/calls/native-call-ui.ts), while WebRTC media remains owned by the existing call controller.

## Native dependency change

`expo-callkit-telecom` requires `@livekit/react-native-webrtc` 144 or newer. Callnet therefore uses that package for both the media engine and `RTCView`; the older `react-native-webrtc` package must not be installed beside it.

After pulling these source changes, the operator must run:

```powershell
bun install
bun run prebuild --clean
```

Then rebuild and install the development client. Metro reload alone cannot load these native modules.

## Runtime flow

1. Outgoing calls request the native call surface before WebRTC media starts.
2. An authenticated WebSocket invite is reported to CallKit/Core-Telecom with the real caller name, avatar URL, call ID, and call type.
3. System answer/end/mute/video events are mapped back to the Callnet controller.
4. WebRTC connection success fulfills the native incoming-call answer or reports the outgoing call as connected.
5. Remote termination is reported to the operating system before local media cleanup.

The adapter is intentionally tolerant of an old development client: it becomes a no-op until the native package is installed in a rebuilt client. The source still supports the normal foreground WebRTC flow while that rebuild is pending.

## VoIP tokens

The app registers the native VoIP channel after Firebase authentication. The token is stored at `users/{uid}/devices/{deviceId}` with owner-only Firestore writes. The app does not store SDP, ICE, audio, video, or call content.

The Cloudflare Worker now has a secure push-sender path in [push-dispatch.ts](../workers/src/push-dispatch.ts). It reads device-token metadata from Firestore, sends FCM HTTP v1 data messages or APNs VoIP pushes, and keeps provider credentials in Wrangler secrets. The payload contains the call ID, call type, and caller identity needed by the native call surface; it never contains SDP, ICE, audio, video, or raw call content.

The required setup and remaining verification are tracked in [PHASE_6B_PUSH_DELIVERY.md](../PHASE_6B_PUSH_DELIVERY.md). iOS still needs APNs provider credentials, while Android has the native killed-app event receiver configured in `app.json`.

The Android receiver records only bounded terminal-call metadata locally. It does not send an unauthenticated request while JavaScript is unavailable; the event is flushed as an authenticated reject after Firebase Auth restores and the WebSocket reconnects.
