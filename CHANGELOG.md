# Changelog

## 2026-05-27

### Fixed
- **Multi-month rest periods now create a group for each spanned month** — a 24-hr rest entry whose end date (`restDayEnd`) falls in a later month now appears in every month group it covers, so months with no other entries are no longer invisible in the flight log.

## 2026-05-26

### Added
- **Month-grouped collapsible flight log** — entries are grouped by calendar month with a tappable header row showing the month name and a leg/rest-day count. Tap a header to collapse or expand that month. Previous months collapse automatically on first load; the current month stays expanded. Per-month preferences are persisted to `localStorage` (`far135_collapsed_months`) and correctly handle new historical months, timezone changes, and PWA cached bundles crossing a month boundary.
- **Localized placeholder airports** — Dep/Arr ICAO placeholders updated to KSJC/KSNA
- **Carry-forward on multi-leg days** — when tapping "+ Add Another Leg", the new leg's Dep ICAO is pre-filled with the preceding leg's Arr ICAO, and Off Blocks (Hobbs) is pre-filled with the preceding leg's On Blocks value.

## 2026-05-19

### Added
- **"How to Use This Tool" card** — moved from inside the quick reference to a standalone collapsible card near the top of the page (below the regulatory note); defaults to collapsed
- **Collapsible quick reference** — the §135.267 Quick Reference card at the bottom of the page can now be expanded/collapsed by tapping the header; defaults to collapsed and remembers the preference across sessions
- **Install banner** — users viewing the app in a browser (mobile or desktop) see a one-time dismissible prompt with platform-specific instructions for adding the app to their home screen; hidden automatically when already running as an installed PWA

### Fixed
- **Last Rolling 24-hr tile clears when window expires** — the tile now shows `—` with "Window cleared" once more than 24 hours have passed since the last release time, rather than showing a stale accumulated total that no longer has regulatory significance
- **Date/time field height mismatch** — time inputs now render at the same height as their paired date inputs

### Changed
- **Show Time date defaults to today** — the date field in the Add Entry form now pre-fills with today's local date instead of being blank
- **Native time picker on all time fields** — Show Time, Release Time, Rest Start, and Rest End now use `type="time"` in both the Add Entry form and Edit modal, bringing up the OS scroll-wheel/clock picker on mobile instead of the keyboard

## 2026-05-18

### Fixed
- **Part 91 row contrast in dark mode** — "Excluded (Part 91)" text, the Part 91 badge, row background, and N/A exceedance badge now use dark-mode-aware colors (`amber-400`, `amber-950`) so they're legible on the dark slate background
- **Dashboard tiles uniform height** — "Next Legal Duty" subtitle shortened so it fits on one line at 3-column width (iPad mini portrait); all six tiles in both rows now render at the same height
- **Quick Reference tile updated** — removed outdated "+ 0.2 taxi time" language from the "How to Use This Tool" section; flight time description now correctly reads `On Hobbs − Off Hobbs`



### Changed
- **Quarterly report stat boxes are now uniform** — all four boxes share identical fixed width and height; the Part 91 leg count moves to a dedicated sub-line with `line-height: 1` so filled and empty sub-lines render at the same pixel height

### Fixed
- **Next Legal Duty tile now auto-updates** — the tile previously froze at page-load time and would not flip to "Legal" until the browser was refreshed; it now recalculates every 60 seconds
- **Edit modal loads correct entry** — switched from a `useEffect`-based state reset to React's `key`-based remount pattern, eliminating a lint warning and ensuring the modal always reflects the selected entry

### Changed
- **Hobbs flight time is now exact** — removed the 0.2-hour taxi allowance from Hobbs calculations; flight time is now `onHobbs − offHobbs` with no addition
- **Quarterly report honors dark/light mode** — the generated report now matches the app's current theme
- **Quarterly report flight log defaults to daily summary** — shows total Part 135 and Part 91 hours per day (and rest day markers) instead of a full per-leg table; a "Show Full Log" button reveals the detailed view

