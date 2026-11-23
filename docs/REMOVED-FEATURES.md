# Features removed on 2026-11-23 (owner's request)

The server, web and Android app were set back to commit `290ad42` (21 Nov 2026, 13:08 PKT), the version that
was live when tracking was confirmed working. The live green line was also removed. Everything below is
kept in git and can be added back on request (`git cherry-pick <commit>` or `git checkout <commit> -- <file>`).

Kept from later work: the installer (`install.sh`: tracker time as UTC, Firebase off, `--version`),
`scripts/diagnose.sh`, `scripts/gt06-test.py`, the docs, and the workflow that keeps every APK as a version.

## Removed

| Feature | Commit(s) | Area |
|---|---|---|
| Live green line behind the car (app monitor map) | `d863d43`, `290ad42`, `c972b84` | app |
| Live route line on the web map (`MapLiveRoutes`) | Traccar original, `c972b84` | web |
| App shows car voltage from recent data | `f5f7ff4` | app |
| North-up map, no touch rotate/tilt (web + app) | `d673833` | web, app |
| G19S voltage decoding (info 0x94, status byte after GSM) | `c6c6af8`, `14de7ac`, `aec06b2` | server |
| Web card shows vehicle name when no driver is set | `baa3e35` | web |
| Firebase push notifications (server + app), readable push text, logo icon | `410d88d`, `1647af7`, `583f9fb`, `242e711` | server, app |
| Notification setup screen (permission, battery, Xiaomi autostart) | `16de4d1` | app |
| Green line from trip start (already rolled back once) | `8dcfcba` | web, app |
| Failing notification never stops the position queue | `98066e9` | server |
| GPS-ACK changes (removed then restored) | `07a291f`, `da36571` | server |
| "Moving" only with a GPS fix of the last 3 minutes | `369e499` | web, app |
| Firebase gating of app push registration | `da36571` | app |
