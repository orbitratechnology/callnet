# Callnet

Callnet is an Expo SDK 57 one-to-one voice and video calling app. The app uses Firebase email/password or Google authentication and authenticated WebSocket signaling through Cloudflare Durable Objects. Native WebRTC runs in an Expo development build, not Expo Go.

## Local setup

1. Install and authenticate the Doppler CLI, then configure this repository for `callnet/dev_personal`:

   ```bash
   doppler login
   doppler setup --project callnet --config dev_personal --no-interactive
   ```

2. Keep public Expo/Firebase client configuration in Doppler `dev_personal`; do not create a plaintext `.env.local` file. The app commands inject the active Doppler config directly into Expo.
3. Install dependencies with the repository package manager.
4. Have the user build/install a fresh Expo development client after native dependency changes.
5. Start Metro for the app:

   ```bash
   bun run start
   ```

The Expo scripts require the Doppler CLI and use its standard `doppler run -- <command>` injection pattern with `--preserve-env=false`. If a legacy `.env.local` exists, remove it because Expo will otherwise load it alongside the injected environment.

### EAS environment and Google services sync

EAS builds use the EAS environment-variable service. The `development`, `preview`, and `production` build profiles in [eas.json](eas.json) explicitly select the matching EAS environment. The app config reads these EAS file variables when present and falls back to the ignored local files for local development:

- `GOOGLE_SERVICES_JSON` → Android `google-services.json`
- `GOOGLE_SERVICE_INFO_PLIST` → iOS `GoogleService-Info.plist`

Keep the two Google files locally at their ignored paths (`google-services.json` and `GoogleService-Info.plist`). The sync command uploads them directly to EAS as secret file variables; they do not need to be copied into Doppler. Then run the sync from the repository root:

```powershell
# Sync public EXPO_PUBLIC_* variables and both Google files to development
bun run eas:sync-env -- -EasEnvironment development -DopplerConfig dev_personal

# Sync production values, using the existing production Doppler config
bun run eas:sync-env -- -EasEnvironment production -DopplerConfig prd

# Upload only the two Google files
bun run eas:sync-google-services -- -EasEnvironment preview -DopplerConfig dev_personal
```

The sync script uploads the local files as EAS secret file variables and removes its temporary public-env files when it exits. It never prints secret values. After syncing, EAS builds can run with the normal `eas build --profile <profile>` command; local Metro commands continue to use Doppler.

The normal calling flow uses the deployed Worker configured in `EXPO_PUBLIC_SIGNALING_URL`. Deploy and operate it from [workers/](workers/), using Wrangler. The former Node/Socket.IO service has been removed. TURN configuration is requested from the authenticated Worker at `/ice-servers`; the mobile source and public configuration contain no Metered API key.

Native incoming-call UI is provided by `expo-callkit-telecom` on iOS CallKit and Android Core-Telecom. It requires a development-client rebuild after dependency or config changes; see [docs/native-calls.md](docs/native-calls.md).

The current implementation and remaining production gates are tracked in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). APNs setup, native rebuilds, and physical-device acceptance remain intentionally deferred until explicitly scheduled.

## Authenticated calling flow

Create or sign in to a real Firebase email/password or Google account on each device. Email accounts choose a username; Google accounts receive a readable handle derived from the Google name or account email. On Calls, use the global search to find a person by name, `@username`, email, or phone number, then start a voice or video call directly from the result. No development identity is accepted by the authenticated signaling server.

Native Google sign-in uses the registered Firebase Android/iOS apps and the web OAuth client ID. The first native run requires a fresh development build after the Google Sign-In package/config plugin is added.

Keep TURN credentials, Metered API keys, Firebase admin credentials, and private APNs keys in Doppler/Cloudflare secrets—not in source control. Firebase client configuration is public client configuration; the signaling server must use Firebase ID-token verification and must never receive a service-account key in the mobile app.

## Secret management

The current `/ice-servers` endpoint retrieves the configured long-lived Metered credential. Rotate that credential in Metered, then update Doppler and synchronize the Worker when rotation is needed.

- Doppler `dev_personal` stores local Expo public configuration.
- Doppler `prd` stores the Worker’s Firebase service-account credentials and non-secret Worker settings.
- Cloudflare Worker secrets contain only server-side runtime credentials.
- `METERED_TURN_API_KEY` must be entered directly into Doppler and synchronized to Cloudflare before deploying the Worker:

  ```bash
  doppler secrets set METERED_TURN_API_KEY --project callnet --config prd
  ```

  Enter the value interactively; never place it in a command, `.env` file, or mobile `EXPO_PUBLIC_*` variable.

Synchronize the Worker’s server-side credentials with the scoped Doppler command:

```bash
bun run worker:sync-secrets
```

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
