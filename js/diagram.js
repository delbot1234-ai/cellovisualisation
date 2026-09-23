// Draws the classic "Schelleng diagram": bow force vs sounding point, with
// the shaded region between the min/max force curves (at the current bow
// speed) representing the playable "clean tone" window, and a marker for
// the current operating point.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.Diagram = (function () {
  var canvas, ctx;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(state) {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    var padL = 46,
      padR = 16,
      padT = 30,
      padB = 34;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    var xMin = CelloApp.SOUNDING_POINT_MIN_CM;
    var xMax = CelloApp.SOUNDING_POINT_MAX_CM;
    var yMax = 320; // grams, display ceiling

    function xPix(cm) {
      return padL + ((cm - xMin) / (xMax - xMin)) * plotW;
    }
    function yPix(g) {
      return padT + plotH - (Math.min(g, yMax) / yMax) * plotH;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px system-ui";

    // Use the longest label variant that fits the available width.
    function fitLabel(variants, maxWidth) {
      for (var i = 0; i < variants.length; i++) {
        if (ctx.measureText(variants[i]).width <= maxWidth) return variants[i];
      }
      return variants[variants.length - 1];
    }

    ctx.fillText("force (g)", 4, padT - 12);
    ctx.fillText(
      fitLabel(["sounding point: bridge → fingerboard (cm)", "bridge → fingerboard (cm)"], w - padL - 4),
      padL,
      h - 4
    );
    var crunchLabel = fitLabel(["crunch (too much force)", "crunch"], plotW - 60);
    ctx.fillText(crunchLabel, padL + plotW - ctx.measureText(crunchLabel).width, padT - 12);
    ctx.fillText(
      fitLabel(["whistle / surface sound (too little force)", "whistle (too little force)"], w - padL - 4),
      padL,
      h - 18
    );

    var steps = 40;
    var minPts = [];
    var maxPts = [];
    for (var i = 0; i <= steps; i++) {
      var cm = xMin + (xMax - xMin) * (i / steps);
      var lim = CelloApp.Physics.forceLimits(state.speed, cm, state.tilt, state.stringFactor);
      minPts.push([xPix(cm), yPix(lim.fMin)]);
      maxPts.push([xPix(cm), yPix(lim.fMax)]);
    }

    ctx.beginPath();
    minPts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    for (var j = maxPts.length - 1; j >= 0; j--) ctx.lineTo(maxPts[j][0], maxPts[j][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(124, 255, 178, 0.16)";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,143,107,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    maxPts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();

    ctx.strokeStyle = "rgba(140,190,255,0.85)";
    ctx.beginPath();
    minPts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();

    var px = xPix(state.soundingPointCm);
    var py = Math.max(padT + 4, Math.min(padT + plotH - 4, yPix(state.force)));
    ctx.fillStyle =
      state.zone === "clean" ? "#7cffb2" : state.zone === "crunch" ? "#ff8f6b" : "#b8a8ff";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return { init: init, resize: resize, draw: draw };
})();
