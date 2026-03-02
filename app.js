/**
 * AmphiGPS v2.0 – Amphitheatre Attendance GPS Logger
 * Full-featured: multi-amphi, altitude, barometric, Supabase sync, PWA.
 */

(function () {
  "use strict";

  // ── Constants ──
  var STORAGE_KEY = "amphigps_samples";
  var SETTINGS_KEY = "amphigps_settings";
  var COLLECTOR_KEY = "amphigps_collector_id";
  var AMPHI_KEY = "amphigps_session_amphi";
  var APP_VERSION = "2.0.0";

  // Floor is auto-derived from amphi name
  var FLOOR_MAP = {
    "Amphi 1": 1, "Amphi 2": 1, "Amphi 3": 1, "Amphi 4": 1,
    "Amphi 5": 2, "Amphi 6": 2, "Amphi 7": 2, "Amphi 8": 2,
  };

  // ── DOM References ──
  var dom = {
    // Header
    syncStatusIcon: document.getElementById("syncStatusIcon"),
    collectorSubtitle: document.getElementById("collectorSubtitle"),
    // Session bar
    amphiSelect: document.getElementById("amphiSelect"),
    amphiCustom: document.getElementById("amphiCustom"),
    sessionPill: document.getElementById("sessionPill"),
    // Counters
    totalCount: document.getElementById("totalCount"),
    inCount: document.getElementById("inCount"),
    outCount: document.getElementById("outCount"),
    syncedCount: document.getElementById("syncedCount"),
    // Live GPS
    liveGpsPanel: document.getElementById("liveGpsPanel"),
    liveGpsLat: document.getElementById("liveGpsLat"),
    liveGpsLon: document.getElementById("liveGpsLon"),
    liveGpsAcc: document.getElementById("liveGpsAcc"),
    liveGpsAccDot: document.getElementById("liveGpsAccDot"),
    liveGpsAlt: document.getElementById("liveGpsAlt"),
    liveGpsPressure: document.getElementById("liveGpsPressure"),
    autoCapture: document.getElementById("autoCapture"),
    // Capture buttons
    btnCaptureIn: document.getElementById("btnCaptureIn"),
    btnCaptureOut: document.getElementById("btnCaptureOut"),
    // Loading
    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingText: document.getElementById("loadingText"),
    // Pending panel
    pendingPanel: document.getElementById("pendingPanel"),
    pendingLabel: document.getElementById("pendingLabel"),
    pendingLat: document.getElementById("pendingLat"),
    pendingLon: document.getElementById("pendingLon"),
    pendingAcc: document.getElementById("pendingAcc"),
    pendingAlt: document.getElementById("pendingAlt"),
    pendingPressure: document.getElementById("pendingPressure"),
    pendingAvgAcc: document.getElementById("pendingAvgAcc"),
    pendingNSamples: document.getElementById("pendingNSamples"),
    pendingTime: document.getElementById("pendingTime"),
    mapPreview: document.getElementById("mapPreview"),
    confidenceBtns: document.getElementById("confidenceBtns"),
    notesInput: document.getElementById("notesInput"),
    btnSave: document.getElementById("btnSave"),
    btnReacquire: document.getElementById("btnReacquire"),
    btnDiscard: document.getElementById("btnDiscard"),
    // Accuracy warning
    accuracyWarning: document.getElementById("accuracyWarning"),
    warnAccVal: document.getElementById("warnAccVal"),
    warnThreshVal: document.getElementById("warnThreshVal"),
    // Settings
    settingsPanel: document.getElementById("settingsPanel"),
    accuracyThreshold: document.getElementById("accuracyThreshold"),
    includeNotes: document.getElementById("includeNotes"),
    includeDevice: document.getElementById("includeDevice"),
    syncStats: document.getElementById("syncStats"),
    collectorInput: document.getElementById("collectorInput"),
    btnSaveCollector: document.getElementById("btnSaveCollector"),
    // Action buttons
    btnSync: document.getElementById("btnSync"),
    btnExport: document.getElementById("btnExport"),
    btnSessionMap: document.getElementById("btnSessionMap"),
    btnClear: document.getElementById("btnClear"),
    // Offline banner
    offlineBanner: document.getElementById("offlineBanner"),
    // Data table
    dataBody: document.getElementById("dataBody"),
    emptyMsg: document.getElementById("emptyMsg"),
    // Toast
    toastContainer: document.getElementById("toastContainer"),
    // Collector modal
    collectorModal: document.getElementById("collectorModal"),
    collectorModalInput: document.getElementById("collectorModalInput"),
    btnCollectorModalSave: document.getElementById("btnCollectorModalSave"),
    // Session map modal
    sessionMapModal: document.getElementById("sessionMapModal"),
    btnCloseMap: document.getElementById("btnCloseMap"),
    sessionMapContainer: document.getElementById("sessionMapContainer"),
    sessionMapLegend: document.getElementById("sessionMapLegend"),
    // Per-amphi stats
    amphiStatsBody: document.getElementById("amphiStatsBody"),
  };

  // ── State ──
  var samples = [];
  var pendingCapture = null;
  var sessionId = generateSessionId();
  var collectorId = localStorage.getItem(COLLECTOR_KEY) || "";
  var selectedAmphi = localStorage.getItem(AMPHI_KEY) || "";
  var selectedConfidence = 2;
  var liveWatchId = null;
  var previewMap = null;
  var sessionMap = null;
  var leafletLoaded = false;
  var settings = loadSettings();

  // ── Session ID (H2) ──
  function generateSessionId() {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var rand = "";
    for (var i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return (
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "-" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds()) +
      "-" +
      rand
    );
  }

  // ── Settings ──
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
    return { accuracyThreshold: 20, includeNotes: false, includeDevice: false };
  }

  function saveSettings() {
    settings.accuracyThreshold = getThreshold();
    settings.includeNotes = dom.includeNotes.checked;
    settings.includeDevice = dom.includeDevice.checked;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applySettings() {
    dom.accuracyThreshold.value = settings.accuracyThreshold;
    dom.includeNotes.checked = settings.includeNotes;
    dom.includeDevice.checked = settings.includeDevice;
    // Collector
    dom.collectorInput.value = collectorId;
  }

  // ── Collector ID (C5) ──
  function checkCollectorId() {
    if (!collectorId) {
      dom.collectorModal.classList.remove("hidden");
    } else {
      dom.collectorSubtitle.textContent = "Collector: " + collectorId;
    }
  }

  function saveCollectorId(id) {
    collectorId = id.trim();
    localStorage.setItem(COLLECTOR_KEY, collectorId);
    dom.collectorSubtitle.textContent = collectorId ? "Collector: " + collectorId : "";
    dom.collectorInput.value = collectorId;
  }

  // ── Amphi / Floor (C3) ──
  function restoreSessionContext() {
    if (selectedAmphi) {
      var opts = dom.amphiSelect.options;
      var found = false;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === selectedAmphi) {
          dom.amphiSelect.value = selectedAmphi;
          found = true;
          break;
        }
      }
      if (!found && selectedAmphi !== "__custom__") {
        dom.amphiSelect.value = "__custom__";
        dom.amphiCustom.value = selectedAmphi;
        dom.amphiCustom.classList.remove("hidden");
      }
    }
    updateSessionPill();
    updateCaptureButtonsState();
  }

  function getSelectedAmphi() {
    var val = dom.amphiSelect.value;
    if (val === "__custom__") return dom.amphiCustom.value.trim();
    return val;
  }

  function getSelectedFloor() {
    var amphi = getSelectedAmphi();
    if (FLOOR_MAP.hasOwnProperty(amphi)) return FLOOR_MAP[amphi];
    return null;
  }

  function updateSessionPill() {
    var amphi = getSelectedAmphi();
    var floor = getSelectedFloor();
    if (amphi && floor !== null) {
      var floorLabel = floor === 0 ? "Ground" : "Floor " + floor;
      dom.sessionPill.textContent = amphi + " \u2014 " + floorLabel;
      dom.sessionPill.classList.remove("hidden");
    } else {
      dom.sessionPill.classList.add("hidden");
    }
  }

  function updateCaptureButtonsState() {
    var amphi = getSelectedAmphi();
    var ready = !!amphi;
    var pendingOpen = !dom.pendingPanel.classList.contains("hidden");
    var loadingOpen = !dom.loadingOverlay.classList.contains("hidden");
    dom.btnCaptureIn.disabled = !ready || pendingOpen || loadingOpen;
    dom.btnCaptureOut.disabled = !ready || pendingOpen || loadingOpen;
    dom.btnCaptureIn.title = ready ? "" : "Select an Amphi first";
    dom.btnCaptureOut.title = ready ? "" : "Select an Amphi first";
  }

  // ── Toasts ──
  function showToast(message, type, duration) {
    type = type || "info";
    duration = duration || 2000;
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("toast-visible");
    });
    setTimeout(function () {
      toast.classList.remove("toast-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, duration);
  }

  // ── Initialisation ──
  function init() {
    loadFromStorage();
    applySettings();
    restoreSessionContext();
    checkCollectorId();
    renderCounters();
    renderTable();
    renderAmphiStats();
    updateSyncStats();
    updateSyncStatusIcon();
    bindEvents();
    startLiveGps();
    checkOnlineStatus();
    registerServiceWorker();
  }

  // ── LocalStorage ──
  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) samples = JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to parse stored samples:", e);
      samples = [];
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      showToast("Warning: could not save to localStorage.", "error", 3000);
    }
  }

  // ── Counters (H5) ──
  function renderCounters() {
    var inN = 0, outN = 0, syncN = 0;
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].label === "IN") inN++;
      if (samples[i].label === "OUT") outN++;
      if (samples[i].synced) syncN++;
    }
    dom.totalCount.textContent = samples.length;
    dom.inCount.textContent = inN;
    dom.outCount.textContent = outN;
    dom.syncedCount.textContent = syncN;
  }

  // ── Data Table ──
  function renderTable() {
    dom.dataBody.innerHTML = "";
    if (samples.length === 0) {
      dom.emptyMsg.classList.remove("hidden");
      return;
    }
    dom.emptyMsg.classList.add("hidden");
    var sorted = samples.slice().reverse();
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      var tr = document.createElement("tr");

      var labelTd = document.createElement("td");
      labelTd.textContent = s.label;
      labelTd.className = "label-cell-" + s.label;

      var amphiTd = document.createElement("td");
      amphiTd.textContent = s.amphi_id || "\u2014";

      var floorTd = document.createElement("td");
      floorTd.textContent = s.floor !== undefined && s.floor !== null ? (s.floor === 0 ? "G" : s.floor) : "\u2014";

      var timeTd = document.createElement("td");
      timeTd.textContent = formatShortTime(s.timestamp_iso);

      var accTd = document.createElement("td");
      accTd.className = "acc-cell";
      var accVal = s.accuracy_m != null ? s.accuracy_m.toFixed(1) : "\u2014";
      var accSpan = document.createElement("span");
      accSpan.textContent = accVal;
      accTd.appendChild(accSpan);
      // N1: Accuracy heatmap bar
      if (s.accuracy_m != null) {
        var barWidth = Math.min(100, (s.accuracy_m / 50) * 100);
        var barColor = s.accuracy_m < 10 ? "#2ecc71" : s.accuracy_m < 25 ? "#f39c12" : "#e74c3c";
        var bar = document.createElement("div");
        bar.className = "accuracy-bar";
        bar.style.width = barWidth + "%";
        bar.style.background = barColor;
        accTd.appendChild(bar);
      }

      var latTd = document.createElement("td");
      latTd.textContent = s.lat != null ? s.lat.toFixed(6) : "\u2014";

      var lonTd = document.createElement("td");
      lonTd.textContent = s.lon != null ? s.lon.toFixed(6) : "\u2014";

      var confTd = document.createElement("td");
      confTd.textContent = s.confidence ? "\u2B50".repeat(s.confidence) : "\u2014";

      var notesTd = document.createElement("td");
      notesTd.textContent = s.notes || "";

      tr.appendChild(labelTd);
      tr.appendChild(amphiTd);
      tr.appendChild(floorTd);
      tr.appendChild(timeTd);
      tr.appendChild(accTd);
      tr.appendChild(latTd);
      tr.appendChild(lonTd);
      tr.appendChild(confTd);
      tr.appendChild(notesTd);
      dom.dataBody.appendChild(tr);
    }
  }

  function formatShortTime(iso) {
    var d = new Date(iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds())
    );
  }

  // ── UI Helpers ──
  function setLoading(on, text) {
    if (on) {
      dom.loadingText.textContent = text || "Acquiring GPS\u2026";
      dom.loadingOverlay.classList.remove("hidden");
      dom.btnCaptureIn.disabled = true;
      dom.btnCaptureOut.disabled = true;
    } else {
      dom.loadingOverlay.classList.add("hidden");
      updateCaptureButtonsState();
    }
  }

  function showPending(data) {
    pendingCapture = data;
    dom.pendingLabel.textContent = data.label;
    dom.pendingLabel.className = "pending-label-tag label-" + data.label;
    dom.pendingLat.textContent = data.lat.toFixed(6);
    dom.pendingLon.textContent = data.lon.toFixed(6);
    dom.pendingAcc.textContent = data.accuracy_m.toFixed(1) + " m";
    dom.pendingAlt.textContent = data.altitude_gps != null ? data.altitude_gps.toFixed(1) + " m" : "\u2014";
    dom.pendingPressure.textContent = data.pressure_hpa != null ? data.pressure_hpa.toFixed(1) + " hPa" : "\u2014";
    dom.pendingAvgAcc.textContent = data.avg_accuracy_m != null ? data.avg_accuracy_m.toFixed(1) + " m" : "\u2014";
    dom.pendingNSamples.textContent = data.n_gps_samples || "\u2014";
    dom.pendingTime.textContent = formatShortTime(data.timestamp_iso);
    dom.notesInput.value = "";
    selectedConfidence = 2;
    updateConfidenceButtons();

    // Accuracy threshold warning
    var threshold = getThreshold();
    if (data.accuracy_m > threshold) {
      dom.warnAccVal.textContent = data.accuracy_m.toFixed(1);
      dom.warnThreshVal.textContent = threshold;
      dom.accuracyWarning.classList.remove("hidden");
    } else {
      dom.accuracyWarning.classList.add("hidden");
    }

    dom.pendingPanel.classList.remove("hidden");
    dom.btnCaptureIn.disabled = true;
    dom.btnCaptureOut.disabled = true;
    // Stop live GPS to save battery
    stopLiveGps();
    // Show mini-map (M4)
    showMiniMap(data.lat, data.lon);
  }

  function hidePending() {
    dom.pendingPanel.classList.add("hidden");
    dom.accuracyWarning.classList.add("hidden");
    pendingCapture = null;
    destroyMiniMap();
    updateCaptureButtonsState();
    startLiveGps();
  }

  function getThreshold() {
    var val = parseInt(dom.accuracyThreshold.value, 10);
    return isNaN(val) || val < 1 ? 20 : val;
  }

  // ── Confidence (M2) ──
  function updateConfidenceButtons() {
    var btns = dom.confidenceBtns.querySelectorAll(".confidence-btn");
    btns.forEach(function (b) {
      b.classList.toggle("active", parseInt(b.dataset.conf, 10) === selectedConfidence);
    });
  }

  // ── Geolocation – watchPosition burst (C1/H1) ──
  var GPS_BURST_MAX_MS = 4000;   // hard time cap
  var GPS_BURST_MIN_READINGS = 2; // need at least 2 before early exit

  function acquireAveragedPosition() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation API is not supported by this browser."));
        return;
      }

      var readings = [];
      var done = false;
      var threshold = getThreshold();
      var startTime = Date.now();

      function finish() {
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(watchId);
        if (readings.length === 0) {
          reject(new Error("No GPS readings received. Ensure GPS/Location is enabled."));
          return;
        }
        resolve(processReadings(readings));
      }

      // Update loading text with elapsed time
      var tickInterval = setInterval(function () {
        if (done) { clearInterval(tickInterval); return; }
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        setLoading(true, "GPS: " + readings.length + " readings (" + elapsed + "s)\u2026");
      }, 300);

      var watchId = navigator.geolocation.watchPosition(
        function (pos) {
          if (done) return;
          readings.push({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude_gps: pos.coords.altitude,
            altitude_acc_gps: pos.coords.altitudeAccuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          });
          // Early exit: good accuracy + enough readings
          if (readings.length >= GPS_BURST_MIN_READINGS && pos.coords.accuracy <= threshold) {
            clearInterval(tickInterval);
            finish();
          }
        },
        function (err) {
          if (done) return;
          // If we already have readings, just stop; otherwise reject
          if (readings.length > 0) {
            clearInterval(tickInterval);
            finish();
          } else {
            done = true;
            clearInterval(tickInterval);
            navigator.geolocation.clearWatch(watchId);
            var msg;
            switch (err.code) {
              case err.PERMISSION_DENIED:
                msg = "Location permission denied. Please allow location access.";
                break;
              case err.POSITION_UNAVAILABLE:
                msg = "Location unavailable. Ensure GPS/Location is enabled.";
                break;
              case err.TIMEOUT:
                msg = "Location request timed out. Try again in an open area.";
                break;
              default:
                msg = "Geolocation error: " + err.message;
            }
            reject(new Error(msg));
          }
        },
        { enableHighAccuracy: true, timeout: GPS_BURST_MAX_MS + 2000, maximumAge: 0 }
      );

      // Hard time cap
      setTimeout(function () {
        clearInterval(tickInterval);
        finish();
      }, GPS_BURST_MAX_MS);
    });
  }

  function processReadings(readings) {
    var threshold = getThreshold();
    var valid = readings.filter(function (r) { return r.accuracy <= threshold * 3; });
    if (valid.length === 0) valid = readings;
    var best = valid.reduce(function (a, b) { return a.accuracy < b.accuracy ? a : b; });
    var sumLat = 0, sumLon = 0, sumAcc = 0;
    for (var i = 0; i < valid.length; i++) {
      sumLat += valid[i].lat;
      sumLon += valid[i].lon;
      sumAcc += valid[i].accuracy;
    }
    return {
      lat: best.lat,
      lon: best.lon,
      accuracy: best.accuracy,
      altitude_gps: best.altitude_gps,
      altitude_acc_gps: best.altitude_acc_gps,
      timestamp: best.timestamp,
      avg_lat: sumLat / valid.length,
      avg_lon: sumLon / valid.length,
      avg_accuracy_m: sumAcc / valid.length,
      n_gps_samples: valid.length,
    };
  }

  // ── Barometric Pressure (C2) ──
  function acquireBarometricPressure() {
    return new Promise(function (resolve) {
      try {
        var SensorClass = window.AbsolutePressureSensor || window.PressureSensor;
        if (!SensorClass) { resolve(null); return; }
        var sensor = new SensorClass({ frequency: 1 });
        var resolved = false;
        sensor.addEventListener("reading", function () {
          if (resolved) return;
          resolved = true;
          var pressure_hpa = sensor.pressure;
          // Some sensors return Pa instead of hPa
          if (pressure_hpa > 10000) pressure_hpa = pressure_hpa / 100;
          var baro_alt_m = 44330 * (1 - Math.pow(pressure_hpa / 1013.25, 0.1903));
          sensor.stop();
          resolve({ pressure_hpa: pressure_hpa, baro_alt_m: baro_alt_m });
        });
        sensor.addEventListener("error", function () {
          if (!resolved) { resolved = true; resolve(null); }
        });
        sensor.start();
        setTimeout(function () {
          if (!resolved) {
            resolved = true;
            try { sensor.stop(); } catch (e) { /* ignore */ }
            resolve(null);
          }
        }, 3000);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ── Capture Flow ──
  async function handleCapture(label) {
    setLoading(true, "Acquiring GPS\u2026");
    try {
      var results = await Promise.allSettled([
        acquireAveragedPosition(),
        acquireBarometricPressure(),
      ]);
      setLoading(false);
      var gpsResult = results[0];
      var baroResult = results[1];

      if (gpsResult.status === "rejected") {
        showToast("GPS Error: " + gpsResult.reason.message, "error", 3000);
        return;
      }

      var pos = gpsResult.value;
      var baro = baroResult.status === "fulfilled" ? baroResult.value : null;

      showPending({
        label: label,
        lat: pos.lat,
        lon: pos.lon,
        accuracy_m: pos.accuracy,
        altitude_gps: pos.altitude_gps,
        altitude_acc_gps: pos.altitude_acc_gps,
        timestamp_iso: pos.timestamp,
        avg_lat: pos.avg_lat,
        avg_lon: pos.avg_lon,
        avg_accuracy_m: pos.avg_accuracy_m,
        n_gps_samples: pos.n_gps_samples,
        pressure_hpa: baro ? baro.pressure_hpa : null,
        baro_alt_m: baro ? baro.baro_alt_m : null,
      });
    } catch (err) {
      setLoading(false);
      showToast("GPS Error: " + err.message, "error", 3000);
    }
  }

  // ── Save (C4) ──
  async function handleSave() {
    if (!pendingCapture) return;

    var sample = {
      session_id: sessionId,
      collector_id: collectorId,
      device_info: (navigator.userAgent || "").substring(0, 200),
      amphi_id: getSelectedAmphi(),
      floor: getSelectedFloor(),
      timestamp_iso: pendingCapture.timestamp_iso,
      label: pendingCapture.label,
      confidence: selectedConfidence,
      lat: pendingCapture.lat,
      lon: pendingCapture.lon,
      accuracy_m: pendingCapture.accuracy_m,
      altitude_gps: pendingCapture.altitude_gps,
      altitude_acc_gps: pendingCapture.altitude_acc_gps,
      avg_lat: pendingCapture.avg_lat,
      avg_lon: pendingCapture.avg_lon,
      avg_accuracy_m: pendingCapture.avg_accuracy_m,
      n_gps_samples: pendingCapture.n_gps_samples,
      pressure_hpa: pendingCapture.pressure_hpa,
      baro_alt_m: pendingCapture.baro_alt_m,
      notes: dom.notesInput.value.trim(),
      synced: false,
    };

    samples.push(sample);
    saveToStorage();
    renderCounters();
    renderTable();
    renderAmphiStats();
    hidePending();

    // Async sync to Supabase (fire-and-forget from user perspective)
    try {
      var result = await DbService.insertSample(sample);
      if (result.success) {
        sample.synced = true;
        saveToStorage();
        renderCounters();
        updateSyncStats();
        updateSyncStatusIcon();
        showToast("Saved & synced to cloud", "success", 1500);
      } else {
        showToast("Saved locally. Will sync when online.", "warning", 2000);
      }
    } catch (e) {
      showToast("Saved locally. Will sync when online.", "warning", 2000);
    }
  }

  function handleDiscard() {
    hidePending();
  }

  // ── Re-acquire (H4) ──
  async function handleReacquire() {
    if (!pendingCapture) return;
    var label = pendingCapture.label;
    destroyMiniMap();
    dom.pendingPanel.classList.add("hidden");
    await handleCapture(label);
  }

  // ── Sync (H6) ──
  async function handleSync() {
    dom.btnSync.disabled = true;
    dom.btnSync.textContent = "Syncing\u2026";
    try {
      var result = await DbService.syncPending(samples, saveToStorage);
      if (result.success || result.synced > 0) {
        saveToStorage();
        renderCounters();
        updateSyncStats();
        updateSyncStatusIcon();
        showToast(result.synced + " samples synced!", "success", 2000);
      } else if (result.errors && result.errors.length > 0) {
        showToast("Sync failed: " + result.errors[0], "error", 3000);
      } else {
        showToast("Nothing to sync.", "info", 1500);
      }
    } catch (e) {
      showToast("Sync failed: " + e.message, "error", 3000);
    }
    dom.btnSync.disabled = false;
    dom.btnSync.textContent = "Sync pending";
  }

  // ── Sync Stats ──
  function updateSyncStats() {
    var stats = DbService.getStats(samples);
    dom.syncStats.textContent = "Cloud: " + stats.synced + " synced / " + stats.pending + " pending";
  }

  // ── Sync Status Icon (N4) ──
  function updateSyncStatusIcon() {
    var stats = DbService.getStats(samples);
    if (samples.length === 0) {
      dom.syncStatusIcon.textContent = "";
    } else if (!navigator.onLine) {
      dom.syncStatusIcon.className = "sync-status-icon sync-offline";
      dom.syncStatusIcon.textContent = "\u2601\uFE0F\u274C";
      dom.syncStatusIcon.title = "Offline, " + stats.pending + " pending";
    } else if (stats.pending === 0) {
      dom.syncStatusIcon.className = "sync-status-icon sync-ok";
      dom.syncStatusIcon.textContent = "\u2601\uFE0F\u2705";
      dom.syncStatusIcon.title = "All synced";
    } else {
      dom.syncStatusIcon.className = "sync-status-icon sync-pending";
      dom.syncStatusIcon.textContent = "\u2601\uFE0F\u23F3";
      dom.syncStatusIcon.title = stats.pending + " pending sync";
    }
  }

  // ── Export (M3) ──
  function handleExport() {
    if (samples.length === 0) {
      showToast("No data to export.", "warning", 2000);
      return;
    }
    var includeNotes = dom.includeNotes.checked;
    var includeDevice = dom.includeDevice.checked;
    var inN = 0, outN = 0, syncN = 0;
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].label === "IN") inN++;
      if (samples[i].label === "OUT") outN++;
      if (samples[i].synced) syncN++;
    }

    var lines = [];
    lines.push("# AmphiGPS Export");
    lines.push("# Export date: " + new Date().toISOString());
    lines.push("# App version: " + APP_VERSION);
    lines.push("# Collector: " + (collectorId || "Unknown"));
    lines.push("# Total samples: " + samples.length + " (IN: " + inN + ", OUT: " + outN + ")");
    lines.push("# Synced to cloud: " + syncN + "/" + samples.length);
    lines.push("#");

    var headers = [
      "timestamp_iso", "label", "amphi_id", "floor", "confidence",
      "lat", "lon", "accuracy_m", "altitude_gps", "altitude_acc_gps",
      "avg_lat", "avg_lon", "avg_accuracy_m", "n_gps_samples",
      "pressure_hpa", "baro_alt_m", "session_id", "collector_id",
    ];
    if (includeNotes) headers.push("notes");
    if (includeDevice) headers.push("device_info");
    lines.push(headers.join(","));

    for (var j = 0; j < samples.length; j++) {
      var s = samples[j];
      var row = [
        s.timestamp_iso,
        s.label,
        '"' + (s.amphi_id || "").replace(/"/g, '""') + '"',
        s.floor != null ? s.floor : "",
        s.confidence || "",
        s.lat != null ? s.lat.toFixed(6) : "",
        s.lon != null ? s.lon.toFixed(6) : "",
        s.accuracy_m != null ? s.accuracy_m.toFixed(1) : "",
        s.altitude_gps != null ? s.altitude_gps.toFixed(1) : "",
        s.altitude_acc_gps != null ? s.altitude_acc_gps.toFixed(1) : "",
        s.avg_lat != null ? s.avg_lat.toFixed(6) : "",
        s.avg_lon != null ? s.avg_lon.toFixed(6) : "",
        s.avg_accuracy_m != null ? s.avg_accuracy_m.toFixed(1) : "",
        s.n_gps_samples || "",
        s.pressure_hpa != null ? s.pressure_hpa.toFixed(1) : "",
        s.baro_alt_m != null ? s.baro_alt_m.toFixed(1) : "",
        s.session_id || "",
        '"' + (s.collector_id || "").replace(/"/g, '""') + '"',
      ];
      if (includeNotes) {
        row.push('"' + (s.notes || "").replace(/"/g, '""') + '"');
      }
      if (includeDevice) {
        row.push('"' + (s.device_info || "").replace(/"/g, '""') + '"');
      }
      lines.push(row.join(","));
    }

    var csv = lines.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var fname =
      "amphi_samples_" +
      now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      "_" + pad(now.getHours()) + "-" + pad(now.getMinutes()) + "-" + pad(now.getSeconds()) +
      ".csv";
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV exported!", "success", 1500);
  }

  // ── Clear All ──
  function handleClear() {
    if (samples.length === 0) {
      showToast("No data to clear.", "warning", 1500);
      return;
    }
    var ok1 = confirm(
      "Are you sure you want to delete ALL " + samples.length +
      " samples?\nThis action cannot be undone."
    );
    if (!ok1) return;
    var typed = prompt('To confirm deletion, type "CLEAR" (all caps):');
    if (typed !== "CLEAR") {
      showToast("Deletion cancelled.", "info", 1500);
      return;
    }
    samples = [];
    saveToStorage();
    renderCounters();
    renderTable();
    renderAmphiStats();
    updateSyncStats();
    updateSyncStatusIcon();
    hidePending();
    showToast("All data cleared.", "success", 1500);
  }

  // ── Live GPS (M1) ──
  function startLiveGps() {
    if (liveWatchId !== null) return;
    if (!navigator.geolocation) return;
    if (!dom.pendingPanel.classList.contains("hidden")) return;
    liveWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        dom.liveGpsLat.textContent = pos.coords.latitude.toFixed(6);
        dom.liveGpsLon.textContent = pos.coords.longitude.toFixed(6);
        var acc = pos.coords.accuracy;
        dom.liveGpsAcc.textContent = acc.toFixed(1) + " m";
        if (acc < 10) {
          dom.liveGpsAccDot.className = "accuracy-dot acc-good";
        } else if (acc <= 25) {
          dom.liveGpsAccDot.className = "accuracy-dot acc-medium";
        } else {
          dom.liveGpsAccDot.className = "accuracy-dot acc-poor";
        }
        dom.liveGpsAlt.textContent =
          pos.coords.altitude != null ? pos.coords.altitude.toFixed(1) + " m" : "\u2014";
        // Auto-capture
        if (dom.autoCapture.checked && acc <= getThreshold()) {
          var amphi = getSelectedAmphi();
          var floor = getSelectedFloor();
          if (amphi && floor !== null && dom.pendingPanel.classList.contains("hidden")) {
            dom.autoCapture.checked = false;
            handleCapture("IN");
          }
        }
      },
      function () { /* silent fail */ },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );
  }

  function stopLiveGps() {
    if (liveWatchId !== null) {
      navigator.geolocation.clearWatch(liveWatchId);
      liveWatchId = null;
    }
  }

  // ── Mini-Map (M4) ──
  function loadLeaflet() {
    return new Promise(function (resolve) {
      if (leafletLoaded) { resolve(); return; }
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = function () { leafletLoaded = true; resolve(); };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
  }

  async function showMiniMap(lat, lon) {
    await loadLeaflet();
    if (typeof L === "undefined") return;
    destroyMiniMap();
    dom.mapPreview.style.display = "block";
    previewMap = L.map(dom.mapPreview, {
      zoomControl: false,
      attributionControl: false,
    }).setView([lat, lon], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(previewMap);
    L.marker([lat, lon]).addTo(previewMap);
    setTimeout(function () { previewMap.invalidateSize(); }, 100);
  }

  function destroyMiniMap() {
    if (previewMap) {
      previewMap.remove();
      previewMap = null;
    }
    dom.mapPreview.style.display = "none";
  }

  // ── Session Map (N2) ──
  async function showSessionMap() {
    if (samples.length === 0) {
      showToast("No samples to show on map.", "warning", 1500);
      return;
    }
    await loadLeaflet();
    if (typeof L === "undefined") {
      showToast("Could not load map library.", "error", 2000);
      return;
    }
    dom.sessionMapModal.classList.remove("hidden");
    if (sessionMap) { sessionMap.remove(); sessionMap = null; }
    sessionMap = L.map(dom.sessionMapContainer).setView([samples[0].lat, samples[0].lon], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(sessionMap);

    var amphiColors = {};
    var colorPalette = ["#e74c3c", "#3498db", "#9b59b6", "#f39c12", "#1abc9c", "#e67e22", "#2c3e50", "#8e44ad"];
    var colorIdx = 0;
    var bounds = [];

    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (s.lat == null || s.lon == null) continue;
      var amphiKey = s.amphi_id || "Unknown";
      if (!amphiColors[amphiKey]) {
        amphiColors[amphiKey] = colorPalette[colorIdx % colorPalette.length];
        colorIdx++;
      }
      var fillColor = s.label === "IN" ? "#2ecc71" : "#e74c3c";
      var circle = L.circleMarker([s.lat, s.lon], {
        radius: 8,
        fillColor: fillColor,
        color: amphiColors[amphiKey],
        weight: 3,
        fillOpacity: 0.7,
      }).addTo(sessionMap);
      var floorLabel = s.floor === 0 ? "Ground" : "Floor " + s.floor;
      circle.bindPopup(
        amphiKey + " \u2014 " + floorLabel + " \u2014 " + s.label +
        " \u2014 " + formatShortTime(s.timestamp_iso)
      );
      bounds.push([s.lat, s.lon]);
    }

    if (bounds.length > 0) sessionMap.fitBounds(bounds, { padding: [20, 20] });

    // Legend
    var legendHtml = "<strong>Legend:</strong> ";
    for (var key in amphiColors) {
      legendHtml +=
        '<span style="color:' + amphiColors[key] + ';">\u25CF</span> ' + key + "  ";
    }
    legendHtml +=
      ' | <span style="color:#2ecc71;">\u25CF</span> IN <span style="color:#e74c3c;">\u25CF</span> OUT';
    dom.sessionMapLegend.innerHTML = legendHtml;
    setTimeout(function () { sessionMap.invalidateSize(); }, 200);
  }

  function closeSessionMap() {
    dom.sessionMapModal.classList.add("hidden");
    if (sessionMap) { sessionMap.remove(); sessionMap = null; }
  }

  // ── Per-Amphi Stats (N3) ──
  function renderAmphiStats() {
    var stats = {};
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var floorStr = s.floor === 0 ? "G" : String(s.floor != null ? s.floor : "?");
      var key = (s.amphi_id || "Unknown") + " (Floor " + floorStr + ")";
      if (!stats[key]) stats[key] = { IN: 0, OUT: 0 };
      if (s.label === "IN") stats[key].IN++;
      else if (s.label === "OUT") stats[key].OUT++;
    }
    var html = "";
    for (var k in stats) {
      html += '<div class="amphi-stat-row"><strong>' + k + ":</strong> IN: " +
        stats[k].IN + ", OUT: " + stats[k].OUT + "</div>";
    }
    dom.amphiStatsBody.innerHTML = html || '<p class="empty-msg">No data yet.</p>';
  }

  // ── Offline Detection (M5) ──
  function checkOnlineStatus() {
    if (!navigator.onLine) {
      dom.offlineBanner.classList.remove("hidden");
    } else {
      dom.offlineBanner.classList.add("hidden");
    }
    updateSyncStatusIcon();
  }

  // ── Service Worker Registration (M5) ──
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function (e) {
        console.warn("SW registration failed:", e);
      });
    }
  }

  // ── Event Binding ──
  function bindEvents() {
    // Capture
    dom.btnCaptureIn.addEventListener("click", function () { handleCapture("IN"); });
    dom.btnCaptureOut.addEventListener("click", function () { handleCapture("OUT"); });
    dom.btnSave.addEventListener("click", handleSave);
    dom.btnDiscard.addEventListener("click", handleDiscard);
    dom.btnReacquire.addEventListener("click", handleReacquire);

    // Actions
    dom.btnSync.addEventListener("click", handleSync);
    dom.btnExport.addEventListener("click", handleExport);
    dom.btnSessionMap.addEventListener("click", showSessionMap);
    dom.btnClear.addEventListener("click", handleClear);
    dom.btnCloseMap.addEventListener("click", closeSessionMap);

    // Amphi select
    dom.amphiSelect.addEventListener("change", function () {
      if (dom.amphiSelect.value === "__custom__") {
        dom.amphiCustom.classList.remove("hidden");
        dom.amphiCustom.focus();
      } else {
        dom.amphiCustom.classList.add("hidden");
      }
      selectedAmphi = getSelectedAmphi();
      localStorage.setItem(AMPHI_KEY, selectedAmphi);
      updateSessionPill();
      updateCaptureButtonsState();
    });

    dom.amphiCustom.addEventListener("input", function () {
      selectedAmphi = getSelectedAmphi();
      localStorage.setItem(AMPHI_KEY, selectedAmphi);
      updateSessionPill();
      updateCaptureButtonsState();
    });

    // Confidence buttons
    dom.confidenceBtns.addEventListener("click", function (e) {
      var btn = e.target.closest(".confidence-btn");
      if (!btn) return;
      selectedConfidence = parseInt(btn.dataset.conf, 10);
      updateConfidenceButtons();
    });

    // Settings changes
    dom.accuracyThreshold.addEventListener("change", saveSettings);
    dom.includeNotes.addEventListener("change", saveSettings);
    dom.includeDevice.addEventListener("change", saveSettings);

    // Collector ID
    dom.btnSaveCollector.addEventListener("click", function () {
      saveCollectorId(dom.collectorInput.value);
      showToast("Collector ID saved.", "success", 1500);
    });

    dom.btnCollectorModalSave.addEventListener("click", function () {
      var val = dom.collectorModalInput.value.trim();
      if (!val) return;
      saveCollectorId(val);
      dom.collectorModal.classList.add("hidden");
    });

    // Online/offline
    window.addEventListener("online", function () {
      dom.offlineBanner.classList.add("hidden");
      updateSyncStatusIcon();
      showToast("Back online!", "success", 1500);
    });

    window.addEventListener("offline", function () {
      dom.offlineBanner.classList.remove("hidden");
      updateSyncStatusIcon();
      showToast("You are offline.", "warning", 2000);
    });
  }

  // ── Boot ──
  init();
})();
