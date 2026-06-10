# Codemagic iOS / TestFlight setup

The `codemagic.yaml` at the repo root builds the iOS app, signs it, and uploads
it to TestFlight. The build runs entirely on Codemagic's macOS machines — you
need no Mac. These one-time steps require your Apple login and cannot be
automated from the repo.

## One-time setup

1. **Apple Developer Program** — enroll at https://developer.apple.com ($99/yr).
2. **Register the app in App Store Connect** — create a new app with bundle ID
   `com.trickypig.houserules` (must match `ApplicationId` in
   `MAUI/HouseRules/HouseRules.csproj`).
3. **Create an App Store Connect API key** — App Store Connect → Users and
   Access → Integrations → App Store Connect API → generate a key with the
   **App Manager** role. Download the `.p8` file and note the **Key ID** and
   **Issuer ID** (you cannot re-download the `.p8`).
4. **Add the key to Codemagic** — in Codemagic, Teams/Personal Account →
   Integrations → App Store Connect → connect, uploading the `.p8` plus Key ID
   and Issuer ID. Give it a reference name and make sure it matches the
   `integrations.app_store_connect:` value in `codemagic.yaml` (default
   `codemagic-api`).
5. **Connect this Git repository to Codemagic** — Add application → pick this
   repo. Codemagic auto-detects `codemagic.yaml`.

## Running a build

- Push to `main` (or start a build manually in the Codemagic UI for the
  `ios-testflight` workflow).
- After the build succeeds it uploads to TestFlight. Apple takes a few minutes
  to process the build before it appears.
- Install on your iPhone via the **TestFlight** app (add yourself as an internal
  tester in App Store Connect).

## Troubleshooting: signing extraction

The "Extract signing identity and profile name" step reads the certificate
common name and provisioning profile name from the build machine. If the build
fails at the publish step with a code-signing error, open the build log and look
at the output of that step:

- If `Using certificate:` is empty, adjust the `jq ... test(...)` filter in
  `codemagic.yaml` to match the certificate common name printed by
  `keychain list-certificates` in the log (e.g. it may read
  `Apple Distribution: Your Name (TEAMID)`).
- If `Using provisioning profile:` is empty, confirm the `ios_signing` block's
  `bundle_identifier` matches the app's bundle ID and that the App Store Connect
  API key has permission to create profiles.
