# Eco Mi — Accounts, Keys & Service Setup

> Every third-party account, API key, and credential needed to ship Eco Mi — from development through production.

---

## Table of Contents

1. [Overview](#overview)
2. [Apple Developer Account](#apple-developer-account)
3. [Google Play Developer Account](#google-play-developer-account)
4. [EAS (Expo Application Services)](#eas-expo-application-services)
5. [RevenueCat](#revenuecat)
6. [Google AdMob](#google-admob)
7. [PostHog](#posthog)
8. [App Configuration Reference](#app-configuration-reference)
9. [Security — Open Source Considerations](#security--open-source-considerations)
10. [Checklist](#checklist)

---

## Overview

| Service | Purpose | Cost | Required By |
|---|---|---|---|
| Apple Developer Program | iOS App Store distribution, IAP hosting | $99/year | Phase 2 (monetization) |
| Google Play Console | Android distribution, IAP hosting | $25 one-time | Phase 2 (monetization) |
| EAS (Expo) | Cloud builds, OTA updates, submission | Free tier available | Already configured |
| RevenueCat | IAP management, receipt validation, entitlements | Free up to $2.5k MTR | Phase 2 (monetization) |
| Google AdMob | Ad serving (banner, interstitial, rewarded) | Free (revenue share) | Phase 1 (monetization) |
| PostHog | Product analytics (events, funnels, retention) | Free up to 1M events/month | Phase 1 (analytics) |

**App identifiers (already set):**

- iOS Bundle ID: `com.frankcalise.ecomi`
- Android Package: `com.frankcalise.ecomi`
- EAS Project ID: `a7ae3db1-a5a2-4deb-ba44-ffa09d58aead`

---

## Apple Developer Account

### Sign Up

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enroll.
2. Sign in with your Apple ID (or create one). Individual enrollment is $99/year.
3. Verification takes 24–48 hours.

### App Store Connect Setup

1. Log in to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Go to **My Apps → +** to create a new app.
3. Fill in:
   - **Platform**: iOS
   - **Name**: Eco Mi
   - **Bundle ID**: `com.frankcalise.ecomi` (register under **Certificates, Identifiers & Profiles** first if not already)
   - **SKU**: `ecomi-ios`
   - **Primary Language**: English (U.S.)

### In-App Purchases (App Store Connect)

Create IAP products under **My Apps → Eco Mi → In-App Purchases**:

| Reference Name | Product ID | Type |
|---|---|---|
| Remove Ads | `ecomi_remove_ads` | Non-Consumable |
| Theme: Neon | `ecomi_theme_neon` | Non-Consumable |
| Theme: Retro | `ecomi_theme_retro` | Non-Consumable |
| Theme: Pastel | `ecomi_theme_pastel` | Non-Consumable |
| Sound: Square Wave | `ecomi_sound_square` | Non-Consumable |
| Sound: Sawtooth Wave | `ecomi_sound_sawtooth` | Non-Consumable |
| Sound: Triangle Wave | `ecomi_sound_triangle` | Non-Consumable |

For each product:
- Set the price tier ($2.99 for Remove Ads, $0.99–1.99 for packs)
- Add a display name and description (shown to users on the purchase sheet)
- Add a screenshot of the purchase context (required for review)
- Submit for review alongside the app binary

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| Apple Team ID | EAS builds, signing | Certificates, Identifiers & Profiles → Membership |
| App Store Connect API Key | EAS Submit (automated submission) | Users and Access → Integrations → App Store Connect API |

---

## Google Play Developer Account

### Sign Up

1. Go to [play.google.com/console](https://play.google.com/console/signup) and sign in with a Google account.
2. Pay the one-time $25 registration fee.
3. Complete identity verification (required before publishing).

### App Setup

1. In the Play Console, **Create app**.
2. Fill in:
   - **App name**: Eco Mi
   - **Default language**: English (US)
   - **App or Game**: Game
   - **Free or Paid**: Free
3. Complete the **Store listing** (description, screenshots, graphics) before first release.

### In-App Products (Google Play)

Go to **Monetize → In-app products → Create product**:

| Product ID | Type | Price |
|---|---|---|
| `ecomi_remove_ads` | One-time (non-consumable) | $2.99 |
| `ecomi_theme_neon` | One-time | $0.99–1.99 |
| `ecomi_theme_retro` | One-time | $0.99–1.99 |
| `ecomi_theme_pastel` | One-time | $0.99–1.99 |
| `ecomi_sound_square` | One-time | $0.99 |
| `ecomi_sound_sawtooth` | One-time | $0.99 |
| `ecomi_sound_triangle` | One-time | $0.99 |

Product IDs must match exactly across App Store Connect and Google Play — RevenueCat maps them by ID.

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| Service Account JSON | RevenueCat server-to-server validation | Play Console → Setup → API access → Create service account |
| Upload Key / Keystore | EAS builds (Android signing) | Generated during first `eas build` or via `keytool` |

---

## EAS (Expo Application Services)

### Current Status

Already configured. EAS project ID `a7ae3db1-a5a2-4deb-ba44-ffa09d58aead` is in `app.json`.

### What's Needed for Production

1. **Apple credentials**: Run `eas credentials` to configure iOS signing (distribution certificate + provisioning profile). EAS can manage these automatically.
2. **Google credentials**: Upload the Android keystore or let EAS generate one on first build. Store it securely — losing the keystore means you can never update the app.
3. **Submit profiles**: Configure `eas.json` with `submit` profiles for automated App Store and Play Store uploads.

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| EAS Project ID | Builds, updates, submission | Already set: `a7ae3db1-a5a2-4deb-ba44-ffa09d58aead` |
| Expo Access Token | CI/CD builds | [expo.dev/accounts/settings](https://expo.dev/accounts/settings) → Access Tokens |

---

## RevenueCat

### Sign Up

1. Go to [app.revenuecat.com](https://app.revenuecat.com) and create an account (free tier covers up to $2,500/month in tracked revenue).
2. Create a new **Project** named "Eco Mi".

### Platform Configuration

**iOS (App Store):**

1. In the RevenueCat project, go to **Apps → + New** → select **App Store**.
2. Enter:
   - **App name**: Eco Mi (iOS)
   - **Bundle ID**: `com.frankcalise.ecomi`
   - **App Store Connect Shared Secret**: Get this from App Store Connect → My Apps → Eco Mi → App Information → App-Specific Shared Secret
3. Save. Note the **Public API Key** for iOS.

**Android (Google Play):**

1. In the RevenueCat project, go to **Apps → + New** → select **Play Store**.
2. Enter:
   - **App name**: Eco Mi (Android)
   - **Package name**: `com.frankcalise.ecomi`
   - **Service Account JSON**: Upload the service account credentials from Google Play Console (see [Google Play section](#google-play-developer-account))
3. Save. Note the **Public API Key** for Android.

### Products & Entitlements

**Step 1 — Products**: RevenueCat auto-imports products from App Store Connect and Google Play once platform credentials are configured. Verify all 7 product IDs appear.

**Step 2 — Entitlements**: Create entitlements that map to product groups:

| Entitlement ID | Grants Access To | Products |
|---|---|---|
| `remove_ads` | Ad-free experience | `ecomi_remove_ads` |
| `theme_neon` | Neon theme | `ecomi_theme_neon` |
| `theme_retro` | Retro theme | `ecomi_theme_retro` |
| `theme_pastel` | Pastel theme | `ecomi_theme_pastel` |
| `sound_square` | Square wave sounds | `ecomi_sound_square` |
| `sound_sawtooth` | Sawtooth wave sounds | `ecomi_sound_sawtooth` |
| `sound_triangle` | Triangle wave sounds | `ecomi_sound_triangle` |

**Step 3 — Offerings**: Create a "Default" offering with packages that group related products. This is what the app fetches at runtime to display available purchases.

### App Integration

```typescript
import Purchases from "react-native-purchases"
import { Platform } from "react-native"

const REVENUECAT_API_KEY = Platform.select({
  ios: "appl_XXXXXXXXXXXXXXXXXXXXXXXX",
  android: "goog_XXXXXXXXXXXXXXXXXXXXXXXX",
})

// Initialize early in app lifecycle (e.g., _layout.tsx)
Purchases.configure({ apiKey: REVENUECAT_API_KEY })
```

Add the Expo config plugin to `app.json`:

```json
{
  "plugins": ["react-native-purchases"]
}
```

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| iOS Public API Key | App init (`Purchases.configure`) | RevenueCat Dashboard → Project → iOS App → API Keys |
| Android Public API Key | App init (`Purchases.configure`) | RevenueCat Dashboard → Project → Android App → API Keys |

These are **public** keys — safe to include in the app binary. RevenueCat's server-side validation uses the shared secret / service account you configured in the dashboard.

---

## Google AdMob

### Sign Up

1. Go to [admob.google.com](https://admob.google.com) and sign in with a Google account.
2. Accept the Terms of Service and provide payment information (required — this is where ad revenue gets paid out).
3. Complete account verification (may take 1–2 business days for new accounts).

### Register Apps

Create two app entries — one per platform:

1. Go to **Apps → Add App**.
2. Select the platform (iOS or Android).
3. If the app is not yet published, select **"No"** when asked if it's on a store. Link it later.
4. Enter the app name ("Eco Mi").
5. Note the **App ID** for each platform.

### Create Ad Units

For each platform, go to **Apps → Eco Mi → Ad Units → Add Ad Unit**:

| Ad Unit Name | Type | Notes |
|---|---|---|
| `ecomi_banner` | Banner | Standard, bottom of screen |
| `ecomi_interstitial` | Interstitial | Full-screen between games |
| `ecomi_rewarded` | Rewarded | "Watch to continue" video |

Each ad unit generates an **Ad Unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`).

### Development vs Production Keys

**Development:** Always use Google's test Ad Unit IDs during development. Using real ad units in dev risks account suspension.

| Type | iOS Test ID | Android Test ID |
|---|---|---|
| Banner | `ca-app-pub-3940256099942544/2934735716` | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `ca-app-pub-3940256099942544/4411468910` | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/1712485313` | `ca-app-pub-3940256099942544/5224354917` |

**Production:** Use the real Ad Unit IDs from the step above. Switch based on environment:

```typescript
import { Platform } from "react-native"

const isProduction = !__DEV__

export const AD_UNIT_IDS = {
  banner: isProduction
    ? Platform.select({
        ios: "ca-app-pub-XXXX/real-banner-ios",
        android: "ca-app-pub-XXXX/real-banner-android",
      })
    : Platform.select({
        ios: "ca-app-pub-3940256099942544/2934735716",
        android: "ca-app-pub-3940256099942544/6300978111",
      }),
  interstitial: isProduction
    ? Platform.select({
        ios: "ca-app-pub-XXXX/real-interstitial-ios",
        android: "ca-app-pub-XXXX/real-interstitial-android",
      })
    : Platform.select({
        ios: "ca-app-pub-3940256099942544/4411468910",
        android: "ca-app-pub-3940256099942544/1033173712",
      }),
  rewarded: isProduction
    ? Platform.select({
        ios: "ca-app-pub-XXXX/real-rewarded-ios",
        android: "ca-app-pub-XXXX/real-rewarded-android",
      })
    : Platform.select({
        ios: "ca-app-pub-3940256099942544/1712485313",
        android: "ca-app-pub-3940256099942544/5224354917",
      }),
}
```

### App Configuration

Add to `app.json` plugins:

```json
[
  "react-native-google-mobile-ads",
  {
    "android_app_id": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
    "ios_app_id": "ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ"
  }
]
```

### app-ads.txt (Required for Production)

Host an `app-ads.txt` file at your developer website (e.g., `https://yourdomain.com/app-ads.txt`) with your publisher ID:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Find your publisher ID at **AdMob Dashboard → Account → Settings**.

### Privacy & Compliance

- **iOS ATT**: Use `expo-tracking-transparency` to request permission before initializing ads. Non-personalized ads still show if denied (lower CPM).
- **GDPR**: Configure a consent message in AdMob under **Privacy & messaging**. `react-native-google-mobile-ads` includes UMP (User Messaging Platform) support.
- **COPPA**: If targeting children under 13, tag requests with `tagForChildDirectedTreatment: true`.

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| iOS App ID | `app.json` plugin config | AdMob Dashboard → Apps → Eco Mi (iOS) → App settings |
| Android App ID | `app.json` plugin config | AdMob Dashboard → Apps → Eco Mi (Android) → App settings |
| Banner Ad Unit ID (per platform) | Ad request code | AdMob Dashboard → Ad Units |
| Interstitial Ad Unit ID (per platform) | Ad request code | AdMob Dashboard → Ad Units |
| Rewarded Ad Unit ID (per platform) | Ad request code | AdMob Dashboard → Ad Units |
| Publisher ID | `app-ads.txt` | AdMob Dashboard → Account → Settings |

---

## PostHog

### Sign Up

1. Go to [posthog.com](https://posthog.com) and create an account.
2. Free tier includes 1M events/month — more than enough for a casual game at launch.
3. Choose **US** or **EU** data residency (EU recommended if targeting European users for GDPR simplicity).

### Project Setup

1. Create a new project named "Eco Mi".
2. Note the **Project API Key** (starts with `phc_`). This is a public key — it identifies the project but cannot read data.

### Integration

No native module or config plugin needed. `posthog-react-native` is a pure JS SDK:

```bash
npx expo install posthog-react-native
```

Initialize in the app root with the key from `.env`:

```typescript
import { PostHogProvider } from "posthog-react-native"

<PostHogProvider
  apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
  options={{ host: "https://us.i.posthog.com" }}
>
  {children}
</PostHogProvider>
```

### Keys Produced

| Key | Where It's Used | How to Get It |
|---|---|---|
| Project API Key (`phc_...`) | `EXPO_PUBLIC_POSTHOG_KEY` env var, PostHogProvider init | PostHog Dashboard → Project Settings → Project API Key |

Note: The key prefix `EXPO_PUBLIC_` makes it available in the JS bundle at runtime. This is intentional — PostHog project keys are public (write-only, cannot read data). It's the same security model as Google Analytics measurement IDs.

---

## App Configuration Reference

Once all accounts are set up, the `app.json` plugins array should look like:

```json
{
  "plugins": [
    "expo-localization",
    ["expo-font", { "fonts": ["./assets/fonts/Oxanium-*.ttf"] }],
    ["expo-splash-screen", { ... }],
    ["react-native-edge-to-edge", { ... }],
    "expo-router",
    ["react-native-audio-api", { ... }],
    "react-native-purchases",
    "expo-tracking-transparency",
    [
      "react-native-google-mobile-ads",
      {
        "android_app_id": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
        "ios_app_id": "ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ"
      }
    ]
  ]
}
```

---

## Security — Open Source Considerations

**This repository is public.** All secrets, tokens, and API keys must be kept out of version control. The following safeguards are in place:

### What's Protected

| Secret | Risk if Exposed | Storage Location |
|---|---|---|
| RevenueCat API Keys | Attacker could query purchase data | `.env` (gitignored) + EAS Secrets |
| AdMob App IDs | Low risk (required at build time), but avoids ad fraud targeting | `.env` (gitignored) for prod IDs |
| PostHog Project API Key | Low risk (write-only, public by design) | `.env` via `EXPO_PUBLIC_` prefix (available in bundle, same as GA measurement IDs) |
| AdMob Ad Unit IDs (production) | Could be used to generate fraudulent impressions | `.env` (gitignored) + EAS Secrets |
| App Store Connect API Key (.p8) | Full App Store Connect access — submit builds, manage metadata | EAS Secrets only |
| Google Play Service Account JSON | Full Play Console API access — publish builds, manage IAP | EAS Secrets only |
| Android Keystore (.jks) | Could sign malicious APKs as your app | EAS managed or offline secure storage |
| App-Specific Shared Secret (Apple) | Receipt validation bypass | RevenueCat dashboard only (never in code) |

### Gitignore Rules

The `.gitignore` already covers:

```
.env
.env.*
!.env.example
*.jks
*.p8
*.p12
*.key
*.mobileprovision
```

### For Contributors

1. Copy `.env.example` to `.env` and fill in your own development keys.
2. **Never** hardcode keys in source files. Always read from environment variables.
3. Use Google's test Ad Unit IDs (listed in the [AdMob section](#development-vs-production-keys)) during development — they are safe to use without a real AdMob account.
4. RevenueCat has a sandbox mode that works with App Store / Play Store sandbox environments — no production keys needed for development.

### For the Maintainer

**Local development:**
- Create `.env` with your real keys (gitignored).
- The app reads these via `expo-constants` or a config helper at runtime.

**CI/CD (EAS Build):**
- Store all secrets in [EAS Secrets](https://docs.expo.dev/build-reference/variables/) (`eas secret:create`).
- EAS injects these as environment variables during cloud builds.
- Secrets are encrypted at rest and never appear in build logs.

```bash
# Set secrets for EAS builds
eas secret:create --name REVENUECAT_IOS_KEY --value "appl_XXXX" --scope project
eas secret:create --name REVENUECAT_ANDROID_KEY --value "goog_XXXX" --scope project
eas secret:create --name ADMOB_BANNER_IOS --value "ca-app-pub-XXXX/YYYY" --scope project
eas secret:create --name ADMOB_BANNER_ANDROID --value "ca-app-pub-XXXX/YYYY" --scope project
eas secret:create --name ADMOB_INTERSTITIAL_IOS --value "ca-app-pub-XXXX/YYYY" --scope project
eas secret:create --name ADMOB_INTERSTITIAL_ANDROID --value "ca-app-pub-XXXX/YYYY" --scope project
eas secret:create --name ADMOB_REWARDED_IOS --value "ca-app-pub-XXXX/YYYY" --scope project
eas secret:create --name ADMOB_REWARDED_ANDROID --value "ca-app-pub-XXXX/YYYY" --scope project
```

**AdMob App IDs in `app.json`:**
The `react-native-google-mobile-ads` plugin requires App IDs at build time in `app.json`. Since this repo is public, use `app.config.ts` (dynamic config) to read these from environment variables instead of hardcoding them:

```typescript
// app.config.ts
export default ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    [
      "react-native-google-mobile-ads",
      {
        android_app_id: process.env.ADMOB_APP_ID_ANDROID,
        ios_app_id: process.env.ADMOB_APP_ID_IOS,
      },
    ],
  ],
})
```

### If a Secret is Accidentally Committed

1. **Rotate the key immediately** — regenerate it in the service's dashboard.
2. Run `git filter-branch` or use [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to scrub it from history.
3. Force-push the cleaned history.
4. Assume the old key is compromised regardless of how quickly you act.

### .env.example

A template is provided at the repo root (`.env.example`) with placeholder values. This file **is** committed so contributors know which variables are needed.

---

## Checklist

Use this to track account setup progress:

### Phase 1 (no external accounts needed)

- [ ] Development builds working via EAS

### Phase 2 (monetization)

**Apple:**
- [ ] Apple Developer Program enrollment active
- [ ] App Store Connect app created (Bundle ID: `com.frankcalise.ecomi`)
- [ ] IAP products created (7 products)
- [ ] App-Specific Shared Secret generated (for RevenueCat)

**Google:**
- [ ] Google Play Console registration complete
- [ ] App created (Package: `com.frankcalise.ecomi`)
- [ ] IAP products created (7 products, IDs match iOS)
- [ ] Service Account JSON created (for RevenueCat)

**RevenueCat:**
- [ ] Account created, project "Eco Mi" set up
- [ ] iOS app configured with shared secret
- [ ] Android app configured with service account JSON
- [ ] Products imported from both stores
- [ ] Entitlements created (7 entitlements)
- [ ] Default offering configured
- [ ] iOS Public API Key noted
- [ ] Android Public API Key noted

**AdMob:**
- [ ] AdMob account created and verified
- [ ] iOS app registered, App ID noted
- [ ] Android app registered, App ID noted
- [ ] 3 ad units created per platform (banner, interstitial, rewarded)
- [ ] Ad Unit IDs noted
- [ ] Privacy & messaging consent configured (GDPR)
- [ ] `app-ads.txt` hosted at developer website

**PostHog:**
- [ ] Account created, project "Eco Mi" set up
- [ ] Data residency selected (US or EU)
- [ ] Project API Key noted

**App Config:**
- [ ] `react-native-purchases` plugin added to `app.json`
- [ ] `react-native-google-mobile-ads` plugin added with App IDs
- [ ] `expo-tracking-transparency` plugin added
- [ ] `.env` file created with all keys (gitignored)
- [ ] EAS Secrets configured for CI/CD builds
