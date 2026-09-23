# Cello Bow Motion Explorer

An interactive, browser-based app for exploring how cello bowing technique
shapes tone. Adjust bow speed, force (weight), sounding point (distance from
the bridge), string, and bow hair tilt, and see — and hear — the effect in
real time.

## What it shows

- **String + bow view** — an animated bow travelling frog-to-tip across the
  string at the chosen sounding point, with a vibration "ripple" whose shape
  reflects the current tone quality.
- **Schelleng diagram** — the classic bow-force-vs-sounding-point chart used
  in string pedagogy/acoustics. The shaded band is the *playable* force range
  at the current bow speed; it widens with speed and narrows as you move the
  bow away from the bridge. A marker shows where your current settings land.
- **Live audio** — a Web Audio synth (sawtooth + filtered noise) that
  crossfades between a clean tone, a harsh "crunch" (too much force), and a
  thin "surface sound / whistle" (too little force), so the diagram's zones
  are audible as well as visible.
- **Wrist sensor input** — stream live accelerometer/gyro data from a
  WitMotion BLE sensor (e.g. worn on the bowing wrist) via Web Bluetooth, or
  load a recorded `.txt`/`.csv` export and play it back. Both paths feed a
  live chart, numeric readouts, and can optionally drive the bow animation's
  speed and direction from the real wrist motion.
- **Tuner & pitch practice** — real-time pitch detection from your
  microphone (note name + cents sharp/flat on a tuner meter), plus a
  practice mode: type in a sequence of notes (e.g. transcribed from sheet
  music) and it tracks which note you're on, auto-advancing once you play
  each one in tune.
- **Session view** — a live summary bar (target note, detected pitch, wrist
  sensor status, sequence progress) and a session log: every note you play
  in tune is recorded with its cents-accuracy, your bow speed from the
  wrist sensor at that moment (when connected and driving the animation),
  and a timestamp — one record tying your sheet-music sequence, intonation,
  and bow motion together. Exportable as CSV.

The force/speed/sounding-point relationship is a simplified, pedagogically
tuned model (inspired by Schelleng's bowing diagram), not a precise acoustic
simulation — it's built to make the *trends* explorable and audible.

## Wrist sensor notes

- **Live Bluetooth** needs Chrome or Edge (desktop or Android) served over
  **HTTPS or localhost** — Web Bluetooth isn't available on iOS at all, and
  won't work over plain `http://`. GitHub Pages (or any HTTPS static host)
  works well for testing on a phone.
- WitMotion doesn't use one standardized GATT UUID across every sensor
  model. The app defaults to the commonly used WT901BLE/BWT901BLE UUIDs and
  falls back to any notifying characteristic it can find; if your sensor
  isn't recognized, open the **Advanced: manual UUIDs** section, find the
  correct service/characteristic UUID with a generic BLE scanner app (e.g.
  nRF Connect), and enter them there before connecting.
- The **Raw frame monitor** (in the sensor panel) shows decoded frame bytes
  live, which is the fastest way to confirm or debug the protocol against
  real hardware.
- The **file playback** parser looks for a header row and matches columns by
  keyword (`ax`, `ay`, `az`, `wx`/`gx`, angle columns, etc.), so it should
  handle most WitMotion app export variants; if it can't find a header it
  falls back to a documented guessed column order and shows a warning.
- "Drive the bow animation from this sensor" maps one chosen axis (default:
  gyro Z) to bow speed/direction as a simple proxy for stroke motion — it's
  not a full reconstruction of bow position, since a wrist-worn IMU alone
  can't disambiguate bow position on the string from other wrist movement.

## Tuner notes

- Needs a microphone and, like the Bluetooth sensor, **HTTPS or localhost**
  (works in Chrome, Firefox, Edge, and Safari — broader support than Web
  Bluetooth since this only needs `getUserMedia`, not Web Bluetooth). Audio
  is processed entirely in the browser and never leaves your device.
- Pitch detection uses autocorrelation on the raw waveform, tuned for the
  cello's range (~55–1400 Hz). It tracks one note at a time — double stops,
  chords, or heavy background noise won't detect reliably.
- The note-sequence box takes note names like `C3`, `F#4`, `Bb2` (letter,
  optional `#`/`b`/`##`/`bb`, octave number), separated by spaces or commas.
  There's no automatic sheet-music/image reading built in (that's a hard,
  unreliable problem to solve well), so notes are transcribed into this
  format by hand.
- A note counts as "in tune" within ±15 cents, and has to hold for ~400ms
  before it's marked correct and (optionally) auto-advances to the next
  note.

## Android app

The app is also packaged for Google Play as a Trusted Web Activity (the
hosted web app running full-screen inside Chrome, which keeps Web
Bluetooth and the microphone working). It's installable as a PWA too, and
works offline once loaded. See **[ANDROID.md](ANDROID.md)** for hosting,
building, signing, and publishing steps.

## Running it

No build step or dependencies. Just open `index.html` in a modern browser
(Chrome, Firefox, Edge, Safari), or serve the folder with any static file
server, e.g.:

```sh
python3 -m http.server 8000
```

then visit `http://localhost:8000`. Click **Start bowing** to hear audio —
browsers require a user gesture before audio can play.

## Files

- `index.html` — page structure and controls
- `css/styles.css` — styling
- `js/physics.js` — Schelleng-style min/max bow force model
- `js/audio.js` — Web Audio synthesis engine
- `js/visualizer.js` — string + bow canvas animation
- `js/diagram.js` — Schelleng diagram canvas
- `js/witmotionParser.js` — decodes WitMotion's binary IMU packet protocol
- `js/bleConnector.js` — Web Bluetooth connection + service/characteristic discovery
- `js/sensorFileParser.js` — flexible parser for recorded WitMotion text/CSV exports
- `js/sensorChart.js` — rolling accelerometer/gyro strip-chart
- `js/noteUtils.js` — note name ↔ MIDI ↔ frequency conversions and sequence parsing
- `js/pitchDetector.js` — autocorrelation-based pitch detection
- `js/micTuner.js` — microphone capture + pitch detection loop
- `js/main.js` — wires controls, state, and the animation loop together
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA manifest, offline service worker, app icons
- `privacy.html` — privacy policy
- `android/` — Android (Trusted Web Activity) project
- `store/` — Google Play listing assets
- `.github/workflows/` — GitHub Pages deployment and Android build
