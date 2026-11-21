# Rolled-back updates

Updates taken out of the live branch (`xmart-web-ui`) at the owner's request. The code is kept:

- in the git history (the original commits below),
- on the branch `backup/before-rollback-2026-11-21` (the state just before the rollback).

To bring an update back later: `git revert <rollback commit>` or `git cherry-pick <original commit>`,
then push and run the server update / wait for the new APK.

## 2026-11-21 rollback (2 updates)

Reason given: the tracker stopped showing new locations after the SIM change; the owner asked to
undo the last two updates. Note from the logs at that time: the tracker was sending only
heartbeat/status (`78780a13…`), ICCID (`7979…940a…`) and login (`787811 01…`) packets, no GPS
packets, and its status byte (`05`) reported ACC off and no GPS fix while driving, so these two
updates were not shown to be the cause.

### 1. `583f9fb` — Push notifications never include map links
- Area: server (`src/main/java/org/traccar/notificators/NotificatorFirebase.java`).
- What it did: removed any `http(s)://…` link (e.g. the Google Maps link from the SMS template)
  from the text of Firebase push notifications, as a fallback when the readable
  "vehicle / event • time / address" text could not be built.
- Without it: push notifications use the readable text from `1647af7` when the vehicle is known;
  otherwise they show the template text, which can contain the Google Maps link.

### 2. `8dcfcba` — Green line starts where the current trip started
- Areas: mobile app (`mobile/src/state/AppState.js`) and web
  (`traccar-web/src/map/main/TripTrailLoader.js`, `traccar-web/src/main/MainMap.jsx`,
  `traccar-web/src/store/session.js`).
- What it did: when a vehicle is opened, loaded the route since the last ACC ON (last 24 h) from the
  server so the green live line starts at the trip start even if the app/page was closed then;
  reset the line on a new ACC ON; raised the live line length to 3000 points (app and web).
- Without it: the green line is built only from positions received while the app/page is open
  (up to 300 points on the web, 3000 in the app).
