# Codemagic iOS / TestFlight setup

How to build, sign, and publish a .NET MAUI iOS app to TestFlight entirely in
the cloud on [Codemagic](https://codemagic.io) — **no Mac required**. The
pipeline lives in [`codemagic.yaml`](../codemagic.yaml) at the repo root.

This doc is written as a reusable playbook. For HouseRules the concrete values
are:

| Thing | Value |
|-------|-------|
| Bundle ID (`ApplicationId` in the `.csproj`) | `com.trickypig.houserules` |
| MAUI project | `MAUI/HouseRules/HouseRules.csproj` |
| Target framework | `net10.0-ios` |
| Codemagic workflow | `ios-testflight` |
| Codemagic API-key integration name | `House Rules` |
| Codemagic variable group | `ios_signing` |

When setting up a **new app**, substitute your own bundle ID, project path, and
names — and make sure the names match between the Codemagic UI and
`codemagic.yaml`.

---

## Part 1 — Apple setup (requires your Apple login)

1. **Apple Developer Program** — enroll at https://developer.apple.com ($99/yr).
   Activation can take a few hours.
2. **Register the App ID** — Developer portal → Certificates, IDs & Profiles →
   Identifiers → **+** → App IDs → App. Set the Bundle ID to match the
   `<ApplicationId>` in your `.csproj` (e.g. `com.trickypig.houserules`).
3. **Create the app in App Store Connect** — https://appstoreconnect.apple.com →
   My Apps → **+** → New App. Select iOS, the bundle ID from step 2, and any
   unique SKU. This is the record TestFlight builds attach to.
4. **Create an App Store Connect API key** — App Store Connect → Users and
   Access → **Integrations** → App Store Connect API → generate a key with the
   **App Manager** role.
   - **Download the `.p8` immediately** (one-time download).
   - Note the **Key ID** and the **Issuer ID** (Issuer ID is at the top of the
     Keys list).

---

## Part 2 — Codemagic setup

### 2a. Add the API key integration

Codemagic → Teams/Personal Account settings → **Integrations → App Store
Connect** → add the key: upload the `.p8`, paste the **Key ID** and **Issuer
ID**, and give it a **reference name**.

> ⚠️ The reference name **must match** `integrations.app_store_connect:` in
> `codemagic.yaml`. For HouseRules that name is `House Rules`.

### 2b. Generate a distribution certificate (Mac-free)

You can't easily create an Apple distribution certificate on Windows, but
Codemagic can mint one via your API key:

- Codemagic → Team/Personal settings → **Code signing identities → iOS
  certificates → Generate certificate** → type **Distribution (App Store)**.

This registers an "Apple Distribution" certificate in your Apple account.

### 2c. Create a certificate private key and add it as a secret

`app-store-connect fetch-signing-files` needs the **private key** that backs the
distribution certificate — Apple never hands the private key back from the
portal, so you supply it yourself.

1. Generate a PEM private key on your machine (Windows PowerShell). Either tool
   works:
   ```powershell
   # Option A: ssh-keygen (built into Windows). Press Enter twice for no passphrase.
   ssh-keygen -t rsa -b 2048 -m PEM -f codemagic_private_key

   # Option B: OpenSSL (ships with Git for Windows)
   openssl genrsa -out codemagic_private_key 2048
   ```
2. In Codemagic → your app → **Environment variables**, add:
   - **Name:** `CERTIFICATE_PRIVATE_KEY`
   - **Value:** the entire contents of the `codemagic_private_key` file
     (including the `-----BEGIN ... KEY-----` / `-----END ... KEY-----` lines)
   - **Group:** `ios_signing` (must match the `groups:` entry in `codemagic.yaml`)
   - ✅ Mark it **Secure**

With this private key plus `--create`, Codemagic fetches the matching
distribution certificate (or creates one) and creates the App Store provisioning
profile automatically — no Mac, no manual `.p12`/`.mobileprovision` handling.

> **Apple limits distribution certificates** (usually 2–3). If a build fails with
> "maximum number of certificates", revoke an unused one in Apple Developer →
> Certificates.

### 2d. Connect the repository

Codemagic dashboard → **Add application** → choose your Git provider → pick the
repo. Codemagic auto-detects `codemagic.yaml` and shows the `ios-testflight`
workflow.

---

## Part 3 — App project requirements

These live in the MAUI project itself, not in Codemagic.

### Export compliance (avoids a prompt on every upload)

Add this to `Platforms/iOS/Info.plist` so App Store Connect stops asking about
encryption on every build. Use `false` if the app only uses standard exempt
encryption (HTTPS/TLS), which is the typical case:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

### Versioning

- `<ApplicationDisplayVersion>` in the `.csproj` is the **user-facing version**
  (e.g. `1.0`). Bump it manually for a new marketing version.
- `<ApplicationVersion>` is the **internal build number**. The pipeline
  **auto-increments** this from TestFlight at build time, so you don't edit it.
  (TestFlight rejects duplicate build numbers, which is why this is automated.)

---

## Part 4 — What `codemagic.yaml` does (and why)

Key decisions, each of which was needed to get a green build:

1. **Install the .NET 10 SDK explicitly.** The Codemagic macOS image doesn't put
   `dotnet` on PATH, so the workflow runs `dotnet-install.sh --channel 10.0` and
   persists the path via `$CM_ENV` for later steps. *(Symptom if missing:
   `dotnet: command not found`, exit 127.)*
2. **Create signing files with a script, not the declarative block.** The
   `environment.ios_signing:` block only *fetches existing* profiles, so for a
   brand-new app it fails. Instead the workflow runs
   `app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE
   --certificate-key @env:CERTIFICATE_PRIVATE_KEY --create`. *(Symptom if using
   the declarative block: "No matching profiles found for bundle identifier …".)*
3. **Pass the certificate private key.** `--certificate-key @env:CERTIFICATE_PRIVATE_KEY`
   (from Part 2c). *(Symptom if missing: "Cannot save Signing Certificates
   without certificate private key".)*
4. **Pin the Xcode version.** `.NET 10`'s iOS workload (26.5) requires Xcode 26.5,
   but Codemagic's `latest` is 26.4. The workflow sets `xcode: 26.5`. *(Symptom
   if mismatched: "This version of .NET for iOS … requires Xcode 26.5. The
   current version of Xcode is 26.4.x".)* **Revisit this when .NET or the
   workload updates** — match the Xcode version to whatever the installed iOS
   workload demands.
5. **Auto-increment the build number.** A step looks up the app's numeric App
   Store ID from the bundle ID, asks TestFlight for the highest build number,
   adds 1, and passes it via `-p:ApplicationVersion=$BUILD_NUMBER`.

---

## Running a build

- Push to `main` (the workflow triggers on push), or start a build manually in
  the Codemagic UI for the `ios-testflight` workflow.
- After it succeeds, Apple takes a few minutes to process the upload before it
  appears in TestFlight.
- Install on your iPhone via the **TestFlight** app. Add yourself as an internal
  tester in App Store Connect → your app → TestFlight.

### First build only: export compliance

If you build *before* adding the `ITSAppUsesNonExemptEncryption` key (Part 3), or
for that first build, App Store Connect shows "Missing Compliance". Clear it in
App Store Connect → TestFlight → the build → **Manage** → answer **No** to
non-exempt encryption → Save. The build then becomes available to testers.

---

## Troubleshooting

| Symptom in the build log | Cause / fix |
|--------------------------|-------------|
| `dotnet: command not found` (exit 127) | .NET not on PATH. The install step uses `dotnet-install.sh` and writes PATH to `$CM_ENV`; ensure later steps run after it. |
| `No matching profiles found for bundle identifier … and distribution type app_store` | Using the fetch-only `ios_signing` block with no existing profile. Use the script-based `fetch-signing-files … --create` (Part 4, item 2). |
| `Cannot save Signing Certificates without certificate private key` | `CERTIFICATE_PRIVATE_KEY` missing or not in the workflow's group. See Part 2c. |
| `This version of .NET for iOS … requires Xcode 26.x` | Xcode/workload mismatch. Set `xcode:` to the version the workload needs (Part 4, item 4). |
| `Using certificate:` is empty in the "Extract signing identity" step | Adjust the `jq … test("Distribution\|Apple Development")` filter in `codemagic.yaml` to match the certificate common name printed by `keychain list-certificates` (e.g. `Apple Distribution: Your Name (TEAMID)`). |
| `Using provisioning profile:` is empty | Confirm `$BUNDLE_ID` matches the app's bundle ID and the API key has permission to create profiles. |
| TestFlight rejects the build as a duplicate | Build number collision — the auto-increment step should prevent this; verify it ran and that `-p:ApplicationVersion=$BUILD_NUMBER` is on the publish command. |
| "maximum number of certificates" | Apple's distribution-cert limit reached. Revoke an unused one in Apple Developer → Certificates. |
