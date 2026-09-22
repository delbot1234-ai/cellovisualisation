// Best-effort parser for WitMotion app text/CSV exports. The exact column
// set/order varies by app version and export settings, so this detects a
// header row, matches columns by keyword, and falls back to a documented
// guess (and a warning) if no header is found.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.SensorFile = (function () {
  var COLUMN_PATTERNS = [
    { key: "t", test: /^(time|timestamp|t)$/i },
    { key: "ax", test: /a[_\s]?x/i },
    { key: "ay", test: /a[_\s]?y/i },
    { key: "az", test: /a[_\s]?z/i },
    { key: "gx", test: /(g|w)[_\s]?x/i },
    { key: "gy", test: /(g|w)[_\s]?y/i },
    { key: "gz", test: /(g|w)[_\s]?z/i },
    { key: "roll", test: /roll|angle[_\s]?x/i },
    { key: "pitch", test: /pitch|angle[_\s]?y/i },
    { key: "yaw", test: /yaw|angle[_\s]?z/i },
  ];

  function detectDelimiter(line) {
    if (line.indexOf("\t") !== -1) return "\t";
    if (line.indexOf(",") !== -1) return ",";
    return /\s+/;
  }

  function classifyColumn(headerCell) {
    var clean = headerCell.replace(/[().\[\]°/%]/g, " ").trim();
    for (var i = 0; i < COLUMN_PATTERNS.length; i++) {
      if (COLUMN_PATTERNS[i].test.test(clean)) return COLUMN_PATTERNS[i].key;
    }
    return null;
  }

  function looksNumeric(cell) {
    return cell !== "" && !isNaN(parseFloat(cell)) && isFinite(cell);
  }

  function parse(text) {
    var lines = text.split(/\r\n|\r|\n/).filter(function (l) {
      return l.trim().length > 0;
    });
    if (lines.length === 0) return { samples: [], warning: "File is empty." };

    var delimiter = detectDelimiter(lines[0]);
    var firstCells = lines[0].split(delimiter).map(function (c) {
      return c.trim();
    });
    var headerIsNumeric = firstCells.every(looksNumeric);

    var columnMap = {}; // key -> column index
    var dataStart = 0;
    var warning = null;

    if (!headerIsNumeric) {
      firstCells.forEach(function (cell, idx) {
        var key = classifyColumn(cell);
        if (key && columnMap[key] === undefined) columnMap[key] = idx;
      });
      dataStart = 1;
    }

    if (Object.keys(columnMap).length === 0) {
      // No usable header: guess a common WitMotion export column order.
      warning =
        "Couldn't detect column headers — assuming the order time, ax, ay, az, gx, gy, gz, roll, pitch, yaw. " +
        "Check the live readouts against your file to confirm.";
      columnMap = { t: 0, ax: 1, ay: 2, az: 3, gx: 4, gy: 5, gz: 6, roll: 7, pitch: 8, yaw: 9 };
      dataStart = 0;
    }

    var samples = [];
    for (var i = dataStart; i < lines.length; i++) {
      var cells = lines[i].split(delimiter).map(function (c) {
        return c.trim();
      });
      if (cells.length < 2) continue;

      var sample = {};
      var any = false;
      Object.keys(columnMap).forEach(function (key) {
        var idx = columnMap[key];
        var raw = cells[idx];
        if (raw === undefined) return;
        var val = parseFloat(raw);
        if (isNaN(val)) return;
        sample[key] = val;
        any = true;
      });
      if (any) samples.push(sample);
    }

    // Normalize time to seconds, relative to the first sample.
    var hasTime = samples.length > 0 && samples[0].t !== undefined;
    if (hasTime) {
      // Guess ms vs seconds from the typical gap between samples, not the
      // total duration — a short recording can still be in milliseconds
      // (e.g. a few seconds of data at 50 Hz never exceeds ~10000ms total,
      // which a duration-based heuristic would misread as already-seconds).
      var diffs = [];
      for (var d = 1; d < Math.min(samples.length, 50); d++) {
        var diff = samples[d].t - samples[d - 1].t;
        if (diff > 0) diffs.push(diff);
      }
      diffs.sort(function (a, b) {
        return a - b;
      });
      var medianDiff = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0;
      var isMs = medianDiff > 1.5; // a real IMU's per-sample interval in seconds is always < 1.5
      var t0 = samples[0].t;
      samples.forEach(function (s) {
        if (s.t === undefined) return;
        s.t = isMs ? (s.t - t0) / 1000 : s.t - t0;
      });
    } else {
      // No time column: assume a fixed sample interval.
      var assumedRateHz = 50;
      samples.forEach(function (s, idx) {
        s.t = idx / assumedRateHz;
      });
      if (!warning) {
        warning = "No time column detected — assuming a fixed 50 Hz sample rate for playback timing.";
      }
    }

    return { samples: samples, warning: warning, columnMap: columnMap };
  }

  return { parse: parse };
})();
