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

The force/speed/sounding-point relationship is a simplified, pedagogically
tuned model (inspired by Schelleng's bowing diagram), not a precise acoustic
simulation — it's built to make the *trends* explorable and audible.

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
- `js/main.js` — wires controls, state, and the animation loop together
