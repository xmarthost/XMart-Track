# Publishing XMart Track on Google Play

Two Android versions are built from the same code:

| Version | Built by | Updates | Signed with |
|---|---|---|---|
| GitHub APK (`android-latest`) | `.github/workflows/android.yml`, on every app change | in-app "New version released" window (from GitHub) | debug key |
| Google Play AAB (`play-v<n>`) | `.github/workflows/android-play.yml`, started by hand | Google Play | your upload key |

The Play version (`XMART_STORE=play`) leaves out what Play does not allow or restricts: the GitHub
self-update and its `REQUEST_INSTALL_PACKAGES` permission, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
(the Notification setup screen opens the battery settings page instead), unused location permissions
and `SYSTEM_ALERT_WINDOW`.

A phone cannot switch between the two versions with an update (different signing keys): uninstall the
GitHub APK once before installing from Play.

## 1. One-time setup

### Play Console account
1. https://play.google.com/console → create a developer account (25 USD once), verify identity and phone.
2. Personal account: before the first production release, a **closed test with at least 12 testers for
   14 days in a row** is required. Organization account (company, needs a D-U-N-S number): no such test.

### Upload key (keep it forever, with a backup)
On the VPS (Java is installed there) or any computer with Java:

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 upload-keystore.jks > upload-keystore.b64
```

Keep `upload-keystore.jks` and both passwords safe (password manager + an offline copy). If it is lost,
Google support can reset the upload key, but that takes days. Never commit it to the repository.

### GitHub secrets (where the key goes)
The key never goes into the code; GitHub keeps it encrypted and gives it only to the Play build.

1. Open https://github.com/xmarthost/XMart-Track/settings/secrets/actions
   (repository page → **Settings** tab → left menu **Secrets and variables** → **Actions**).
2. Click **New repository secret**, type the **Name**, paste the **Secret**, click **Add secret**.
   Repeat for each row:

| Name | Secret |
|---|---|
| `PLAY_UPLOAD_KEYSTORE_BASE64` | the whole text of `upload-keystore.b64` (one long line) |
| `PLAY_UPLOAD_STORE_PASSWORD` | the keystore password typed in `keytool` |
| `PLAY_UPLOAD_KEY_ALIAS` | `upload` |
| `PLAY_UPLOAD_KEY_PASSWORD` | the key password (same as the keystore password if keytool did not ask separately) |
| `PLAY_SERVICE_ACCOUNT_JSON` | (later, step 4) the whole JSON file of the Play API service account |

To copy `upload-keystore.b64` from the VPS: `cat upload-keystore.b64` and copy the output, or download the
file with WinSCP / `scp root@<vps>:upload-keystore.b64 .` and open it in Notepad.
After adding the secrets, delete the `.b64` copy from the VPS (keep the `.jks` backup somewhere safe):
`rm upload-keystore.b64`.

### Create the app in Play Console
Create app → name "XMart Track", app, free. Ready-to-paste texts, Data safety answers, the reviewer login and
the graphics are in `docs/play/` (`LISTING.md`, `icon-512.png`, `feature-graphic-1024x500.png`).
Then complete **App content**:
- **Privacy policy URL** (required): `https://xmarttrack.site/privacy.html` (in the web app, `traccar-web/public`).
- **Account deletion** (required for apps with accounts): in the app Me → Account → Delete my account, and on
  the web `https://xmarttrack.site/delete-account.html`.
- **App access**: a reviewer login (see `docs/play/LISTING.md`).
- **Data safety**: location (vehicle), personal info (email, phone), app activity; collected, not sold,
  sent encrypted (HTTPS); users can request deletion.
- Ads: no ads. Target audience: 18+. Content rating questionnaire. News app: no. Government app: no.
- **Store listing**: short description (80 characters), full description (4000), icon 512×512 PNG,
  feature graphic 1024×500, at least 2 phone screenshots.

## 2. First release (by hand)
1. GitHub → Actions → **Google Play (AAB)** → Run workflow → track `internal`, status `draft`.
2. Download `XMartTrack.aab` from the GitHub release `play-v<n>` (or the run's artifacts).
3. Play Console → Testing → Internal testing → Create release → accept **Play App Signing** → upload the
   AAB → add testers (email list) → Save → Review → Start rollout.

The Play API cannot create the very first release, so this one is always uploaded by hand.

## 3. Closed test and production
1. Testing → Closed testing → create a track, add at least 12 testers (Google group or email list); each
   tester opens the opt-in link and installs the app. Keep them for 14 days.
2. Dashboard → Apply for production access → answer the questions → after approval:
   Production → Create release → choose the tested build (or upload a new one) → rollout.

## 4. Later versions from GitHub
1. Play Console → Setup → API access → create/link a Google Cloud project → create a service account
   → in Play Console give it access to the app with "Release apps to testing tracks" (and production if
   wanted) → create a JSON key in Google Cloud → put it in the `PLAY_SERVICE_ACCOUNT_JSON` secret.
2. For each new version: Actions → **Google Play (AAB)** → Run workflow → choose the track
   (`internal`, `alpha` = closed, `beta` = open, `production`) and status (`draft` to finish in Play
   Console, `completed` to send it out directly).
3. The workflow builds the AAB (version code 1000 + build number), keeps it as release `play-v<n>` on
   GitHub, writes "What's new" from the latest commit titles and uploads it to Play.
4. Play reviews each update (usually hours, sometimes a few days); users get it through Play.

## 5. Before applying for production: points to settle
- **Map tiles**: the app loads Google map tiles from Google's public tile servers, which is not an
  official Google API. For a public Play app use an official source: Google Map Tiles API (paid, key
  required) or the free Carto/OSM layers within their terms.
- **Live traffic** uses the same unofficial Google tiles: same remark.
- **Road matching (green line)** uses the public OSRM demo server, meant for light use only. With many
  users run an own OSRM server for Pakistan (needs about 4 GB RAM to prepare the map) or use a paid
  map-matching API.
- **Google key in the app** (`app.config.js`): restrict it in Google Cloud to the app's package name and
  SHA-1 (Play App Signing certificate from Play Console → Setup → App signing) and to the APIs used.
- **Push notifications**: Firebase already works with the package name `site.xmarttrack.app`; nothing
  changes for Play.
