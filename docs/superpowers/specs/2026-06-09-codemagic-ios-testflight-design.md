# Codemagic iOS Build & TestFlight Pipeline — Design

**Date:** 2026-06-09
**Status:** Approved
**Project:** HouseRules MAUI app (`MAUI/HouseRules/HouseRules.csproj`)

## Goal

Build the MAUI iOS target on a hosted Codemagic macOS machine, sign it with the
developer's Apple identity using **automatic signing** (App Store Connect API
key), and **auto-upload to TestFlight**. The developer works on Windows with no
Mac, so the entire iOS build/sign/distribute flow runs in Codemagic; installation
happens on the iPhone via the TestFlight app — no Mac, USB cable, or local Xcode
required.

## Key Facts

- Target framework: `net10.0-ios` (also Android/MacCatalyst/Windows, out of scope here).
- Bundle identifier / `ApplicationId`: `com.trickypig.houserules`.
- Display version `1.0`, build `1` (from `.csproj`).
- Minimum iOS: 15.0.

## Deliverable in this repo

A single `codemagic.yaml` at the repository root defining one workflow:
`ios-testflight`.

## Pipeline Stages (what `codemagic.yaml` does)

1. **Instance** — `mac_mini_m2` image (provides Xcode + .NET tooling).
2. **Prepare** — ensure the .NET 10 SDK is present, then
   `dotnet workload install maui` so the iOS build workload is available.
   This is explicit rather than assuming the image default, because `net10.0`
   requires the .NET 10 SDK.
3. **Signing** — Codemagic's `app_store_connect` integration plus an
   `ios_signing` block fetch/create the distribution certificate and
   provisioning profile automatically for bundle ID
   `com.trickypig.houserules`, loading them into the build keychain.
4. **Build** — `dotnet publish MAUI/HouseRules/HouseRules.csproj
   -f net10.0-ios -c Release` with `ArchiveOnBuild=true` and the resolved
   codesign key/provisioning profile, producing a signed `.ipa`.
5. **Artifacts** — the `.ipa` and build log are retained as downloadable
   artifacts.
6. **Publish** — auto-upload to App Store Connect with
   `submit_to_testflight: true` (internal testers).
7. **Triggering** — on push to `main`. A manual trigger is also acceptable.

## One-Time Setup (outside the repo — requires the developer's Apple login)

These steps are the developer's responsibility because they require an Apple
account login and cannot be automated from this repo:

1. Apple Developer Program membership ($99/yr).
2. Register the app in App Store Connect with bundle ID
   `com.trickypig.houserules`.
3. Create an **App Store Connect API key** (`.p8` file + Key ID + Issuer ID,
   "App Manager" role) and add it to Codemagic as an integration.
4. Connect this Git repository to Codemagic.

## Risks / Notes

- `net10.0` requires the .NET 10 SDK on the build image; the prepare step makes
  this explicit instead of assuming the image ships it.
- TestFlight processing on Apple's side takes a few minutes after upload before
  the build becomes available to testers.
- Only the iOS target is in scope. Android/Windows/MacCatalyst builds are not
  part of this pipeline.

## Out of Scope

- Android, Windows, and MacCatalyst build/publish pipelines.
- App Store (public) release submission — TestFlight only.
- Manual `.p12`/`.mobileprovision` signing (automatic signing chosen instead).
