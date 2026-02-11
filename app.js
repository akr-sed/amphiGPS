/**
 * AmphiGPS – Amphitheatre Attendance GPS Logger
 * All logic for capturing, storing, and exporting GPS samples.
 */

(function () {
  "use strict";

  // ── Constants ──
  const STORAGE_KEY = "amphigps_samples";
  const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  };

  // ── DOM References ──
  const dom = {
    // Counters
    totalCount: document.getElementById("totalCount"),
    inCount: document.getElementById("inCount"),
    outCount: document.getElementById("outCount"),
    // Capture buttons
    btnCaptureIn: document.getElementById("btnCaptureIn"),
    btnCaptureOut: document.getElementById("btnCaptureOut"),
    // Loading
    loadingOverlay: document.getElementById("loadingOverlay"),
    // Pending panel
    pendingPanel: document.getElementById("pendingPanel"),
    pendingLabel: document.getElementById("pendingLabel"),
    pendingLat: document.getElementById("pendingLat"),
    pendingLon: document.getElementById("pendingLon"),
    pendingAcc: document.getElementById("pendingAcc"),
    pendingTime: document.getElementById("pendingTime"),
    notesInput: document.getElementById("notesInput"),
    btnSave: document.getElementById("btnSave"),
    btnDiscard: document.getElementById("btnDiscard"),
    // Accuracy warning
    accuracyWarning: document.getElementById("accuracyWarning"),
    warnAccVal: document.getElementById("warnAccVal"),
    warnThreshVal: document.getElementById("warnThreshVal"),
    // Settings
    accuracyThreshold: document.getElementById("accuracyThreshold"),
    includeNotes: document.getElementById("includeNotes"),
    // Action buttons
    btnExport: document.getElementById("btnExport"),
    btnClear: document.getElementById("btnClear"),
    // Data table
    dataBody: document.getElementById("dataBody"),
    emptyMsg: document.getElementById("emptyMsg"),
  };

  // ── State ──
  let samples = []; // Array of sample objects
  let pendingCapture = null; // Temporary capture awaiting confirmation

  // ── Initialisation ──
  function init() {
    loadFromStorage();
    renderCounters();
    renderTable();
    bindEvents();
  }

  // ── LocalStorage ──

  /** Load samples from localStorage. */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        samples = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Failed to parse stored samples, starting fresh.", e);
      samples = [];
    }
  }

  /** Persist samples to localStorage. */
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      alert("Warning: could not save to localStorage. Storage may be full.");
    }
  }

  // ── Counters ──

  function renderCounters() {
    const inN = samples.filter((s) => s.label === "IN").length;
    const outN = samples.filter((s) => s.label === "OUT").length;
    dom.totalCount.textContent = samples.length;
    dom.inCount.textContent = inN;
    dom.outCount.textContent = outN;
  }

  // ── Data Table ──

  function renderTable() {
    dom.dataBody.innerHTML = "";

    if (samples.length === 0) {
      dom.emptyMsg.classList.remove("hidden");
      return;
    }

    dom.emptyMsg.classList.add("hidden");

    // Show latest first
    const sorted = [...samples].reverse();
    for (const s of sorted) {
      const tr = document.createElement("tr");

      const labelTd = document.createElement("td");
      labelTd.textContent = s.label;
      labelTd.className = "label-cell-" + s.label;

      const timeTd = document.createElement("td");
      // Show a short, readable local time
      timeTd.textContent = formatShortTime(s.timestamp_iso);

      const accTd = document.createElement("td");
      accTd.textContent = s.accuracy_m.toFixed(1);

      const latTd = document.createElement("td");
      latTd.textContent = s.lat.toFixed(6);

      const lonTd = document.createElement("td");
      lonTd.textContent = s.lon.toFixed(6);

      const notesTd = document.createElement("td");
      notesTd.textContent = s.notes || "";

      tr.appendChild(labelTd);
      tr.appendChild(timeTd);
      tr.appendChild(accTd);
      tr.appendChild(latTd);
      tr.appendChild(lonTd);
      tr.appendChild(notesTd);

      dom.dataBody.appendChild(tr);
    }
  }

  /** Format ISO timestamp to a compact local representation. */
  function formatShortTime(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }

  // ── UI Helpers ──

  /** Show/hide the loading spinner and disable/enable capture buttons. */
  function setLoading(on) {
    if (on) {
      dom.loadingOverlay.classList.remove("hidden");
      dom.btnCaptureIn.disabled = true;
      dom.btnCaptureOut.disabled = true;
    } else {
      dom.loadingOverlay.classList.add("hidden");
      dom.btnCaptureIn.disabled = false;
      dom.btnCaptureOut.disabled = false;
    }
  }

  /** Show the pending capture panel with data. */
  function showPending(label, lat, lon, accuracy, timestamp) {
    pendingCapture = { label, lat, lon, accuracy_m: accuracy, timestamp_iso: timestamp };

    dom.pendingLabel.textContent = label;
    dom.pendingLabel.className = "pending-label-tag label-" + label;
    dom.pendingLat.textContent = lat.toFixed(6);
    dom.pendingLon.textContent = lon.toFixed(6);
    dom.pendingAcc.textContent = accuracy.toFixed(1) + " m";
    dom.pendingTime.textContent = formatShortTime(timestamp);
    dom.notesInput.value = "";

    // Accuracy threshold warning
    const threshold = getThreshold();
    if (accuracy > threshold) {
      dom.warnAccVal.textContent = accuracy.toFixed(1);
      dom.warnThreshVal.textContent = threshold;
      dom.accuracyWarning.classList.remove("hidden");
    } else {
      dom.accuracyWarning.classList.add("hidden");
    }

    dom.pendingPanel.classList.remove("hidden");
    // Disable capture buttons while pending is shown
    dom.btnCaptureIn.disabled = true;
    dom.btnCaptureOut.disabled = true;
  }

  /** Hide the pending panel and re-enable capture buttons. */
  function hidePending() {
    dom.pendingPanel.classList.add("hidden");
    dom.accuracyWarning.classList.add("hidden");
    pendingCapture = null;
    dom.btnCaptureIn.disabled = false;
    dom.btnCaptureOut.disabled = false;
  }

  /** Get the accuracy threshold from the settings input. */
  function getThreshold() {
    const val = parseInt(dom.accuracyThreshold.value, 10);
    return isNaN(val) || val < 1 ? 20 : val;
  }

  // ── Geolocation ──

  /**
   * Request a fresh GPS reading.
   * Returns a Promise that resolves with { lat, lon, accuracy, timestamp }.
   */
  function acquirePosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation API is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          });
        },
        (err) => {
          let msg;
          switch (err.code) {
            case err.PERMISSION_DENIED:
              msg = "Location permission denied. Please allow location access in your browser/OS settings.";
              break;
            case err.POSITION_UNAVAILABLE:
              msg = "Location information is unavailable. Make sure GPS/Location is enabled.";
              break;
            case err.TIMEOUT:
              msg = "Location request timed out. Try again in an open area.";
              break;
            default:
              msg = "Unknown geolocation error: " + err.message;
          }
          reject(new Error(msg));
        },
        GEO_OPTIONS
      );
    });
  }

  // ── Capture Flow ──

  /**
   * Step 1: User taps Capture IN or Capture OUT.
   * Acquire position, then show pending panel.
   */
  async function handleCapture(label) {
    setLoading(true);
    try {
      const pos = await acquirePosition();
      setLoading(false);
      showPending(label, pos.lat, pos.lon, pos.accuracy, pos.timestamp);
    } catch (err) {
      setLoading(false);
      alert("GPS Error:\n" + err.message);
    }
  }

  /** Step 2a: User confirms the pending capture. */
  function handleSave() {
    if (!pendingCapture) return;

    const sample = {
      timestamp_iso: pendingCapture.timestamp_iso,
      label: pendingCapture.label,
      lat: pendingCapture.lat,
      lon: pendingCapture.lon,
      accuracy_m: pendingCapture.accuracy_m,
      notes: dom.notesInput.value.trim(),
    };

    samples.push(sample);
    saveToStorage();
    renderCounters();
    renderTable();
    hidePending();
  }

  /** Step 2b: User discards the pending capture. */
  function handleDiscard() {
    hidePending();
  }

  // ── Export ──

  /** Build CSV string and trigger download. */
  function handleExport() {
    if (samples.length === 0) {
      alert("No data to export.");
      return;
    }

    const includeNotes = dom.includeNotes.checked;
    const headers = ["timestamp_iso", "label", "lat", "lon", "accuracy_m"];
    if (includeNotes) headers.push("notes");

    const rows = [headers.join(",")];
    for (const s of samples) {
      const row = [
        s.timestamp_iso,
        s.label,
        s.lat.toFixed(6),
        s.lon.toFixed(6),
        s.accuracy_m.toFixed(1),
      ];
      if (includeNotes) {
        // Escape double quotes and wrap in quotes
        const notesVal = (s.notes || "").replace(/"/g, '""');
        row.push('"' + notesVal + '"');
      }
      rows.push(row.join(","));
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Generate filename with timestamp
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fname =
      "amphi_samples_" +
      now.getFullYear() +
      "-" +
      pad(now.getMonth() + 1) +
      "-" +
      pad(now.getDate()) +
      "_" +
      pad(now.getHours()) +
      "-" +
      pad(now.getMinutes()) +
      "-" +
      pad(now.getSeconds()) +
      ".csv";

    // Download via hidden <a>
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Clear All ──

  /** Double-confirm and clear all data. */
  function handleClear() {
    if (samples.length === 0) {
      alert("No data to clear.");
      return;
    }

    // First confirmation
    const ok1 = confirm(
      "Are you sure you want to delete ALL " +
        samples.length +
        " samples?\nThis action cannot be undone."
    );
    if (!ok1) return;

    // Second confirmation – must type CLEAR
    const typed = prompt('To confirm deletion, type "CLEAR" (all caps):');
    if (typed !== "CLEAR") {
      alert("Deletion cancelled. You did not type CLEAR.");
      return;
    }

    samples = [];
    saveToStorage();
    renderCounters();
    renderTable();
    hidePending();
    alert("All data has been cleared.");
  }

  // ── Event Binding ──

  function bindEvents() {
    dom.btnCaptureIn.addEventListener("click", () => handleCapture("IN"));
    dom.btnCaptureOut.addEventListener("click", () => handleCapture("OUT"));
    dom.btnSave.addEventListener("click", handleSave);
    dom.btnDiscard.addEventListener("click", handleDiscard);
    dom.btnExport.addEventListener("click", handleExport);
    dom.btnClear.addEventListener("click", handleClear);
  }

  // ── Boot ──
  init();
})();
