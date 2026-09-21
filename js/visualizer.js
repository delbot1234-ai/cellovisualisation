// Draws the string (bridge -> fingerboard) with the bow crossing it,
// a vibration "ripple" near the contact point whose shape reflects the
// current tone zone, and the bow travelling frog <-> tip.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.Visualizer = (function () {
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

    var marginX = 64;
    var stringY = h * 0.4;
    var bridgeX = marginX;
    var fingerX = w - marginX;

    // Bridge
    ctx.strokeStyle = "#5c4326";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bridgeX, stringY - 28);
    ctx.lineTo(bridgeX, stringY + 28);
    ctx.stroke();
    ctx.fillStyle = "rgba(241,233,220,0.6)";
    ctx.font = "12px system-ui";
    ctx.fillText("Bridge", bridgeX - 18, stringY + 46);

    // Fingerboard end
    ctx.strokeStyle = "#3a2a18";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(fingerX, stringY - 20);
    ctx.lineTo(fingerX, stringY + 20);
    ctx.stroke();
    ctx.fillStyle = "rgba(241,233,220,0.6)";
    ctx.fillText("Fingerboard", fingerX - 32, stringY + 46);

    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.font = "11px system-ui";
    ctx.fillText("sul ponticello →", bridgeX + 4, stringY - 34);
    var tastoWidth = ctx.measureText("← sul tasto").width;
    ctx.fillText("← sul tasto", fingerX - tastoWidth, stringY - 34);

    // String
    ctx.strokeStyle = state.stringColor || "#e3d9c6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bridgeX, stringY);
    ctx.lineTo(fingerX, stringY);
    ctx.stroke();

    var contactX =
      bridgeX + (fingerX - bridgeX) * (state.soundingPointCm / CelloApp.STRING_LENGTH_CM);

    drawRipple(contactX, stringY, state);
    drawBow(contactX, stringY, w, h, state);

    ctx.fillStyle = "#ffd27f";
    ctx.beginPath();
    ctx.arc(contactX, stringY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRipple(contactX, stringY, state) {
    var zone = state.zone,
      phase = state.phase || 0;
    var amp, freqMul, jitter;
    if (zone === "clean") {
      amp = 10;
      freqMul = 1;
      jitter = 0.5;
    } else if (zone === "crunch") {
      amp = 15;
      freqMul = 2.2;
      jitter = 6;
    } else {
      amp = 4;
      freqMul = 3.2;
      jitter = 1.5;
    }

    ctx.strokeStyle =
      zone === "clean" ? "#8fd3ff" : zone === "crunch" ? "#ff8f6b" : "#c9c2ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    var span = 70;
    for (var x = -span; x <= span; x += 2) {
      var n = jitter ? (Math.random() - 0.5) * jitter : 0;
      var envelope = Math.cos(((x / span) * Math.PI) / 2);
      var y =
        stringY +
        Math.sin((x / span) * Math.PI * 2 * freqMul + phase) * amp * envelope +
        n * envelope;
      if (x === -span) ctx.moveTo(contactX + x, y);
      else ctx.lineTo(contactX + x, y);
    }
    ctx.stroke();
  }

  function drawBow(contactX, stringY, w, h, state) {
    var bowY = stringY + 88;
    var bowTrackLeft = 70;
    var bowTrackRight = w - 70;
    var bowLen = Math.min(130, (bowTrackRight - bowTrackLeft) * 0.5);
    var travel = bowTrackRight - bowTrackLeft - bowLen;
    var bowX = bowTrackLeft + travel * state.bowPositionFrac;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowTrackLeft, bowY);
    ctx.lineTo(bowTrackRight, bowY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui";
    ctx.fillText("Frog", bowTrackLeft - 6, bowY + 20);
    ctx.fillText("Tip", bowTrackRight - 16, bowY + 20);

    var hairWidth = 8 - state.tilt * 5;
    ctx.strokeStyle = "#f4e9d8";
    ctx.lineWidth = hairWidth;
    ctx.beginPath();
    ctx.moveTo(bowX, bowY);
    ctx.lineTo(bowX + bowLen, bowY);
    ctx.stroke();

    ctx.strokeStyle = "#3a2a18";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bowX, bowY + hairWidth / 2 + 4);
    ctx.lineTo(bowX + bowLen, bowY + hairWidth / 2 + 4);
    ctx.stroke();

    ctx.fillStyle = "#ffd27f";
    ctx.font = "13px system-ui";
    var arrow = state.direction >= 0 ? "→" : "←";
    var label = arrow + " " + (state.direction >= 0 ? "Down-bow" : "Up-bow");
    ctx.fillText(label, bowX + bowLen / 2 - ctx.measureText(label).width / 2, bowY - 14);

    ctx.strokeStyle = "rgba(255,210,127,0.35)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(bowX + bowLen / 2, bowY);
    ctx.lineTo(contactX, stringY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  return { init: init, resize: resize, draw: draw };
})();
