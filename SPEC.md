# Cello Bow Motion Explorer — Specification

## Purpose

A browser-based, no-build-step app for exploring how cello bowing technique
(speed, force, sounding point, tilt) shapes tone — visually, physically, and
audibly — with an optional path to drive the visualization from a real
wrist-worn accelerometer/gyro sensor (WitMotion BLE).

## Platform requirements

| Feature | Requirement |
|---|---|
| Core app (visuals, audio, controls) | Any modern browser (Chrome, Firefox, Edge, Safari). No build step — open `index.html` directly, or serve statically. |
| Sensor file playback | Any modern browser. No special requirements. |
| Live Bluetooth streaming | Chrome or Edge, desktop or Android. Requires HTTPS or `localhost` (Web Bluetooth is blocked on plain HTTP and unavailable on iOS entirely). |

## 1. Bowing simulation

### 1.1 Controls

| Control | Range | Notes |
|---|---|---|
| String | C / G / D / A | Sets open-string pitch and a per-string force multiplier (thicker/lower strings need more force). |
| Bow speed | 5–100 cm/s | Drives bow travel rate and tone brightness. |
| Bow force / weight | 10–300 g | Downward pressure into the string. |
| Sounding point | 1.5–12 cm from bridge | Sul ponticello (near bridge) ↔ sul tasto (near fingerboard). |
| Bow hair tilt | 0–100% | Flat hair ↔ on the edge; reduces effective grip and adds breathiness. |
| Volume | 0–100% | Master output level. |

Reset button restores all controls to defaults (D string, 30 cm/s, 80 g,
5 cm, 20% tilt, 70% volume) — this default combination is tuned to land in
the "clean tone" zone.

### 1.2 Tone-quality model (Schelleng diagram)

A simplified, pedagogically-tuned version of Schelleng's bowing diagram
(`js/physics.js`) computes a minimum and maximum usable bow force from bow
speed, sounding point, string, and tilt:

- `fMin = A · speed / β · stringFactor / tiltFactor`
- `fMax = B · speed / β² · stringFactor / tiltFactor`

where `β` = sounding point distance ÷ string length (69 cm), and
`A = 0.0725`, `B = 0.02628` are tuned constants (not measured acoustic
data). Current force is classified as:

- **below `fMin`** → *surface sound / whistle* (bow slips too easily)
- **between `fMin` and `fMax`** → *clean tone* (Helmholtz motion)
- **above `fMax`** → *crunch* (multiple string slips per cycle)

This drives the zone badge, the string-view ripple shape, the Schelleng
diagram's shaded band + marker, and the audio synthesis.

### 1.3 Visuals (`js/visualizer.js`, `js/diagram.js`)

- **String + bow view**: horizontal string from bridge to fingerboard, a
  bow bar that travels frog↔tip at the chosen sounding point, a direction
  arrow (down-bow/up-bow), and a vibration "ripple" near the contact point
  whose amplitude/jitter reflects the current tone zone.
- **Schelleng diagram**: force (g) vs. sounding point (cm), with a shaded
  band for the currently-playable force range (at the current speed) and a
  live marker for the current operating point.

### 1.4 Audio (`js/audio.js`)

Web Audio synthesis: a sawtooth oscillator (pitched to the selected open
string) blended with filtered white noise, crossfaded and filtered per tone
zone (clean/crunch/whistle) via gain, a waveshaper (distortion for crunch),
and lowpass/bandpass filters. Audio only plays while **Start bowing** is
active (Web Audio requires a user gesture to start).

## 2. Wrist sensor integration (WitMotion)

### 2.1 Data sources

- **Live BLE streaming** (`js/bleConnector.js`, `js/witmotionParser.js`):
  connects via Web Bluetooth, discovers a notifying GATT characteristic
  (defaults to the WitMotion BLE5.0 UUIDs below, with manual override),
  and decodes WitMotion's binary IMU packet protocol in real time.
- **Recorded file playback** (`js/sensorFileParser.js`): parses a
  WitMotion app `.txt`/`.csv` export (flexible header-keyword column
  detection, with a documented fallback guess if no header is found) and
  replays it on a reconstructed timeline.

Both paths feed the same pipeline: live numeric readouts (ax/ay/az,
gx/gy/gz), a rolling strip-chart (`js/sensorChart.js`, accelerometer or
gyroscope view), and a raw-frame debug monitor.

### 2.2 Protocol (confirmed for WT9011DCL / WitMotion BLE5.0 family)

| | |
|---|---|
| Service UUID | `0000ffe5-0000-1000-8000-00805f9a34fb` |
| Notify characteristic (device → app) | `0000ffe4-0000-1000-8000-00805f9a34fb` |
| Write characteristic (app → device) | `0000ffe9-0000-1000-8000-00805f9a34fb` |
| Frame header | `0x55` |
| Combined data frame flag | `0x61` (20 bytes: header, flag, 9× little-endian int16) |
| Standard frame flags | `0x51` accel, `0x52` gyro, `0x53` angle, `0x54` magnetic, `0x59` quaternion (11 bytes each, checksummed) |
| Scaling | accel `raw/32768×16` g · gyro `raw/32768×2000` °/s · angle `raw/32768×180` ° |

The parser resyncs on checksum failure and reassembles frames split across
BLE notification chunks.

### 2.3 Driving the bow from sensor data

An optional "Drive the bow animation from this sensor" mode maps one chosen
axis (gx/gy/gz/ax/ay/az, default gyro Z) to bow speed (via smoothed
magnitude → 5–100 cm/s) and direction (via sign), overriding the manual
auto-bow oscillation while active. This is a simple proxy for stroke
motion, not a reconstruction of absolute bow position — a single
wrist-worn IMU can't disambiguate on-string bow position from other wrist
movement.

## 3. File structure

```
index.html              Page structure and controls
css/styles.css           Styling
js/physics.js             Schelleng-style min/max bow force model
js/audio.js                Web Audio synthesis engine
js/visualizer.js           String + bow canvas animation
js/diagram.js               Schelleng diagram canvas
js/witmotionParser.js       WitMotion binary IMU packet decoder
js/bleConnector.js          Web Bluetooth connection + characteristic discovery
js/sensorFileParser.js      Recorded WitMotion text/CSV export parser
js/sensorChart.js            Rolling accelerometer/gyro strip-chart
js/main.js                    Wires controls, state, and the animation loop together
```

## 4. Non-goals / known limitations

- The bow-force physics model is pedagogically tuned, not a calibrated
  acoustic simulation.
- Sensor-driven bow position is a proxy (speed/direction from one axis),
  not true position tracking — no absolute bow position is reconstructed.
- WitMotion GATT UUIDs are not fully standardized across every product
  line; the defaults target the BLE5.0 family (confirmed for WT9011DCL).
  Other models may need the manual UUID override.
