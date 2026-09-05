# Firestore profile model

Callnet uses the Standard Native Firestore database in `asia-south1`.

The mobile app stores only non-sensitive profile data:

- `users/{uid}`: `uid`, readable social-style `username`, `displayName`, optional Google `photoURL`, `createdAt`, and `updatedAt`.
- `usernames/{username}`: an exact-key mapping to the owning `uid`.
- `userSearch/{uid}`: public profile fields plus SHA-256 search tokens for name, username, email, and phone lookup. This document is not readable by mobile clients; the authenticated Cloudflare Worker queries it and returns only profile fields.

The app never stores raw email addresses or phone numbers in Firestore. Contact discovery uses exact username reads or an authenticated Worker-backed token search, so it does not expose a public Firestore directory to mobile clients.

Google accounts use the Firebase-authenticated Google display name and profile photo. If a new username is not explicitly chosen, Callnet derives a lowercase handle from the display name or email local part and adds a numeric suffix when needed. Existing UID-derived handles are upgraded during profile synchronization.
