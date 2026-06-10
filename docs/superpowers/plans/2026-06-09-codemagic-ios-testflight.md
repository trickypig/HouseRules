# Codemagic iOS Build & TestFlight Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `codemagic.yaml` that builds the HouseRules MAUI iOS target on a Codemagic macOS machine, signs it via automatic App Store Connect signing, and auto-uploads to TestFlight.

**Architecture:** A single Codemagic workflow (`ios-testflight`) on a `mac_mini_m2` instance. It installs the .NET MAUI workload, lets Codemagic's `app_store_connect` integration + `ios_signing` block fetch/install the distribution certificate and provisioning profile, extracts their names, runs `dotnet publish -f net10.0-ios` with those signing values, and publishes the resulting `.ipa` to TestFlight.

**Tech Stack:** Codemagic CI (YAML), .NET 10 / MAUI, `dotnet publish`, App Store Connect API key (automatic signing).

---

## Important context for the implementer

- **This is a CI config + docs change.** There is no application code to unit-test. The only thing verifiable on this Windows machine is that `codemagic.yaml` is **valid YAML with the expected structure**. The real end-to-end verification (an actual signed build + TestFlight upload) only happens on Codemagic's macOS infrastructure after the user completes the one-time Apple/Codemagic setup. The plan reflects this honestly: local steps validate structure; a final manual section covers the real run.
- **Key project facts** (from `MAUI/HouseRules/HouseRules.csproj`): target `net10.0-ios`, `ApplicationId` = `com.trickypig.houserules`.
- **The certificate/profile extraction scripts (Task 1) are the part most likely to need a one-line tweak on the first real Codemagic run**, because the exact cert common-name string depends on the Apple account. The build log prints the available certificates; if extraction comes back empty, adjust the `jq`/`grep` filter to match what the log shows. This is called out in the setup doc (Task 2).

## File Structure

- **Create** `codemagic.yaml` (repo root) — the single workflow definition. Codemagic requires this exact filename at the repo root.
- **Create** `docs/codemagic-ios-setup.md` — the one-time Apple Developer + Codemagic setup steps the user must do outside the repo, plus troubleshooting for the signing extraction.

---

### Task 1: Create `codemagic.yaml`

**Files:**
- Create: `codemagic.yaml`
- Validation script (temporary, not committed): inline PowerShell / Python YAML parse

- [ ] **Step 1: Write the validation check and run it to confirm it fails**

Run (PowerShell):

```powershell
python -c "import yaml,sys; d=yaml.safe_load(open('codemagic.yaml')); assert 'ios-testflight' in d['workflows']; w=d['workflows']['ios-testflight']; assert w['environment']['ios_signing']['bundle_identifier']=='com.trickypig.houserules'; assert w['publishing']['app_store_connect']['submit_to_testflight'] is True; print('OK')"
```

Expected: FAIL — `FileNotFoundError: codemagic.yaml` (the file does not exist yet).

