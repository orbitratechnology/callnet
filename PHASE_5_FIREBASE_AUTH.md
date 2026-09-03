# Phase 5 — Firebase Auth and real identities

This phase replaces the development-only identity path with Firebase-authenticated users while keeping the existing call controller and signaling interface stable. Signaling now runs through the deployed Cloudflare Worker and native WebSocket transport.

## Task breakdown

### 5.1 Firebase project and apps

- [x] Resolve the project ID collision for the requested `callnet` name.
- [x] Create Firebase project `callnet-orbitra-20260902` with display name `Callnet`.
- [x] Register Android package `com.orbitratech.callnet`.
- [x] Register iOS bundle `com.orbitratech.callnet`.
- [x] Register a web app for the JavaScript Auth adapter.
- [x] Configure Email/Password and Google providers.
- [x] Associate `.firebaserc` with the new project.
- [x] Deploy the Auth configuration through Firebase tooling.

### 5.2 Mobile authentication

- [x] Add Firebase JS SDK and React Native AsyncStorage persistence.
- [x] Restore the current Firebase session on launch.
- [x] Add email/password sign-in.
- [x] Add email/password account creation with display name.
- [x] Add sign-out and user profile display.
- [x] Add the native Google OAuth client configuration and Nitro Google sign-in adapter.

### 5.3 Authenticated signaling

- [x] Replace development IDs with Firebase UID identity objects.
- [x] Send Firebase ID tokens in the WebSocket subprotocol handshake.
- [x] Verify Firebase ID-token claims and signature in the Cloudflare Worker.
- [x] Reject missing, expired, mismatched, or invalid identities.
- [x] Preserve versioned call-event validation and peer-offline acknowledgements.
- [x] Move the verified signaling service to Cloudflare Workers with Durable Objects.

### 5.4 Real-identity contact bridge

- [x] Remove seeded contacts from authenticated recent-call state.
- [x] Add contacts by Firebase UID and persist them per signed-in user.
- [x] Keep the existing voice/video WebRTC call controller unchanged at the UI boundary.
- [x] Replace manual UID entry with authenticated Firestore username discovery.

## Bounded verification completed

- [x] Firebase CLI version verified: `15.28.2`.
- [x] TypeScript check passed with `tsc --noEmit`.
- [x] `git diff --check` passed.
- [ ] Native device test after rebuilding the development client (intentionally skipped for now).

## Device QA gate

The two-device gate is intentionally deferred. It must be completed before production release, but it does not block the remaining code, security, privacy, accessibility, and release-documentation work.
