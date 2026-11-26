# Google Play: ready-to-paste answers for XMart Track

Files in this folder: `icon-512.png` (app icon), `feature-graphic-1024x500.png` (feature graphic).
Screenshots: take 4–8 from the phone (Monitor map with a car, vehicle card, playback, alerts, geofence,
commands). Phone screenshots 1080×2400 are fine. Hide real addresses or numbers if wanted.

## Main store listing
- **App name:** XMart Track
- **Short description (max 80):** Live GPS vehicle tracking with ACC alerts, playback, geofences and WhatsApp.
- **Category:** Maps & Navigation (or Auto & Vehicles). **Tags:** vehicle tracking, fleet, GPS tracker.
- **Full description:**

```
XMart Track shows your vehicles live on the map from GPS trackers installed in them.

• Live tracking: the car moves smoothly on the map, with speed, direction, ignition (ACC) and battery voltage
• Journey line: see the whole current trip on the roads, from where the car started
• Playback: replay any day's route, with stops skipped
• Alerts: ignition on/off, overspeed, alarms and geofence enter/exit, as app notifications and on WhatsApp
• Per-vehicle WhatsApp numbers: each family member gets the alerts of their own car
• Geofences: circle or polygon areas, always on, daily, on chosen days or one time
• Live traffic layer, Google and free maps, satellite view
• Tracker commands: upload interval, status, location and more, over the internet or by SMS
• Reports and fleet overview

An XMart Track account is required. Vehicles are added by IMEI of the GPS tracker.
```

- **Contact details:** a support email (required, shown publicly), optional phone and website
  `https://xmarttrack.site`.
- **Privacy policy:** `https://xmarttrack.site/privacy.html`

## App content (Policy → App content)
| Section | Answer |
|---|---|
| Privacy policy | `https://xmarttrack.site/privacy.html` |
| App access | **All or some functionality is restricted** → add the reviewer login (see below) |
| Ads | No, the app has no ads |
| Content rating | Questionnaire: category "Utility, Productivity, Communication or Other"; answer No to violence, sexual content, gambling, etc.; users interact: No (no chat between users) → rated Everyone / 3+ |
| Target audience | 18 and over |
| News app | No |
| COVID-19 app | No |
| Data safety | see below |
| Government app | No |
| Financial features | No |
| Health | No |
| Account deletion | Yes, users can delete their account in the app; web link `https://xmarttrack.site/delete-account.html` |

### Reviewer login (App access)
Create on the server (web → Settings → Users) a user only for Google, e.g. `playreview@xmarttrack.site`
with a strong password, give it one vehicle (share a demo or real vehicle with it) and write:

```
Login: playreview@xmarttrack.site
Password: ********
Server: https://xmarttrack.site (already filled on the login screen)
Steps: log in → Monitor shows the vehicle on the map → tap it for details, playback, alerts, geofence.
```
Do not make this user an administrator. Keep the account working while the app is reviewed.

## Data safety form
**Does the app collect or share user data?** Yes. **Encrypted in transit?** Yes (HTTPS).
**Can users request deletion?** Yes (in the app and at `https://xmarttrack.site/delete-account.html`).

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Location → Precise location (vehicle GPS from the tracker) | Yes | No | Required | App functionality |
| Personal info → Name | Yes | No | Required | Account management |
| Personal info → Email address (login) | Yes | No | Required | Account management |
| Personal info → Phone number (alert numbers) | Yes | Yes (WhatsApp/SMS gateway, to deliver alerts) | Optional | App functionality |
| Device or other IDs (push token) | Yes | Yes (Google Firebase, to deliver notifications) | Optional | App functionality |

The app does not collect the phone's own location, contacts, photos, files, health, financial or browsing data,
and does not use data for ads or analytics.

## Permissions (Play version)
`INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` only. No location,
background location, install-packages, battery-optimisation or overlay permissions, so no permission
declaration forms are needed.
