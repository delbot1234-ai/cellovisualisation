(function () {
  var Physics = CelloApp.Physics;
  var Audio = CelloApp.AudioEngine;
  var Visualizer = CelloApp.Visualizer;
  var Diagram = CelloApp.Diagram;

  var WitMotion = CelloApp.WitMotion;
  var Ble = CelloApp.BleConnector;
  var SensorFile = CelloApp.SensorFile;
  var SensorChart = CelloApp.SensorChart;

  var stringCanvas = document.getElementById("stringCanvas");
  var diagramCanvas = document.getElementById("diagramCanvas");
  var sensorChartCanvas = document.getElementById("sensorChartCanvas");
  Visualizer.init(stringCanvas);
  Diagram.init(diagramCanvas);
  SensorChart.init(sensorChartCanvas);

  var stringButtonsEl = document.getElementById("stringButtons");
  var speedSlider = document.getElementById("speedSlider");
  var forceSlider = document.getElementById("forceSlider");
  var soundingPointSlider = document.getElementById("soundingPointSlider");
  var tiltSlider = document.getElementById("tiltSlider");
  var volumeSlider = document.getElementById("volumeSlider");
  var playButton = document.getElementById("playButton");
  var resetButton = document.getElementById("resetButton");

  var speedValueEl = document.getElementById("speedValue");
  var forceValueEl = document.getElementById("forceValue");
  var soundingPointValueEl = document.getElementById("soundingPointValue");
  var tiltValueEl = document.getElementById("tiltValue");
  var volumeValueEl = document.getElementById("volumeValue");

  var zoneDot = document.getElementById("zoneDot");
  var zoneLabel = document.getElementById("zoneLabel");

  var bleConnectButton = document.getElementById("bleConnectButton");
  var fileInput = document.getElementById("fileInput");
  var sensorStatus = document.getElementById("sensorStatus");
  var fileWarning = document.getElementById("fileWarning");
  var playbackControls = document.getElementById("playbackControls");
  var playbackToggle = document.getElementById("playbackToggle");
  var playbackScrub = document.getElementById("playbackScrub");
  var playbackSpeedSelect = document.getElementById("playbackSpeed");
  var serviceUuidInput = document.getElementById("serviceUuidInput");
  var charUuidInput = document.getElementById("charUuidInput");
  var axValue = document.getElementById("axValue");
  var ayValue = document.getElementById("ayValue");
  var azValue = document.getElementById("azValue");
  var gxValue = document.getElementById("gxValue");
  var gyValue = document.getElementById("gyValue");
  var gzValue = document.getElementById("gzValue");
  var chartModeButtons = document.getElementById("chartModeButtons");
  var driveBowCheckbox = document.getElementById("driveBowCheckbox");
  var driveBowOptions = document.getElementById("driveBowOptions");
  var axisSelect = document.getElementById("axisSelect");
  var sensitivitySlider = document.getElementById("sensitivitySlider");
  var sensitivityValue = document.getElementById("sensitivityValue");
  var rawMonitor = document.getElementById("rawMonitor");

  var DEFAULTS = {
    stringId: "D",
    speed: 30,
    force: 80,
    soundingPoint: 5,
    tilt: 20,
    volume: 70,
  };

  var state = {
    stringId: DEFAULTS.stringId,
    speed: DEFAULTS.speed,
    force: DEFAULTS.force,
    soundingPointCm: DEFAULTS.soundingPoint,
    tilt: DEFAULTS.tilt / 100,
    volume: DEFAULTS.volume / 100,
    bowPositionFrac: 0.5,
    direction: 1,
    phase: 0,
    playing: false,
  };

  var sensor = {
    latestSample: null,
    mode: "off", // 'off' | 'live' | 'playback'
    driveBow: false,
    axis: "gz",
    sensitivity: 1.5,
    smoothedMagnitude: 0,
    recording: null, // { samples, warning }
    playbackIndex: 0,
    playbackElapsed: 0,
    playbackPlaying: false,
    playbackRate: 1,
  };

  function currentStringDef() {
    for (var i = 0; i < CelloApp.STRINGS.length; i++) {
      if (CelloApp.STRINGS[i].id === state.stringId) return CelloApp.STRINGS[i];
    }
    return CelloApp.STRINGS[0];
  }

  function buildStringButtons() {
    stringButtonsEl.innerHTML = "";
    CelloApp.STRINGS.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = s.label;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", s.id === state.stringId ? "true" : "false");
      if (s.id === state.stringId) btn.classList.add("active");
      btn.addEventListener("click", function () {
        state.stringId = s.id;
        Array.prototype.forEach.call(stringButtonsEl.children, function (c) {
          c.classList.remove("active");
          c.setAttribute("aria-checked", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-checked", "true");
      });
      stringButtonsEl.appendChild(btn);
    });
  }

  function fmt(n, decimals) {
    return Number(n).toFixed(decimals == null ? 0 : decimals);
  }

  function syncSlidersFromState() {
    speedSlider.value = state.speed;
    forceSlider.value = state.force;
    soundingPointSlider.value = state.soundingPointCm;
    tiltSlider.value = Math.round(state.tilt * 100);
    volumeSlider.value = Math.round(state.volume * 100);
    updateReadouts();
  }

  function updateReadouts() {
    speedValueEl.textContent = fmt(state.speed) + " cm/s";
    forceValueEl.textContent = fmt(state.force) + " g";
    soundingPointValueEl.textContent = fmt(state.soundingPointCm, 1) + " cm";
    tiltValueEl.textContent = fmt(state.tilt * 100) + "%";
    volumeValueEl.textContent = fmt(state.volume * 100) + "%";
  }

  speedSlider.addEventListener("input", function () {
    state.speed = parseFloat(speedSlider.value);
    updateReadouts();
  });
  forceSlider.addEventListener("input", function () {
    state.force = parseFloat(forceSlider.value);
    updateReadouts();
  });
  soundingPointSlider.addEventListener("input", function () {
    state.soundingPointCm = parseFloat(soundingPointSlider.value);
    updateReadouts();
  });
  tiltSlider.addEventListener("input", function () {
    state.tilt = parseFloat(tiltSlider.value) / 100;
    updateReadouts();
  });
  volumeSlider.addEventListener("input", function () {
    state.volume = parseFloat(volumeSlider.value) / 100;
    updateReadouts();
  });

  resetButton.addEventListener("click", function () {
    state.stringId = DEFAULTS.stringId;
    state.speed = DEFAULTS.speed;
    state.force = DEFAULTS.force;
    state.soundingPointCm = DEFAULTS.soundingPoint;
    state.tilt = DEFAULTS.tilt / 100;
    state.volume = DEFAULTS.volume / 100;
    buildStringButtons();
    syncSlidersFromState();
  });

  playButton.addEventListener("click", function () {
    state.playing = !state.playing;
    if (state.playing) {
      Audio.start();
      playButton.textContent = "Stop bowing";
      playButton.classList.add("active");
    } else {
      Audio.stop();
      playButton.textContent = "Start bowing";
      playButton.classList.remove("active");
    }
  });

  // ---- Wrist sensor: BLE streaming, file playback, chart, raw monitor ----

  function fmtSigned(n) {
    return (n >= 0 ? "+" : "") + n.toFixed(2);
  }

  function updateSensorReadouts(sample) {
    axValue.textContent = fmtSigned(sample.ax || 0);
    ayValue.textContent = fmtSigned(sample.ay || 0);
    azValue.textContent = fmtSigned(sample.az || 0);
    gxValue.textContent = fmtSigned(sample.gx || 0);
    gyValue.textContent = fmtSigned(sample.gy || 0);
    gzValue.textContent = fmtSigned(sample.gz || 0);
  }

  function handleSensorSample(sample, tMs) {
    sensor.latestSample = sample;
    updateSensorReadouts(sample);
    SensorChart.push(sample, tMs);
  }

  var witmotionStream = WitMotion.createStream({
    onSample: function (sample) {
      handleSensorSample(sample, performance.now());
    },
    onRawFrame: function (info) {
      var line = "0x" + info.flag.toString(16).padStart(2, "0") + "  " + info.hex;
      rawMonitor.textContent = (line + "\n" + rawMonitor.textContent).slice(0, 4000);
    },
  });

  bleConnectButton.addEventListener("click", function () {
    if (Ble.isConnected()) {
      Ble.disconnect();
      sensor.mode = "off";
      bleConnectButton.textContent = "Connect via Bluetooth";
      sensorStatus.textContent = "Not connected";
      return;
    }

    var extra = {
      service: serviceUuidInput.value.trim(),
      characteristic: charUuidInput.value.trim(),
    };

    bleConnectButton.disabled = true;
    Ble.connect(
      {
        onStatus: function (text) {
          sensorStatus.textContent = text;
        },
        onRawChunk: function (bytes) {
          witmotionStream.append(bytes);
        },
        onDisconnect: function () {
          sensor.mode = "off";
          bleConnectButton.textContent = "Connect via Bluetooth";
          bleConnectButton.disabled = false;
        },
      },
      extra
    )
      .then(function () {
        sensor.mode = "live";
        bleConnectButton.textContent = "Disconnect";
        bleConnectButton.disabled = false;
      })
      .catch(function (err) {
        sensorStatus.textContent = err.message || String(err);
        bleConnectButton.disabled = false;
      });
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var result = SensorFile.parse(String(reader.result));
      sensor.recording = result;
      sensor.mode = "playback";
      sensor.playbackIndex = 0;
      sensor.playbackElapsed = 0;
      sensor.playbackPlaying = false;
      SensorChart.reset();
      fileWarning.textContent = result.warning || "";
      playbackControls.hidden = result.samples.length === 0;
      playbackScrub.value = 0;
      playbackToggle.textContent = "Play";
      sensorStatus.textContent =
        result.samples.length + " samples loaded from " + file.name;
    };
    reader.readAsText(file);
  });

  playbackToggle.addEventListener("click", function () {
    if (!sensor.recording || !sensor.recording.samples.length) return;
    sensor.playbackPlaying = !sensor.playbackPlaying;
    playbackToggle.textContent = sensor.playbackPlaying ? "Pause" : "Play";
  });

  playbackScrub.addEventListener("input", function () {
    if (!sensor.recording) return;
    var samples = sensor.recording.samples;
    var duration = samples[samples.length - 1].t || 1;
    sensor.playbackElapsed = parseFloat(playbackScrub.value) * duration;
    sensor.playbackIndex = 0;
  });

  playbackSpeedSelect.addEventListener("change", function () {
    sensor.playbackRate = parseFloat(playbackSpeedSelect.value);
  });

  Array.prototype.forEach.call(chartModeButtons.children, function (btn) {
    btn.addEventListener("click", function () {
      Array.prototype.forEach.call(chartModeButtons.children, function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      SensorChart.setMode(btn.dataset.mode);
    });
  });

  driveBowCheckbox.addEventListener("change", function () {
    sensor.driveBow = driveBowCheckbox.checked;
    driveBowOptions.hidden = !sensor.driveBow;
    speedSlider.disabled = sensor.driveBow;
  });
  axisSelect.addEventListener("change", function () {
    sensor.axis = axisSelect.value;
  });
  sensitivitySlider.addEventListener("input", function () {
    sensor.sensitivity = parseFloat(sensitivitySlider.value);
    sensitivityValue.textContent = sensor.sensitivity.toFixed(1) + "×";
  });
  sensitivitySlider.value = sensor.sensitivity;
  sensitivityValue.textContent = sensor.sensitivity.toFixed(1) + "×";

  function stepPlayback(dt) {
    var samples = sensor.recording.samples;
    if (!samples.length) return;
    sensor.playbackElapsed += dt * sensor.playbackRate;
    var duration = samples[samples.length - 1].t || 1;
    if (sensor.playbackElapsed >= duration) {
      sensor.playbackElapsed = duration;
      sensor.playbackPlaying = false;
      playbackToggle.textContent = "Play";
    }

    while (
      sensor.playbackIndex < samples.length &&
      samples[sensor.playbackIndex].t <= sensor.playbackElapsed
    ) {
      handleSensorSample(samples[sensor.playbackIndex], performance.now());
      sensor.playbackIndex++;
    }
    playbackScrub.value = duration > 0 ? sensor.playbackElapsed / duration : 0;
  }

  // Map a chosen sensor axis into a bow speed (cm/s) + direction, with light
  // smoothing. This is a simple proxy (wrist rotation/acceleration magnitude
  // -> stroke speed), not a physical reconstruction of bow position.
  function updateSensorDrivenBow(dt) {
    if (!sensor.latestSample) return;
    var raw = sensor.latestSample[sensor.axis] || 0;
    var magnitude = Math.abs(raw) * sensor.sensitivity;
    var smoothingRate = Math.min(1, dt * 8);
    sensor.smoothedMagnitude += (magnitude - sensor.smoothedMagnitude) * smoothingRate;

    var mappedSpeed = Math.max(5, Math.min(100, sensor.smoothedMagnitude));
    state.speed = mappedSpeed;
    var dir = raw >= 0 ? 1 : -1;
    state.direction = dir;

    var delta = (dt * mappedSpeed) / FULL_BOW_LENGTH_CM;
    state.bowPositionFrac = Math.max(0, Math.min(1, state.bowPositionFrac + delta * dir));
    state.phase += dt * (6 + mappedSpeed * 0.15);
  }

  // ---- end wrist sensor wiring ----

  function bowIntensity(pos) {
    var edge = 0.06;
    if (pos < edge) return pos / edge;
    if (pos > 1 - edge) return (1 - pos) / edge;
    return 1;
  }

  var FULL_BOW_LENGTH_CM = 60;
  var lastTime = null;

  function tick(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (sensor.mode === "playback" && sensor.playbackPlaying && sensor.recording) {
      stepPlayback(dt);
    }

    var sensorDriving = sensor.driveBow && sensor.latestSample && sensor.mode !== "off";

    if (sensorDriving) {
      updateSensorDrivenBow(dt);
    } else if (state.playing) {
      var delta = (dt * state.speed) / FULL_BOW_LENGTH_CM;
      state.bowPositionFrac += delta * state.direction;
      if (state.bowPositionFrac >= 1) {
        state.bowPositionFrac = 1;
        state.direction = -1;
      } else if (state.bowPositionFrac <= 0) {
        state.bowPositionFrac = 0;
        state.direction = 1;
      }
      state.phase += dt * (6 + state.speed * 0.15);
    }

    SensorChart.draw(performance.now());

    var stringDef = currentStringDef();
    var limits = Physics.forceLimits(state.speed, state.soundingPointCm, state.tilt, stringDef.factor);
    var zone = Physics.classify(state.force, limits.fMin, limits.fMax);

    var vizState = {
      soundingPointCm: state.soundingPointCm,
      bowPositionFrac: state.bowPositionFrac,
      direction: state.direction,
      zone: zone,
      tilt: state.tilt,
      phase: state.phase,
      stringColor: stringDef.color,
    };
    Visualizer.draw(vizState);

    var diagramState = {
      speed: state.speed,
      tilt: state.tilt,
      stringFactor: stringDef.factor,
      soundingPointCm: state.soundingPointCm,
      force: state.force,
      zone: zone,
    };
    Diagram.draw(diagramState);

    zoneDot.style.background = zone === "clean" ? "#7cffb2" : zone === "crunch" ? "#ff8f6b" : "#b8a8ff";
    zoneLabel.textContent =
      zone === "clean" ? "Clear tone" : zone === "crunch" ? "Crunch (too much force)" : "Surface sound / whistle (too little force)";

    if (state.playing) {
      Audio.update({
        freq: stringDef.freq,
        zone: zone,
        speed: state.speed,
        force: state.force,
        tilt: state.tilt,
        volume: state.volume,
        bowIntensity: bowIntensity(state.bowPositionFrac),
      });
    }

    requestAnimationFrame(tick);
  }

  function handleResize() {
    Visualizer.resize();
    Diagram.resize();
    SensorChart.resize();
  }

  window.addEventListener("resize", handleResize);

  if (!Ble.isSupported()) {
    bleConnectButton.disabled = true;
    bleConnectButton.title = "Web Bluetooth isn't available in this browser (use Chrome/Edge on desktop or Android).";
    sensorStatus.textContent = "Bluetooth not supported in this browser — file playback still works.";
  } else if (!Ble.isSecureContext()) {
    bleConnectButton.disabled = true;
    bleConnectButton.title = "Bluetooth requires HTTPS (or localhost).";
    sensorStatus.textContent = "Serve this page over HTTPS to connect via Bluetooth — file playback still works.";
  }

  buildStringButtons();
  syncSlidersFromState();
  handleResize();
  requestAnimationFrame(tick);
})();
