# Callnet

Callnet is an Expo SDK 57 one-to-one voice and video calling app. The app uses Firebase email/password or Google authentication and Firebase UID-based Socket.IO signaling. Native WebRTC runs in an Expo development build, not Expo Go.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Firebase web configuration and local TURN values. `.env.local` is ignored by Git.
2. Install dependencies with the repository package manager.
3. Have the user build/install a fresh Expo development client after native dependency changes.
4. Start Metro and the signaling service separately:

   ```bash
   npx expo start
   bun run signaling:dev
   ```

For physical devices, `EXPO_PUBLIC_SIGNALING_URL` must resolve to the signaling host. With an ADB reverse tunnel it can be `http://127.0.0.1:8787`; on the LAN it should use the host's LAN address. The server verifies Firebase ID tokens for `FIREBASE_PROJECT_ID` before relaying any call event.

## Authenticated calling flow

Create or sign in to a real Firebase email/password or Google account on each device. Email accounts choose a username; Google accounts receive a readable handle derived from the Google name or account email. Find the other person by exact username, then start a voice or video call. No development identity is accepted by the authenticated signaling server.

Native Google sign-in uses the registered Firebase Android/iOS apps and the web OAuth client ID. The first native run requires a fresh development build after the Google Sign-In package/config plugin is added.

Keep TURN credentials and Firebase admin credentials out of source control. Firebase client configuration is public client configuration; the signaling server must use Firebase ID-token verification and must never receive a service-account key in the mobile app.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
