# Phase 5 — Firebase Auth and real identities

This phase replaces the development-only identity path with Firebase-authenticated users while keeping the existing call controller and Socket.IO protocol stable.

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
- [ ] Add native Google OAuth client IDs and native Google sign-in.

### 5.3 Authenticated signaling

- [x] Replace development IDs with Firebase UID identity objects.
- [x] Send Firebase ID tokens in the Socket.IO handshake.
- [x] Verify Firebase ID-token claims and signature on the signaling server.
- [x] Reject missing, expired, mismatched, or invalid identities.
- [x] Preserve versioned call-event validation and peer-offline acknowledgements.
- [ ] Move the verified signaling service to Cloud Run.

### 5.4 Real-identity contact bridge

- [x] Remove seeded contacts from authenticated recent-call state.
- [x] Add contacts by Firebase UID and persist them per signed-in user.
- [x] Keep the existing voice/video WebRTC call controller unchanged at the UI boundary.
- [ ] Replace manual UID entry with authenticated Firestore user discovery.

## Bounded verification completed

- [x] Firebase CLI version verified: `15.28.2`.
- [x] TypeScript check passed with `tsc --noEmit`.
- [x] `git diff --check` passed.
- [ ] Native device test after rebuilding the development client.

## User gate before Phase 5 device QA

The Firebase and AsyncStorage additions change the native dependency graph, so the existing installed development client must be rebuilt by the user. After installation:

1. Restart the signaling service so it loads the authenticated server code.
2. Create or sign in to one real account on each device.
3. Open Profile on both devices and record each Firebase UID.
4. Add the other UID as a contact on each device.
5. Reply `continue` so the bounded `agent-device` QA can verify authenticated voice/video calling, accept/reject/cancel/end, and cleanup.

`gcloud` is not available on the current PATH, so Cloud Run setup is not part of this gate. It will be configured only after the CLI is installed and a region is selected.
