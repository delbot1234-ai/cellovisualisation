// Simplified, pedagogically-tuned model of the Schelleng bowing diagram.
// Real physics: playable bow force sits between a minimum (bow slips too
// easily below it -> surface sound / whistle) and a maximum (string sticks
// and slips multiple times per cycle above it -> crunch), and that window
// scales with bow speed and narrows the further the bow sits from the
// bridge. Constants below are tuned so the sliders' default values land
// comfortably inside the "clean" zone, not derived from measured string data.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.STRINGS = [
  { id: "C", label: "C", freq: 65.41, factor: 1.4, color: "#8b5e3c" },
  { id: "G", label: "G", freq: 98.0, factor: 1.15, color: "#c9a24b" },
  { id: "D", label: "D", freq: 146.83, factor: 1.0, color: "#9fd08a" },
  { id: "A", label: "A", freq: 220.0, factor: 0.8, color: "#e3d9c6" },
];

CelloApp.STRING_LENGTH_CM = 69; // bridge to nut, typical 4/4 cello
CelloApp.SOUNDING_POINT_MIN_CM = 1.5; // near bridge (sul ponticello)
CelloApp.SOUNDING_POINT_MAX_CM = 12; // toward fingerboard (sul tasto)

CelloApp.Physics = (function () {
  var A = 0.0725; // min-force coefficient
  var B = 0.02628; // max-force coefficient

  function beta(soundingPointCm) {
    return soundingPointCm / CelloApp.STRING_LENGTH_CM;
  }

  // speedCmS: bow speed in cm/s
  // soundingPointCm: distance from the bridge where the bow contacts the string
  // tilt: 0 (flat hair) .. 1 (on the edge) - less hair contact lowers usable grip
  // stringFactor: per-string multiplier (thicker/lower strings need more force)
  function forceLimits(speedCmS, soundingPointCm, tilt, stringFactor) {
    var b = beta(soundingPointCm);
    var tiltFactor = 1 - tilt * 0.55;
    var fMin = ((A * speedCmS) / b) * stringFactor / tiltFactor;
    var fMax = ((B * speedCmS) / (b * b)) * stringFactor / tiltFactor;
    return { fMin: fMin, fMax: fMax };
  }

  function classify(force, fMin, fMax) {
    if (force < fMin) return "whistle";
    if (force > fMax) return "crunch";
    return "clean";
  }

  return { beta: beta, forceLimits: forceLimits, classify: classify };
})();
