# Versions

Every server version has a git tag. To install an older (or newer) version on the VPS, run the installer
with `--version <tag>`; the database, admin account and settings are kept.

```bash
curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/xmart-web-ui/install.sh | bash -s -- --version v1.3.0 --domain xmarttrack.site
```

| Tag | Commit | Date (PKT) | What it is |
|---|---|---|---|
| `v1.0.0` | `738c9cf` | 20 Nov | Original Traccar code the project started from. |
| `v1.1.0` | `290ad42` | 21 Nov 13:08 | Version that was live when tracking was confirmed working (21 Nov 13:56, moving 49 km/h). |
| `v1.2.0` | `f5f7ff4` | 21 Nov 13:30 | v1.1.0 + tracker time read as UTC (5-hour shift fix). |
| `v1.3.0` | `da36571` | 22 Nov 12:12 | Original GT06 replies restored, Firebase off, queue protection, G19S voltage. |
| `v1.4.0` | `c972b84` | 23 Nov | Green line only from real GPS fixes while driving (web + app); versioned APKs; installer `--version`. |

## Android app

From now on every APK build is also published as its own release `android-v<build>` (next to
`android-latest`), so an older app can be installed again. Builds before this change are in the
GitHub Actions runs (artifact `XMartTrack-apk`, kept for 90 days).