## 2026-05-16

### Added
- **Simplified rest day entry** — checking "24-hour rest day" now collapses the duty period, flight legs, and rest period fields and shows a self-contained date picker. Rest days can be logged without entering any duty or flight data — just the date (and optional end date for multi-day ranges).

### Fixed
- Rest days are now stored as UTC (Zulu) to match flight leg timestamps. Previously, rest day dates were stored in browser local time, which could cause incorrect 10-hr lookback results when the browser timezone differed from the app's selected timezone.
- Flight log now displays rest days as a local calendar date (e.g. `05/15`) rather than a UTC timestamp, since rest days are all-day markers rather than point-in-time events.

## 2026-05-15

### Added
- **UTC time storage** — all timestamps are now stored as Zulu (UTC) internally. Times entered in the app are converted from your local timezone on save and stored with a `Z` suffix; all timestamps in the flight log display with a `Z` suffix to make the timezone unambiguous. This prevents calculation errors when crossing timezone boundaries between duty periods.
- **Timezone selector** — a timezone picker in the header (e.g. "AKDT") sets the timezone used for all time entry and display. Change it any time; stored entries are unaffected since they're already in UTC.
- **Local-time input with UTC preview** — Show Time, Release Time, and Rest period fields accept times in your selected local timezone. A live `→ 03:15Z on 05/15` preview appears as you type so you can sanity-check the UTC conversion before saving.
- **One-time migration dialog** — on first load after this update, existing users are prompted to confirm whether their previous entries were recorded in local time or already in UTC. Choosing local time presents a timezone picker; each entry is converted individually using the correct DST offset for that entry's date.
- **"Next Legal Duty Start" dashboard tile** — replaces "Last Rest Period". Shows the earliest time you can legally begin a new duty period (release time of your last leg + required rest based on §135.267 excess flight time rules). Displays in your local timezone with the Zulu equivalent in the subtitle. Green when already legal; amber when less than an hour away; red when still in the rest requirement window.

### Fixed
- Quarterly report page had no way to return to the app — added a Close button alongside the Print button
- "Last Rolling 24-hr" dashboard stat showed — when the most recent logged leg was Part 91 (e.g. a repositioning flight home); the accumulated Part 135 hours in the window are now shown correctly regardless of whether the last leg is Part 91

## 2026-05-14

### Added
- Form draft autosave: all fields (show time, release time, legs, rest period, pilot name, crew config) are continuously saved to localStorage as you type; the form is fully restored if the app is closed, refreshed, or the phone sleeps mid-duty
- "Clear form" link to discard the draft without submitting; draft is automatically cleared after a successful Add Entry

### Repository
- Git history reset: repository restructured so `far135-react/` is the repo root rather than a subdirectory of a shared parent. Full project history preserved in this changelog.

## 2026-05-06

### Added
- Multi-day rest day ranges: set an end date when logging consecutive rest days; each day in the range counts individually toward the quarterly 13-day requirement, including across quarter boundaries
- In-app update banner: a "Update available / Refresh" bar appears at the bottom of the screen when a new version is deployed, eliminating the need to manually kill and reload the app

### Fixed
- Date input height inconsistency on iPad mini — native iOS date control now respects the same height as adjacent time inputs
- Rest day row in the flight log now respects dark mode
- PWA home screen icon no longer shows a white border on iOS — transparent corners filled with the app background color
- Non-null assertions on `ms()` replaced with null-safe coalescing

## 2026-04-26

### Added
- Custom altimeter-style PWA icon with airplane silhouette
- GitHub Actions workflow to build and deploy the React app to GitHub Pages

## 2026-03-31

### Added
- React / Vite / Tailwind / shadcn rewrite of the tracker
- PWA support via vite-plugin-pwa with full offline caching
- Off/on blocks switched from clock times to Hobbs meter readings (0.2 hr taxi addition)

### Fixed
- Add Entry button visibility in dark mode

## 2026-03-30

### Added
- Initial release of FAR 135.267 duty & flight time tracker PWA
