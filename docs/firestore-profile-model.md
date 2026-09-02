# Firestore profile model

Callnet uses the Standard Native Firestore database in `asia-south1`.

The mobile app stores only non-sensitive profile data:

- `users/{uid}`: `uid`, readable social-style `username`, `displayName`, optional Google `photoURL`, `createdAt`, and `updatedAt`.
- `usernames/{username}`: an exact-key mapping to the owning `uid`.

The app never stores email addresses in Firestore. Contact discovery performs two exact document reads after authentication, so it does not expose a public user directory or require a collection query.

Google accounts use the Firebase-authenticated Google display name and profile photo. If a new username is not explicitly chosen, Callnet derives a lowercase handle from the display name or email local part and adds a numeric suffix when needed. Existing UID-derived handles are upgraded during profile synchronization.
