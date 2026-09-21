(function () {
  var Physics = CelloApp.Physics;
  var Audio = CelloApp.AudioEngine;
  var Visualizer = CelloApp.Visualizer;
  var Diagram = CelloApp.Diagram;

  var stringCanvas = document.getElementById("stringCanvas");
  var diagramCanvas = document.getElementById("diagramCanvas");
  Visualizer.init(stringCanvas);
  Diagram.init(diagramCanvas);

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

    if (state.playing) {
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
  }

  window.addEventListener("resize", handleResize);

  buildStringButtons();
  syncSlidersFromState();
  handleResize();
  requestAnimationFrame(tick);
})();
