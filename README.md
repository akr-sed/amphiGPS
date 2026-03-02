# AmphiGPS v2.0 – Amphitheatre Attendance GPS Logger

A mobile-first web app for collecting GPS coordinates labeled **IN** or **OUT** to build amphitheatre attendance datasets for ML model training. Supports **stacked amphitheatres** via altitude capture, barometric pressure, and manual floor selection. Optional **Supabase** cloud sync for team data collection.

No backend, no frameworks, no build system — just HTML, CSS, and vanilla JavaScript. Deployable as a static site on Netlify with zero configuration.

---

## Features

- **Multi-amphi + floor selection** — disambiguate stacked amphitheatres on different floors
- **GPS altitude capture** — vertical signal from device GPS
- **Barometric pressure** — secondary altitude estimation via Generic Sensor API
- **Multi-sample GPS averaging** — take 3/5/10 readings and pick the best + compute averages
- **Supabase cloud sync** — offline-first with background sync to a free Supabase database
- **Collector identity** — track who collected each sample
- **Session tracking** — unique session IDs per browser tab
- **Confidence rating** — Low/Medium/High per capture
- **Live GPS preview** — real-time position monitoring with accuracy indicator
- **Mini-map preview** — Leaflet.js map in the capture review panel
- **Session replay map** — view all captures on a fullscreen map
- **Per-amphi stats** — breakdown of IN/OUT counts per amphi/floor
- **PWA support** — installable on home screen, works offline
- **Enhanced CSV export** — metadata header, all fields, configurable columns

---

## Quick Start

### Deploy on Netlify (recommended)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag-and-drop the project folder onto the deploy area
3. Done — you get an HTTPS URL instantly

### Local development

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

> Geolocation requires HTTPS or `localhost`. Use Netlify/GitHub Pages for mobile testing.

---

## Supabase Setup (Cloud Sync)

Cloud sync is **optional**. The app works fully offline without it.

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) (free tier: 500MB storage, 2GB bandwidth).

### 2. Create the table

Run this SQL in the Supabase SQL Editor:

```sql
create table if not exists amphi_samples (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null,
  collector_id    text not null,
  amphi_id        text not null,
  floor           int  not null,
  timestamp_iso   text not null,
  label           text not null check (label in ('IN','OUT')),
  lat             double precision not null,
  lon             double precision not null,
  accuracy_m      double precision,
  altitude_gps    double precision,
  altitude_acc_gps double precision,
  pressure_hpa    double precision,
  baro_alt_m      double precision,
  avg_lat         double precision,
  avg_lon         double precision,
  avg_accuracy_m  double precision,
  n_gps_samples   int,
  confidence      int check (confidence between 1 and 3),
  device_info     text,
  notes           text,
  synced          boolean default false,
  created_at      timestamptz default now()
);

-- Enable Row Level Security and allow anonymous access:
alter table amphi_samples enable row level security;
create policy "Allow anon inserts" on amphi_samples
  for insert to anon with check (true);
create policy "Allow anon selects" on amphi_samples
  for select to anon using (true);
```

### 3. Configure the app

1. In Supabase, go to **Settings > API**
2. Copy the **Project URL** and **anon public key**
3. In AmphiGPS, open **Settings > Cloud Sync (Supabase)**
4. Paste the URL and key, click **Save**
5. Click **Test Connection** to verify

---

## Data Schema

Every saved sample contains:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique per browser tab session (e.g. `20260302-143012-a7f2`) |
| `collector_id` | string | Name/ID of the person collecting data |
| `device_info` | string | `navigator.userAgent` truncated to 200 chars |
| `amphi_id` | string | Selected amphitheatre (e.g. `Amphi B`) |
| `floor` | int | Floor number (0=Ground, 1, 2, 3) |
| `timestamp_iso` | string | ISO 8601 timestamp of GPS reading |
| `label` | string | `IN` or `OUT` |
| `confidence` | int | 1=Low, 2=Medium, 3=High |
| `lat` | float | Latitude of best GPS reading |
| `lon` | float | Longitude of best GPS reading |
| `accuracy_m` | float | Accuracy of best reading (meters) |
| `altitude_gps` | float? | GPS altitude (null if unavailable) |
| `altitude_acc_gps` | float? | GPS altitude accuracy (null if unavailable) |
| `avg_lat` | float | Average latitude across all readings |
| `avg_lon` | float | Average longitude across all readings |
| `avg_accuracy_m` | float | Average accuracy across all readings |
| `n_gps_samples` | int | Number of valid GPS readings used |
| `pressure_hpa` | float? | Barometric pressure in hPa (null if unavailable) |
| `baro_alt_m` | float? | Barometric altitude estimate (null if unavailable) |
| `notes` | string | Optional user notes |
| `synced` | bool | Whether the sample was synced to Supabase |

---

## How It Handles Stacked Amphitheatres

Some amphitheatres are located directly above each other on different floors. GPS latitude/longitude alone cannot distinguish them. AmphiGPS uses a **3-signal approach**:

1. **GPS altitude** — captured from `pos.coords.altitude` when available
2. **Barometric pressure** — captured via the Generic Sensor API (`AbsolutePressureSensor` / `PressureSensor`), converted to altitude using the barometric formula
3. **Manual floor selection** — the collector explicitly selects the floor (G, 1, 2, 3) before each capture

All three signals are stored with every sample, giving your ML model multiple features to disambiguate floors.

---

## Training Your Model

Export data via the **Export CSV** button or query Supabase directly. The CSV includes a metadata header (lines starting with `#`) followed by all fields.

Useful feature columns for training:
- `lat`, `lon`, `accuracy_m` — horizontal position
- `altitude_gps`, `baro_alt_m`, `pressure_hpa` — vertical signals
- `floor`, `amphi_id` — ground truth context
- `avg_lat`, `avg_lon`, `avg_accuracy_m` — averaged position (more stable)

---

## PWA Installation

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap the three-dot menu > **Add to Home screen**
3. The app will launch in standalone mode

### iOS (Safari)
1. Open the app URL in Safari
2. Tap the Share icon > **Add to Home Screen**
3. The app will launch without browser chrome

> Note: PWA icons (`icon-192.png`, `icon-512.png`) should be added to the project root for the best experience. Without them, the browser will use a default icon.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Complete UI markup |
| `app.js` | All application logic (~1200 lines, vanilla JS IIFE) |
| `style.css` | Mobile-first responsive styles (~950 lines) |
| `db.js` | Supabase integration module |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker for offline-first caching |
| `README.md` | This file |

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `amphigps_samples` | Array of sample objects |
| `amphigps_session_amphi` | Last selected amphitheatre |
| `amphigps_session_floor` | Last selected floor |
| `amphigps_collector_id` | Collector name/ID |
| `amphigps_supabase_url` | Supabase project URL |
| `amphigps_supabase_key` | Supabase anon key |
| `amphigps_settings` | JSON object with app settings |

---

## License

MIT — use freely.