(If `python`/`pyyaml` is unavailable, the equivalent check in Step 4 uses PowerShell's `ConvertFrom-Yaml` fallback noted there.)

- [ ] **Step 2: Create `codemagic.yaml` with this exact content**

```yaml
workflows:
  ios-testflight:
    name: HouseRules iOS TestFlight
    instance_type: mac_mini_m2
    max_build_duration: 60
    integrations:
      # Name of the App Store Connect API key as added in the Codemagic UI
      # (Teams/Personal Account -> Integrations -> App Store Connect).
      # Change "codemagic-api" to whatever you named the key.
      app_store_connect: codemagic-api
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.trickypig.houserules
      vars:
        DOTNET_PROJECT: "MAUI/HouseRules/HouseRules.csproj"
        TARGET_FRAMEWORK: "net10.0-ios"
      xcode: latest
    triggering:
      events:
        - push
      branch_patterns:
        - pattern: main
          include: true
    scripts:
      - name: Install .NET MAUI workload
        script: |
          dotnet --version
          dotnet workload install maui
      - name: Initialize keychain
        script: |
          # The ios_signing block above has already fetched the distribution
          # certificate and provisioning profile from App Store Connect and
          # installed the profile under ~/Library/MobileDevice/Provisioning Profiles.
          keychain initialize
      - name: Extract signing identity and profile name
        script: |
          # dotnet publish needs the certificate common name and the
          # provisioning profile NAME (not UUID). Extract both and persist
          # them to $CM_ENV so the next script can use them.
          CERT_NAME=$(keychain list-certificates \
            | jq -r '.[] | select(.common_name | test("Distribution|Apple Development")) | .common_name' \
            | head -1)
          PROFILE_PATH=$(find "$HOME/Library/MobileDevice/Provisioning Profiles" -name "*.mobileprovision" -print -quit)
          PROFILE_NAME=$(security cms -D -i "$PROFILE_PATH" | plutil -extract Name raw -)
          echo "Using certificate: $CERT_NAME"
          echo "Using provisioning profile: $PROFILE_NAME"
          echo "CERT_NAME=$CERT_NAME" >> $CM_ENV
          echo "PROFILE_NAME=$PROFILE_NAME" >> $CM_ENV
      - name: Build and sign iOS app
        script: |
          dotnet publish "$DOTNET_PROJECT" \
            -f "$TARGET_FRAMEWORK" \
            -c Release \
            -p:ArchiveOnBuild=true \
            -p:BuildIpa=true \
            -p:RuntimeIdentifier=ios-arm64 \
            -p:CodesignKey="$CERT_NAME" \
            -p:CodesignProvision="$PROFILE_NAME"
    artifacts:
      - "**/*.ipa"
      - /tmp/xcodebuild_logs/*.log
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```

- [ ] **Step 3: Run the YAML validation check again**

Run (PowerShell):

```powershell
python -c "import yaml,sys; d=yaml.safe_load(open('codemagic.yaml')); assert 'ios-testflight' in d['workflows']; w=d['workflows']['ios-testflight']; assert w['environment']['ios_signing']['bundle_identifier']=='com.trickypig.houserules'; assert w['publishing']['app_store_connect']['submit_to_testflight'] is True; print('OK')"
```

Expected: PASS — prints `OK`.

Fallback if Python/PyYAML is not installed:

```powershell
$y = Get-Content codemagic.yaml -Raw
if ($y -match 'ios-testflight' -and $y -match 'com\.trickypig\.houserules' -and $y -match 'submit_to_testflight:\s*true') { 'OK' } else { throw 'codemagic.yaml structure check failed' }
```

Expected: prints `OK`.

- [ ] **Step 4: Commit**

```powershell
git add codemagic.yaml
git commit -m "Add Codemagic iOS build + TestFlight workflow"
```

---

### Task 2: Add the one-time setup documentation

**Files:**
- Create: `docs/codemagic-ios-setup.md`

- [ ] **Step 1: Create `docs/codemagic-ios-setup.md` with this exact content**

```markdown
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
```

- [ ] **Step 2: Commit**

```powershell
git add docs/codemagic-ios-setup.md
git commit -m "Document Codemagic iOS/TestFlight one-time setup"
```

---

## Manual end-to-end verification (user-driven, on Codemagic)

These cannot run locally — they are the real acceptance test and require the
Apple/Codemagic setup from Task 2:

- [ ] Complete the one-time setup in `docs/codemagic-ios-setup.md`.
- [ ] Push to `main` and confirm the `ios-testflight` workflow starts in Codemagic.
- [ ] Confirm the build produces a signed `.ipa` artifact.
- [ ] Confirm the build appears in TestFlight and installs on the iPhone via the TestFlight app.

---

## Self-review notes

- **Spec coverage:** instance (`mac_mini_m2`) ✓; .NET workload install ✓;
  automatic signing via `app_store_connect` + `ios_signing` for
  `com.trickypig.houserules` ✓; `dotnet publish -f net10.0-ios` producing signed
  `.ipa` ✓; artifacts ✓; TestFlight publish ✓; trigger on push to `main` ✓;
  one-time Apple/Codemagic setup documented ✓ (Task 2). All spec sections covered.
- **Scope:** iOS only; Android/Windows/MacCatalyst and public App Store release
  intentionally excluded, matching the spec's Out of Scope.
```
