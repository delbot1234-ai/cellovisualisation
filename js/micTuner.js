// Wraps getUserMedia + an AnalyserNode to feed the autocorrelation pitch
// detector from live microphone input.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.MicTuner = (function () {
  var PitchDetector = CelloApp.PitchDetector;
  var NoteUtils = CelloApp.NoteUtils;

  var ctx = null;
  var analyser = null;
  var stream = null;
  var source = null;
  var buffer = null;
  var running = false;
  var frameCounter = 0;
  var PROCESS_EVERY_N_FRAMES = 2; // ~30Hz at a 60fps rAF, plenty for a tuner

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function isSecureContext() {
    return window.isSecureContext === true;
  }

  function loop(onPitch) {
    if (!running) return;
    frameCounter++;
    if (frameCounter % PROCESS_EVERY_N_FRAMES === 0) {
      analyser.getFloatTimeDomainData(buffer);
      var freq = PitchDetector.autoCorrelate(buffer, ctx.sampleRate);
      if (freq > 0) {
        onPitch(Object.assign({ freq: freq }, NoteUtils.freqToNote(freq)));
      } else {
        onPitch(null);
      }
    }
    requestAnimationFrame(function () {
      loop(onPitch);
    });
  }

  // handlers: { onPitch(result|null), onStatus(text) }
  function start(handlers) {
    handlers = handlers || {};
    var onPitch = handlers.onPitch || function () {};
    var onStatus = handlers.onStatus || function () {};

    if (!isSupported()) {
      return Promise.reject(new Error("Microphone access isn't available in this browser."));
    }
    if (!isSecureContext()) {
      return Promise.reject(new Error("Microphone access requires HTTPS (or localhost)."));
    }

    onStatus("Requesting microphone…");
    return navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (s) {
        stream = s;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        buffer = new Float32Array(analyser.fftSize);
        source.connect(analyser);

        running = true;
        frameCounter = 0;
        loop(onPitch);
        onStatus("Listening…");
      });
  }

  function stop() {
    running = false;
    if (stream) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      stream = null;
    }
    if (ctx) {
      ctx.close();
      ctx = null;
    }
    analyser = null;
    source = null;
  }

  function isRunning() {
    return running;
  }

  return { isSupported: isSupported, isSecureContext: isSecureContext, start: start, stop: stop, isRunning: isRunning };
})();
