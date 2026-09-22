// Monophonic pitch detection via normalized time-domain autocorrelation
// (the standard "ACF2+" approach used by most browser-based tuners), with
// parabolic interpolation around the best lag for sub-sample precision.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.PitchDetector = (function () {
  var MIN_FREQ = 55; // below cello's open C (~65 Hz), with headroom
  var MAX_FREQ = 1400; // covers cello's upper positions/harmonics
  var RMS_SILENCE_THRESHOLD = 0.01;

  // buffer: Float32Array from AnalyserNode.getFloatTimeDomainData
  // Returns frequency in Hz, or -1 if silent/no clear pitch found.
  function autoCorrelate(buffer, sampleRate) {
    var n = buffer.length;

    var rms = 0;
    for (var i = 0; i < n; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / n);
    if (rms < RMS_SILENCE_THRESHOLD) return -1;

    var minLag = Math.floor(sampleRate / MAX_FREQ);
    var maxLag = Math.min(n - 1, Math.ceil(sampleRate / MIN_FREQ));

    var correlations = new Float32Array(maxLag + 1);
    for (var lag = minLag; lag <= maxLag; lag++) {
      var sum = 0;
      for (var j = 0; j < n - lag; j++) sum += buffer[j] * buffer[j + lag];
      correlations[lag] = sum;
    }

    // Find the first significant peak after the initial (near-zero-lag) falloff.
    var bestLag = -1;
    var bestValue = -Infinity;
    for (var l = minLag; l <= maxLag; l++) {
      if (correlations[l] > bestValue) {
        bestValue = correlations[l];
        bestLag = l;
      }
    }
    if (bestLag <= minLag || bestLag >= maxLag) return -1;

    // Parabolic interpolation using neighboring correlation values.
    var y0 = correlations[bestLag - 1];
    var y1 = correlations[bestLag];
    var y2 = correlations[bestLag + 1];
    var denom = y0 - 2 * y1 + y2;
    var shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
    var refinedLag = bestLag + shift;

    if (refinedLag <= 0) return -1;
    var freq = sampleRate / refinedLag;
    if (freq < MIN_FREQ || freq > MAX_FREQ) return -1;
    return freq;
  }

  return { autoCorrelate: autoCorrelate, MIN_FREQ: MIN_FREQ, MAX_FREQ: MAX_FREQ };
})();
