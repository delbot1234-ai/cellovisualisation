// Web Audio synthesis: a sawtooth "string" oscillator blended with filtered
// noise, crossfaded and shaped per tone zone so the three regions of the
// Schelleng diagram (clean / crunch / whistle) are audibly distinct.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.AudioEngine = (function () {
  var ctx = null;
  var osc, oscGain, lowpass, waveshaper;
  var noiseSource, noiseGain, noiseFilter;
  var masterGain;
  var running = false;

  function makeNoiseBuffer(context) {
    var bufferSize = context.sampleRate * 2;
    var buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function makeDistortionCurve(amount) {
    var k = amount;
    var n = 2048;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((3 + k) * x * 20 * Math.PI) / 180 / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    osc = ctx.createOscillator();
    osc.type = "sawtooth";

    waveshaper = ctx.createWaveShaper();
    waveshaper.curve = makeDistortionCurve(0);
    waveshaper.oversample = "2x";

    lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2500;

    oscGain = ctx.createGain();
    oscGain.gain.value = 0;

    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = makeNoiseBuffer(ctx);
    noiseSource.loop = true;

    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 4000;
    noiseFilter.Q.value = 0.7;

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;

    masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    osc.connect(waveshaper);
    waveshaper.connect(lowpass);
    lowpass.connect(oscGain);
    oscGain.connect(masterGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    masterGain.connect(ctx.destination);

    osc.start();
    noiseSource.start();
  }

  function start() {
    ensureContext();
    if (ctx.state === "suspended") ctx.resume();
    running = true;
  }

  function stop() {
    if (!ctx) return;
    running = false;
    var now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(0, now, 0.08);
  }

  // params: { freq, zone, speed, force, tilt, volume(0..1), bowIntensity(0..1) }
  function update(params) {
    if (!ctx || !running) return;
    var freq = params.freq,
      zone = params.zone,
      speed = params.speed,
      force = params.force,
      tilt = params.tilt,
      volume = params.volume == null ? 1 : params.volume,
      bowIntensity = params.bowIntensity == null ? 1 : params.bowIntensity;

    var now = ctx.currentTime;
    var t = 0.04;

    osc.frequency.setTargetAtTime(freq, now, t);

    var speedNorm = Math.min(1, speed / 100);
    var forceNorm = Math.min(1.4, force / 150);

    var oscTarget, noiseTarget, distortionAmt, noiseFreq, lowpassFreq;

    if (zone === "clean") {
      oscTarget = 0.75;
      noiseTarget = 0.04;
      distortionAmt = 2 + forceNorm * 4;
      noiseFreq = 3500;
      lowpassFreq = 1800 + speedNorm * 2500;
    } else if (zone === "crunch") {
      oscTarget = 0.55;
      noiseTarget = 0.28;
      distortionAmt = 25 + forceNorm * 60;
      noiseFreq = 1800;
      lowpassFreq = 2200 + speedNorm * 3000;
    } else {
      oscTarget = 0.18;
      noiseTarget = 0.42;
      distortionAmt = 1;
      noiseFreq = 6000;
      lowpassFreq = 900 + speedNorm * 800;
    }

    var tiltBreath = 1 + tilt * 0.6;
    noiseTarget = Math.min(0.7, noiseTarget * tiltBreath);
    oscTarget = oscTarget / tiltBreath;

    oscGain.gain.setTargetAtTime(oscTarget * bowIntensity * (0.5 + 0.5 * speedNorm), now, t);
    noiseGain.gain.setTargetAtTime(noiseTarget * bowIntensity, now, t);
    lowpass.frequency.setTargetAtTime(lowpassFreq, now, t);
    noiseFilter.frequency.setTargetAtTime(noiseFreq, now, t);
    waveshaper.curve = makeDistortionCurve(distortionAmt);

    masterGain.gain.setTargetAtTime(running ? 0.6 * volume : 0, now, t);
  }

  return { start: start, stop: stop, update: update, isRunning: function () { return running; } };
})();
