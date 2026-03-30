# FAR 135.267 Duty & Flight Time Tracker

A Progressive Web App (PWA) for Part 135 unscheduled operations pilots to track flight time, duty, rest, and quarterly limits in compliance with **14 CFR §135.267**.

> **For reference and record-keeping only.** Always verify compliance with your OpSpec, POI, and company manual.

---

## Features

- **Rolling 24-hour flight time** — tracks 8-hour (single pilot) and 10-hour (dual pilot) limits
- **10-hour look-back rest check** — flags if required rest was not received before a flight segment
- **14-hour duty day tracking** — show time to release time
- **Quarterly rest day counter** — tracks the 13 required 24-hour rest periods per calendar quarter
- **Exceedance rest multiplier** — automatically calculates required rest after a flight time exceedance (<30 min → 11 hr, 30–60 min → 12 hr, >60 min → 16 hr)
- **Multi-leg duty entry** — log multiple legs per duty period in one step
- **Part 91 leg flag** — log positioning or Part 91 flights without affecting §135 limits
- **Edit entries** — correct any entry after the fact
- **Quarterly report** — printable HTML summary; downloads as a file when installed as a PWA
- **CSV export** — export your full flight log
- **Offline capable** — works without an internet connection once installed
- **Installable** — add to your phone or desktop home screen like a native app

---

## How to Use

1. Open the app on your phone or desktop
2. Tap **Add Entry** to log a flight leg
3. Fill in Show Time, Release Time, Off/On Blocks, and rest period
4. For multi-leg days, tap **+ Add Another Leg** before submitting
5. Mark rest days using the checkbox — these count toward your quarterly 13
6. View your live compliance status on the **Summary** tab
7. Use **Flight Log** to review history, export CSV, or generate a quarterly report

---

## Installation (PWA)

On mobile: open the site in your browser, tap **Share → Add to Home Screen**
On desktop: look for the install icon in the browser address bar

Data is stored locally on your device using `localStorage` — nothing is sent to any server.

---

## Regulatory Reference

14 CFR §135.267 — Flight time limitations and rest requirements: Unscheduled one- and two-pilot crews.

---

## License

MIT License — Copyright (c) 2026 William Lawton. See [LICENSE](LICENSE) for details.
