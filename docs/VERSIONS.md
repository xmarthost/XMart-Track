# Versions

From 2.0.0 on, every update has ONE version number for server, web and apps, kept in the file `VERSION`.
When `VERSION` changes, GitHub Actions publishes the release **vX.Y.Z** with:
- the Android APK of that version,
- the web interface build (for VPS that cannot build it),
- the list of changes since the previous version,
- the command to install exactly that server version.

Roll back the server to a version (database, users and settings are kept):

```bash
curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/xmart-web-ui/install.sh | bash -s -- --version v2.0.0 --domain xmarttrack.site
```

Roll back the app: download `XMartTrack.apk` from the release vX.Y.Z and install it over the current app.

All releases: https://github.com/xmarthost/XMart-Track/releases

| Version | Date | What it is |
|---|---|---|
| v2.3.0 | 2026-11-29 | MiCODUS MV710G support: model in the vehicle settings (JT808, port 5015), its own command list (relay fuel cut, timer, overspeed, centre/SOS numbers, status), text commands and replies over JT808; unsupported commands are greyed out per tracker; armed / door / battery shown when a tracker reports them. |
| v2.2.1 | 2026-11-29 | Pro layout: full-screen map while a vehicle is open (no header or tab bar), one small top card, a small details popup on the car (tap the car to show / hide), slimmer button bar. |
| v2.2.0 | 2026-11-29 | New Pro layout (address and details cards, five big buttons, More page with all functions); up to 3 SOS numbers; new animated start screen; Classic stays the default layout. |
| v2.1.0 | 2026-11-28 | Layouts change the whole map screen (new Full Map layout, compact and big vehicle cards, button styles); fast share-location page; fix for the error on shared links. |
| v2.0.1 | 2026-11-28 | Fix: app stayed on the green start screen after updating to 2.0.0. |
| v2.0.0 | 2026-11-28 | Phase 1: 5 layouts, Light / XMart Teal / Dark themes, vehicle icons and colours, trips report, live share link, moved-while-parked alarm, automatic history cleanup, version releases. |

## Earlier versions (before 2.0.0, by commit)


Each server version below is a commit. To install an older (or newer) version on the VPS, run the installer
with `--version <full commit hash>`; the database, admin account and settings are kept. To go back to the
newest code, run it with `--branch xmart-web-ui`.

```bash
curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/xmart-web-ui/install.sh | bash -s -- --version da36571cb53319206e729e1fd36880a7f74d87b1 --domain xmarttrack.site
```

| Version | Commit (use with --version) | Date (PKT) | What it is |
|---|---|---|---|
| v1.0.0 | `738c9cfc985f545d2e95ec310dea0ea305cc262b` | 20 Nov | Original Traccar code the project started from. |
| v1.1.0 | `290ad42ed051232c7ddaaa4a3e84ac3d07edb3d8` | 21 Nov 13:08 | Version that was live when tracking was confirmed working (21 Nov 13:56, moving 49 km/h). |
| v1.2.0 | `f5f7ff4f44ce7c3033994f8083b0b6635957e389` | 21 Nov 13:30 | v1.1.0 + tracker time read as UTC (5-hour shift fix). |
| v1.3.0 | `da36571cb53319206e729e1fd36880a7f74d87b1` | 22 Nov 12:12 | Original GT06 replies restored, Firebase off, queue protection, G19S voltage. |
| v1.4.0 | `16822ba465d359ab8fceb9ac5b40d531f738c695` | 23 Nov | Green line only from real GPS fixes while driving (web + app); versioned APKs; installer `--version`. |
| v1.5.0 | newest `xmart-web-ui` | 23 Nov | Server, web and app set back to v1.1.0 with the live green line removed (see REMOVED-FEATURES.md). |

## Android app

From now on every APK build is also published as its own release `android-v<build>` (next to
`android-latest`), so an older app can be installed again. Builds before this change are in the
GitHub Actions runs (artifact `XMartTrack-apk`, kept for 90 days).

## 2026-11-24: back to the latest version

The tracking problem was the tracker itself (fixed by taking it out and resetting it). Server, web and app
are back on v1.4.0's code, Firebase push is switched on again by the installer when
`/root/firebase-service-account.json` is on the server, and the later installer fixes (swap on small VPS,
`--domain` change, port 443 warning) and the diagnose network section are kept. Called v1.6.0.
The two updates rolled back on 21 Nov (`583f9fb`, `8dcfcba`, see ROLLBACKS.md) are still out.
