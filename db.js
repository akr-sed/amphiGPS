/**
 * AmphiGPS – Supabase Database Service
 * All data syncs to the project owner's Supabase instance.
 * Must be loaded AFTER the Supabase CDN script in index.html.
 */
var DbService = (function () {
  "use strict";

  var cfg = window.AMPHIGPS_CONFIG || {};
  var SUPABASE_URL = cfg.SUPABASE_URL || "";
  var SUPABASE_KEY = cfg.SUPABASE_KEY || "";

  var client = null;

  function init() {
    try {
      if (typeof supabase !== "undefined") {
        client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return { success: true };
      }
      return { success: false, error: "Supabase SDK not loaded." };
    } catch (e) {
      console.error("DbService.init error:", e);
      return { success: false, error: e.message };
    }
  }

  function isConfigured() {
    return true;
  }

  async function insertSample(sample) {
    if (!client) {
      init();
      if (!client) return { success: false, error: "Supabase not initialized" };
    }
    try {
      var row = {
        session_id: sample.session_id,
        collector_id: sample.collector_id,
        amphi_id: sample.amphi_id,
        floor: sample.floor,
        timestamp_iso: sample.timestamp_iso,
        label: sample.label,
        lat: sample.lat,
        lon: sample.lon,
        accuracy_m: sample.accuracy_m,
        altitude_gps: sample.altitude_gps,
        altitude_acc_gps: sample.altitude_acc_gps,
        pressure_hpa: sample.pressure_hpa,
        baro_alt_m: sample.baro_alt_m,
        avg_lat: sample.avg_lat,
        avg_lon: sample.avg_lon,
        avg_accuracy_m: sample.avg_accuracy_m,
        n_gps_samples: sample.n_gps_samples,
        confidence: sample.confidence,
        device_info: sample.device_info,
        notes: sample.notes,
      };
      var result = await client.from("amphi_samples").insert([row]);
      if (result.error) return { success: false, error: result.error.message };
      return { success: true };
    } catch (e) {
      console.error("DbService.insertSample error:", e);
      return { success: false, error: e.message };
    }
  }

  async function syncPending(samples, saveCallback) {
    if (!client) {
      init();
      if (!client) return { success: false, error: "Supabase not initialized", synced: 0 };
    }
    var synced = 0;
    var errors = [];
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].synced) continue;
      try {
        var result = await insertSample(samples[i]);
        if (result.success) {
          samples[i].synced = true;
          synced++;
        } else {
          errors.push(result.error);
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
    if (saveCallback) saveCallback();
    return { success: errors.length === 0, synced: synced, errors: errors };
  }

  function getStats(samples) {
    var total = samples.length;
    var syncedCount = 0;
    for (var i = 0; i < total; i++) {
      if (samples[i].synced) syncedCount++;
    }
    return { total: total, synced: syncedCount, pending: total - syncedCount };
  }

  // Auto-init on load
  init();

  return {
    init: init,
    isConfigured: isConfigured,
    insertSample: insertSample,
    syncPending: syncPending,
    getStats: getStats,
  };
})();
