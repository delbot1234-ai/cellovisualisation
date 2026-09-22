// Rolling strip-chart for live/playback sensor data: shows the last few
// seconds of either the accelerometer (ax/ay/az) or gyroscope (gx/gy/gz)
// channels, auto-scaled to the visible range.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.SensorChart = (function () {
  var canvas, ctx;
  var history = []; // { t (ms, monotonic), ax, ay, az, gx, gy, gz }
  var windowMs = 5000;
  var mode = "accel"; // 'accel' | 'gyro'

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

  function setMode(m) {
    mode = m;
  }

  function push(sample, tMs) {
    history.push({
      t: tMs,
      ax: sample.ax || 0,
      ay: sample.ay || 0,
      az: sample.az || 0,
      gx: sample.gx || 0,
      gy: sample.gy || 0,
      gz: sample.gz || 0,
    });
    var cutoff = tMs - windowMs;
    while (history.length && history[0].t < cutoff) history.shift();
  }

  function reset() {
    history = [];
  }

  function draw(nowMs) {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (history.length < 2) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "12px system-ui";
      ctx.fillText("No sensor data yet", 12, h / 2);
      return;
    }

    var keys = mode === "accel" ? ["ax", "ay", "az"] : ["gx", "gy", "gz"];
    var colors = mode === "accel" ? ["#8fd3ff", "#7cffb2", "#ffd27f"] : ["#ff8f6b", "#c9c2ff", "#e3d9c6"];
    var unit = mode === "accel" ? "g" : "°/s";

    var minV = Infinity,
      maxV = -Infinity;
    history.forEach(function (s) {
      keys.forEach(function (k) {
        if (s[k] < minV) minV = s[k];
        if (s[k] > maxV) maxV = s[k];
      });
    });
    if (minV === maxV) {
      minV -= 1;
      maxV += 1;
    }
    var pad = (maxV - minV) * 0.1;
    minV -= pad;
    maxV += pad;

    var padL = 34,
      padR = 8,
      padT = 8,
      padB = 8;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var tMin = nowMs - windowMs;

    function xPix(t) {
      return padL + ((t - tMin) / windowMs) * plotW;
    }
    function yPix(v) {
      return padT + plotH - ((v - minV) / (maxV - minV)) * plotH;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui";
    ctx.fillText(maxV.toFixed(1), 2, yPix(maxV) + 8);
    ctx.fillText(minV.toFixed(1), 2, yPix(minV));
    ctx.fillText(unit, 2, padT - 2 < 8 ? 8 : padT - 2);

    keys.forEach(function (k, ki) {
      ctx.strokeStyle = colors[ki];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      history.forEach(function (s, i) {
        var x = xPix(s.t);
        var y = yPix(s[k]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    var legendX = padL + 4;
    keys.forEach(function (k, ki) {
      ctx.fillStyle = colors[ki];
      ctx.fillRect(legendX, 2, 8, 8);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(k, legendX + 11, 10);
      legendX += 40;
    });
  }

  return { init: init, resize: resize, setMode: setMode, push: push, reset: reset, draw: draw };
})();
