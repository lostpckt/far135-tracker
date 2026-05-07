# Changelog

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

## 2026-04-10

### Changed
- Quarterly report now opens as an in-app overlay instead of a new browser window

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
