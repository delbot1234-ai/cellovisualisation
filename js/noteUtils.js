// Shared note-name <-> MIDI <-> frequency conversions (12-TET, A4 = 440 Hz).

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.NoteUtils = (function () {
  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var ACCIDENTAL_OFFSETS = { "": 0, "#": 1, "##": 2, b: -1, bb: -2 };
  var BASE_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function freqToMidiExact(freq) {
    return 69 + 12 * Math.log2(freq / 440);
  }

  // Returns { midi, name, octave, cents } for the nearest 12-TET note to freq.
  function freqToNote(freq) {
    var exact = freqToMidiExact(freq);
    var nearest = Math.round(exact);
    var cents = (exact - nearest) * 100;
    var octave = Math.floor(nearest / 12) - 1;
    var name = NOTE_NAMES[((nearest % 12) + 12) % 12];
    return { midi: nearest, name: name, octave: octave, label: name + octave, cents: cents, freq: freq };
  }

  // Parses tokens like "C3", "F#4", "Bb2", "D##5" -> { midi, label, freq } or null if invalid.
  function parseNoteName(token) {
    var m = /^([A-Ga-g])(##|bb|#|b)?(-?\d+)$/.exec(token.trim());
    if (!m) return null;
    var letter = m[1].toUpperCase();
    var accidental = m[2] || "";
    var octave = parseInt(m[3], 10);
    var midi = (octave + 1) * 12 + BASE_SEMITONE[letter] + ACCIDENTAL_OFFSETS[accidental];
    return { midi: midi, label: letter + accidental + octave, freq: midiToFreq(midi) };
  }

  // Parses a whitespace/comma-separated sequence of note names. Returns
  // { notes: [...], invalid: [tokens that failed to parse] }.
  function parseSequence(text) {
    var tokens = text
      .split(/[\s,]+/)
      .map(function (t) {
        return t.trim();
      })
      .filter(function (t) {
        return t.length > 0;
      });

    var notes = [];
    var invalid = [];
    tokens.forEach(function (token) {
      var parsed = parseNoteName(token);
      if (parsed) notes.push(parsed);
      else invalid.push(token);
    });
    return { notes: notes, invalid: invalid };
  }

  return {
    NOTE_NAMES: NOTE_NAMES,
    midiToFreq: midiToFreq,
    freqToNote: freqToNote,
    parseNoteName: parseNoteName,
    parseSequence: parseSequence,
  };
})();
