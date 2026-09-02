# Signaling deployment gate

Callnet's current signaling transport is Socket.IO over a long-lived WebSocket
connection. It verifies Firebase ID tokens, keeps the active call registry in
memory, and never persists SDP, ICE, audio, video, or raw call content.

Firebase Functions 2nd gen is appropriate for short-lived HTTP handlers and
Firebase-triggered work. It is not the deployment target for this Socket.IO
upgrade path: its public `onRequest` API exposes an HTTP/Express handler, not a
WebSocket server lifecycle.

The reliable no-Docker option for the existing calling transport is a Cloud Run
service deployed from source with buildpacks. It should remain single-instance
until the registry is moved to a shared store such as Redis, and it must use a
long request timeout plus client reconnection handling.

If the backend must be a Firebase Function, the mobile transport must first be
changed from Socket.IO/WebSocket signaling to an HTTP-compatible design. That is
a separate implementation decision because it changes call setup behavior.
