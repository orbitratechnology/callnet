# Callnet privacy summary

This is an implementation summary for product, QA, and release review. It is not a substitute for the legal privacy notice required for distribution.

## What Callnet stores

- Firebase Authentication stores the account identity and provider-managed sign-in data.
- Firestore stores the minimum user profile needed for known-user discovery: Firebase UID, username, display name, optional profile-photo URL, and profile timestamps.
- Firestore stores a server-readable `userSearch/{uid}` document containing public profile fields and SHA-256 search tokens. The mobile client cannot read or list these documents, and raw email addresses and phone numbers are not stored there.
- Firestore stores registered device-token metadata needed for incoming-call delivery. Tokens are owner-write-only under the authenticated user.
- The app stores recent-call entries and known contacts locally on the device.
- The Android native receiver may store bounded terminal-call metadata temporarily so it can be flushed after authenticated app resume.

## What Callnet does not store

Callnet does not record, upload, or persist call audio, video, raw SDP, raw ICE candidates, transcripts, chat content, raw email addresses, or raw phone numbers in Firestore. Active call coordination and signaling are ephemeral; the Cloudflare Durable Objects retain only the minimal short-lived call state required to route and authorize events.

## Media and network privacy

WebRTC prefers a direct peer-to-peer media path. When network conditions require it, TURN may relay encrypted media. The signaling Worker carries call control and WebRTC negotiation data, not the media stream itself. TURN provider credentials are issued by the authenticated Worker and are not included in the mobile app configuration.

## Permissions

Microphone and camera access are requested only when the selected call requires them. A denial leaves the user in a recoverable state and provides a device-settings path where supported.

## Diagnostics and logs

Operational logs use structured event names and bounded, redacted diagnostic values. They must not contain access tokens, private keys, raw SDP, raw ICE, audio, video, or full user/call identifiers. Production log retention and access should be configured for the shortest period needed for reliability and abuse review.

## Release boundary

APNs provider credentials, native development-client rebuilds, and physical-device acceptance remain separate release gates. See [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md).
