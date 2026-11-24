# XMart Track — working rules

- Branch `xmart-web-ui`. Each server/web push creates a GitHub release `server-v<n>`; each app push creates
  `android-v<n>` / `ios-v<n>`. Commit titles are user-facing: they appear in the app's "What's new" window
  and in the release notes, so write them in plain words.
- Mobile app (mobile/): every screen must keep its last buttons above the phone's navigation bar.
  Use `useContentStyle()` from `src/components/ui.jsx` for ScrollView content, and `useSafeAreaInsets()`
  for bottom sheets, modals and fixed footers. Check this for every new screen or sheet.
- Do not change tracker settings by SMS without a clear reason; the 2026-11 tracking problem was the
  tracker itself (see docs/ANALYSIS-2026-11-22.md).
