# Callnet Phase 4 — Two-device WebRTC QA Gate

This gate must pass before Firebase Auth or Firestore work begins. It is a manual device gate; static checks do not count as device evidence.

## Current gate status

- [x] Android development client opened with `agent-device`.
- [x] Debug APK installed on both Android targets.
- [x] USB ADB reverse tunnels established for Metro `8081` and signaling `8787` on both targets.
- [x] Home → person selection → call screen navigation verified.
- [x] Real voice-call attempt reached the terminal failure state without crashing.
- [ ] Signaling host is currently reachable: bounded check found no listener on `127.0.0.1:8787`.
- [x] Microphone permission prompt displayed and accepted.
- [x] ARS L22 loaded Callnet through a direct reverse-tunneled Expo deep link.
- [x] Runtime development identity selector added; ARS L22 was switched to `device-b` and the other client remained `device-a`.
- [ ] T4.2.1 voice connection is blocked: cross-device calls produced no incoming event while signaling was unavailable.
- [ ] Socket.IO loopback probe is passing: the bounded probe returned `device-a-connect-error=websocket error`.
- [ ] Two-device WebRTC QA is not passed.

## Task 4.1 — Provision the test environment

- [ ] Install dependencies from the repository lockfile.
- [ ] Create a development client containing the native WebRTC packages.
- [ ] Install one client configured as `device-a`.
- [ ] Install a second client configured as `device-b`.
- [ ] Run the development signaling service on the same LAN as both devices.
- [ ] Set both clients to the signaling host's LAN URL, not `127.0.0.1`, when using physical devices.
- [ ] For USB reverse mode, use `127.0.0.1` for Metro and signaling on both clients.
- [ ] Serve a separate Metro bundle for `device-a` on port `8081`.
- [ ] Serve a separate Metro bundle for `device-b` on port `8082`.
- [ ] Reverse Metro port `8082` to the second device and launch its `127.0.0.1:8082` deep link.
- [ ] Confirm the supplied Metered TURN values are present only in ignored local environment files.
- [ ] Confirm the Metered API key is not in the mobile environment or bundle.

### Provisioning sub-checklist

- [ ] Android: grant camera and microphone permissions when requested.
- [ ] iOS: confirm the camera and microphone permission descriptions are visible and understandable.
- [ ] Confirm the signaling port is reachable from both devices.
- [ ] Confirm the two clients show different development identities.
- [ ] Record device model, OS version, app build identifier, signaling URL, and test date.

## Task 4.2 — Basic connection flows

Run each case with `device-a` as caller and `device-b` as callee, then repeat with the roles reversed.

- [ ] T4.2.1 Voice call connects.
- [ ] T4.2.2 Video call connects with local and remote video.
- [ ] T4.2.3 Callee accepts an incoming call.
- [ ] T4.2.4 Callee rejects an incoming call.
- [ ] T4.2.5 Caller cancels before acceptance.
- [ ] T4.2.6 Caller times out when the callee is unavailable.
- [ ] T4.2.7 Either participant ends a connected call.
- [ ] T4.2.8 A failed signaling or media setup returns both clients to a usable home state.

### Per-call sub-checklist

- [ ] The expected person and call type are shown.
- [ ] State progresses through outgoing/ringing/connecting/connected as applicable.
- [ ] The connected timer starts only after connection.
- [ ] Duplicate terminal events do not crash or duplicate history entries.
- [ ] The call screen exposes a clear next action after ending or failing.
- [ ] Recent-call history records the correct direction, type, and outcome.

## Task 4.3 — In-call controls

- [ ] T4.3.1 Mute stops the local microphone track and updates the control label.
- [ ] T4.3.2 Unmute restores the local microphone track.
- [ ] T4.3.3 Speaker route can be enabled and disabled.
- [ ] T4.3.4 Earpiece route works when speaker is disabled.
- [ ] T4.3.5 Bluetooth route is available when a Bluetooth audio device is connected.
- [ ] T4.3.6 Video camera toggle stops and resumes the local camera track.
- [ ] T4.3.7 Front/back camera switching works.
- [ ] T4.3.8 Local preview and remote video remain visually stable during control changes.

### Control cleanup sub-checklist

- [ ] Ending from either device stops all local media tracks.
- [ ] Ending closes the peer connection.
- [ ] Ending stops in-call audio routing.
- [ ] Camera and microphone indicators turn off after ending.
- [ ] Starting a new call after ending does not reuse stale streams or ICE state.

## Task 4.4 — Permissions and interruption behavior

- [ ] Deny microphone permission for a voice call.
- [ ] Deny camera permission for a video call.
- [ ] Verify the user sees a useful failure message and can return home.
- [ ] Re-enable permissions and verify a subsequent call succeeds.
- [ ] Move the app to background during ringing.
- [ ] Move the app to background during a connected call.
- [ ] Restore the app to foreground and verify state is coherent.
- [ ] Lock and unlock the device during a connected call.
- [ ] Toggle Wi-Fi/cellular or interrupt the network briefly.
- [ ] Verify reconnect/timeout behavior does not leave an active camera or microphone.

## Task 4.5 — Repeatability and evidence

- [ ] Complete at least five consecutive voice call start/end cycles.
- [ ] Complete at least five consecutive video call start/end cycles.
- [ ] Repeat accept, reject, cancel, timeout, and end after prior calls.
- [ ] Review recent-call history for duplicates or incorrect outcomes.
- [ ] Capture screenshots or screen recordings for failures only, avoiding sensitive call content.
- [ ] Attach redacted logs with timestamps and call IDs only.
- [ ] Record every failure with the exact test ID and reproduction steps.

## Exit criteria

Phase 4 passes only when all mandatory cases above pass on both caller/callee role directions, with no known media cleanup leak and no unresolved terminal-state bug. If any mandatory case fails, fix it and rerun the affected case plus the repeatability suite before proceeding to Firebase.

## Operator commands

The operator, not the coding agent, should run the long-lived provisioning/build processes:

```text
Install dependencies using the repository package manager.
Create and install an Expo development client for Android or iOS.
Start the signaling service with `bun run signaling:dev`.
Launch the two clients with separate `device-a` and `device-b` development configuration.
```

Once both clients are installed and visible, use the `agent-device` loop: open the app, act, verify the named expectation, capture evidence when needed, and close the session.
