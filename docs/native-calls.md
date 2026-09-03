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

The Cloudflare Worker still needs a secure push-sender path and platform credentials before background incoming calls can be enabled. iOS needs an APNs VoIP certificate/key; Android needs FCM delivery credentials. These must be added through deployment secrets, never the mobile bundle.

The current config intentionally does not register an Android killed-app broadcast receiver. The package documents that a native receiver is required to notify the backend when a system decline occurs while JavaScript is not running; that receiver is a later bounded native task.
