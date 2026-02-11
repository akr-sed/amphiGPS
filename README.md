# AmphiGPS – Amphitheatre Attendance GPS Logger

A minimal, mobile-first web app for collecting GPS coordinates and labeling them **IN** or **OUT** to build an amphitheatre attendance dataset. No backend, no frameworks — just HTML, CSS, and vanilla JavaScript.

All data is stored in the browser's `localStorage` and can be exported as CSV at any time.

---

## Quick Start

### Option 1: Open locally (desktop testing only)

```bash
# Just open the file in your browser
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

> ⚠️ **Geolocation will only work over HTTPS or on `localhost`.** Opening `index.html` via `file://` will work on some desktop browsers but **will fail on mobile**. Use one of the hosting options below for phone testing.

### Option 2: Local HTTPS via simple server

```bash
# Using Python (serves on http://localhost:8000)
python3 -m http.server 8000

# Then open http://localhost:8000 in your browser
```

For testing on your phone over the local network, use a tool like [mkcert](https://github.com/FiloSottile/mkcert) + a local HTTPS server, or use one of the free hosting options.

### Option 3: GitHub Pages (recommended for phone use)

1. Create a GitHub repo and push all files (`index.html`, `style.css`, `app.js`).
2. Go to **Settings → Pages** → set source to `main` branch, root folder.
3. Your app will be live at `https://<username>.github.io/<repo>/`.
4. Open the URL on your phone — geolocation will work over HTTPS.

### Option 4: Netlify

1. Go to [app.netlify.com](https://app.netlify.com).
2. Drag-and-drop the project folder onto the deploy area.
3. Done — you get an HTTPS URL instantly.

---

## Usage

1. **Open the app** on your phone (via HTTPS).
2. **Allow location access** when prompted.
3. Tap **Capture IN** or **Capture OUT**.
4. Wait for the GPS reading (a spinner shows while acquiring).
5. Review the **Pending Capture** panel:
   - Check accuracy. A warning appears if accuracy exceeds the threshold (default: 20 m).
   - Optionally type a note.
   - Tap **OK (Save)** to accept, or **Discard** to throw it away.
6. Saved points appear in the table below (latest first).
7. Tap **Export captured so far** to download a `.csv` file.
8. Use **Clear all data** (requires double confirmation) to wipe everything.

---

## CSV Format

```
timestamp_iso,label,lat,lon,accuracy_m
2026-02-11T09:12:01.123Z,IN,36.752431,3.042110,8.4
```

If the **"Include notes column in CSV"** toggle is enabled in Settings:

```
timestamp_iso,label,lat,lon,accuracy_m,notes
2026-02-11T09:12:01.123Z,IN,36.752431,3.042110,8.4,"row 5 seat 3"
```

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Accuracy threshold | 20 m | If a reading's accuracy is worse (higher) than this value, a warning is shown. You can still save — it's just informational. |
| Include notes in CSV | Off | When enabled, the exported CSV gets an extra `notes` column. |

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Semantic HTML structure |
| `style.css` | Mobile-first responsive styles |
| `app.js` | All application logic (geolocation, storage, export) |
| `README.md` | This file |

---

## Technical Notes

- **Geolocation**: Uses `navigator.geolocation.getCurrentPosition()` with `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`. Each tap fetches a fresh reading.
- **Storage**: Data persists in `localStorage` under the key `amphigps_samples`. Survives page reloads and browser restarts.
- **Export**: Generates a Blob CSV and triggers download via a temporary `<a>` element.
- **No service worker**: The app does not include a service worker. It requires a network connection for the initial load but no ongoing connectivity (GPS works offline, data is stored locally).

---

## Testing Checklist

### Android Chrome
- [ ] Host the app over HTTPS (GitHub Pages, Netlify, or local HTTPS server).
- [ ] Open the URL in Chrome on Android.
- [ ] Tap **Capture IN** → allow location permission when prompted.
- [ ] Verify the spinner appears, then the Pending Capture panel shows lat/lon/accuracy.
- [ ] Tap **OK (Save)** → verify it appears in the table and counters update.
- [ ] Tap **Capture OUT** → **Discard** → verify nothing is added.
- [ ] Test with poor GPS (indoors) to see the accuracy warning.
- [ ] Tap **Export** → verify CSV downloads with correct filename and data.
- [ ] Reload the page → verify data persists (table and counters restore).
- [ ] Tap **Clear all data** → confirm twice → verify everything is wiped.

### iPhone Safari
- [ ] Same HTTPS requirement applies.
- [ ] Open the URL in Safari on iOS.
- [ ] When prompted, tap **Allow** for location access.
- [ ] Run through the same capture → save → export → clear flow.
- [ ] Note: iOS Safari may show a separate system-level location prompt the first time.
- [ ] Verify CSV download works (Safari may open it in a preview — tap the share icon to save).
- [ ] Test adding to Home Screen (Add to Home Screen from Share menu) for an app-like experience.

---

## License

MIT — use freely.
