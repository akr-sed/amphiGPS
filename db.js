/**
 * AmphiGPS – Supabase Database Service (Write-Only for Users)
 * Samples are pushed to Supabase on save. Users see only their current
 * session data in-memory. Cloud data is for admin/analytics use.
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

  function isReady() {
    if (!client) init();
    return !!client;
  }

  /**
   * Insert a single sample row into Supabase.
   * Returns the inserted row (with server-generated id) on success.
   */
  async function insertSample(sample) {
    if (!client) {
      init();
      if (!client) return { success: false, error: "Supabase not initialized" };
    }
    try {
      var row = {
        session_id: sample.session_id,
        amphi_id: sample.amphi_id || null,
        floor: sample.floor != null ? sample.floor : null,
        timestamp_iso: sample.timestamp_iso,
        label: sample.label,
        lat: sample.lat,
        lon: sample.lon,
        accuracy_m: sample.accuracy_m,
        altitude_gps: sample.altitude_gps,
        altitude_acc_gps: sample.altitude_acc_gps,
        pressure_hpa: sample.pressure_hpa,
        baro_alt_m: sample.baro_alt_m,
        confidence: sample.confidence,
        device_info: sample.device_info,
        notes: sample.notes,
        out_location: sample.out_location || null,
      };
      var result = await client.from("amphi_samples").insert([row]).select();
      if (result.error) return { success: false, error: result.error.message };
      return { success: true, data: result.data ? result.data[0] : row };
    } catch (e) {
      console.error("DbService.insertSample error:", e);
      return { success: false, error: e.message };
    }
  }

  // Auto-init on load
  init();

  return {
    init: init,
    isReady: isReady,
    insertSample: insertSample,
  };
})();
