// Parser for WitMotion's IMU output protocol (used across their WT901/JY901/
// BWT901 family, over UART and BLE alike). Frames start with 0x55, then a
// flag byte identifying the payload, then data.
//
// Standard 11-byte frame: 0x55, flag, 4x int16 LE, checksum(sum of bytes 0..9 & 0xff)
//   0x51 acceleration   (ax,ay,az, temp)   accel = raw/32768*16 g
//   0x52 angular velocity (gx,gy,gz, temp) gyro  = raw/32768*2000 deg/s
//   0x53 angle          (roll,pitch,yaw, ver) angle = raw/32768*180 deg
//   0x54 magnetic field (mx,my,mz, temp)
//   0x59 quaternion     (q0,q1,q2,q3)      quat  = raw/32768
//
// BLE convenience frame (20 bytes, no reliable checksum across firmwares):
//   0x55, 0x61, ax,ay,az, gx,gy,gz, roll,pitch,yaw  (9x int16 LE)
//
// This is the commonly documented layout across WitMotion's SDKs; exact
// behavior can vary a little by firmware/model, hence the raw-frame debug
// hooks alongside the decoded fields.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.WitMotion = (function () {
  function int16LE(lo, hi) {
    var v = (hi << 8) | lo;
    if (v & 0x8000) v -= 0x10000;
    return v;
  }

  function checksumOk(bytes, start, len) {
    var sum = 0;
    for (var i = 0; i < len; i++) sum += bytes[start + i];
    return (sum & 0xff) === bytes[start + len];
  }

  // Streaming parser: feed it Uint8Array chunks; it buffers partial frames
  // across calls (BLE notifications routinely split a frame in two) and
  // calls onSample(sample) / onRawFrame(info) for each decoded frame.
  function createStream(handlers) {
    var onSample = (handlers && handlers.onSample) || function () {};
    var onRawFrame = (handlers && handlers.onRawFrame) || function () {};
    var onResync = (handlers && handlers.onResync) || function () {};

    var buffer = new Uint8Array(0);

    function append(chunk) {
      var merged = new Uint8Array(buffer.length + chunk.length);
      merged.set(buffer, 0);
      merged.set(chunk, buffer.length);
      buffer = merged;
      process();
    }

    function toHex(bytes, start, len) {
      var parts = [];
      for (var i = 0; i < len; i++) parts.push(bytes[start + i].toString(16).padStart(2, "0"));
      return parts.join(" ");
    }

    function process() {
      var i = 0;
      var sample = null;

      while (i < buffer.length) {
        if (buffer[i] !== 0x55) {
          i++;
          continue;
        }
        if (i + 1 >= buffer.length) break; // need more data to see the flag

        var flag = buffer[i + 1];

        if (flag === 0x61) {
          var frameLen = 20;
          if (i + frameLen > buffer.length) break; // wait for the rest
          var d = buffer;
          var o = i + 2;
          sample = sample || {};
          sample.ax = int16LE(d[o], d[o + 1]) / 32768 * 16;
          sample.ay = int16LE(d[o + 2], d[o + 3]) / 32768 * 16;
          sample.az = int16LE(d[o + 4], d[o + 5]) / 32768 * 16;
          sample.gx = int16LE(d[o + 6], d[o + 7]) / 32768 * 2000;
          sample.gy = int16LE(d[o + 8], d[o + 9]) / 32768 * 2000;
          sample.gz = int16LE(d[o + 10], d[o + 11]) / 32768 * 2000;
          sample.roll = int16LE(d[o + 12], d[o + 13]) / 32768 * 180;
          sample.pitch = int16LE(d[o + 14], d[o + 15]) / 32768 * 180;
          sample.yaw = int16LE(d[o + 16], d[o + 17]) / 32768 * 180;
          sample.t = performance.now();
          onRawFrame({ flag: flag, hex: toHex(buffer, i, frameLen), len: frameLen });
          onSample(Object.assign({}, sample));
          i += frameLen;
          continue;
        }

        if (flag === 0x51 || flag === 0x52 || flag === 0x53 || flag === 0x54 || flag === 0x59) {
          var stdLen = 11;
          if (i + stdLen > buffer.length) break;
          if (!checksumOk(buffer, i, 10)) {
            onResync({ reason: "checksum", pos: i });
            i++;
            continue;
          }
          var d0 = int16LE(buffer[i + 2], buffer[i + 3]);
          var d1 = int16LE(buffer[i + 4], buffer[i + 5]);
          var d2 = int16LE(buffer[i + 6], buffer[i + 7]);
          var d3 = int16LE(buffer[i + 8], buffer[i + 9]);

          sample = sample || {};
          if (flag === 0x51) {
            sample.ax = (d0 / 32768) * 16;
            sample.ay = (d1 / 32768) * 16;
            sample.az = (d2 / 32768) * 16;
            sample.temp = d3 / 100;
          } else if (flag === 0x52) {
            sample.gx = (d0 / 32768) * 2000;
            sample.gy = (d1 / 32768) * 2000;
            sample.gz = (d2 / 32768) * 2000;
          } else if (flag === 0x53) {
            sample.roll = (d0 / 32768) * 180;
            sample.pitch = (d1 / 32768) * 180;
            sample.yaw = (d2 / 32768) * 180;
          } else if (flag === 0x54) {
            sample.mx = d0;
            sample.my = d1;
            sample.mz = d2;
          } else if (flag === 0x59) {
            sample.q0 = d0 / 32768;
            sample.q1 = d1 / 32768;
            sample.q2 = d2 / 32768;
            sample.q3 = d3 / 32768;
          }
          sample.t = performance.now();
          onRawFrame({ flag: flag, hex: toHex(buffer, i, stdLen), len: stdLen });
          onSample(Object.assign({}, sample));
          i += stdLen;
          continue;
        }

        // Unknown flag after a valid-looking header: treat as noise, resync.
        onResync({ reason: "unknown-flag", pos: i, flag: flag });
        i++;
      }

      buffer = buffer.slice(i);
    }

    return { append: append };
  }

  return { createStream: createStream };
})();
