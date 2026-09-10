/*
 * Programmer mode: the keypad layout and the mode's selectors. Data only -
 * the engine owns the behaviour, the UI layer renders this.
 *
 * The real app puts its bitwise keys and its shift keys behind two flyouts;
 * this shell has no flyout, so both families are direct keys and the shift
 * mode is a visible selector row (the receipt records the deviation). The two
 * shift keys carry a `variants` layer per shift mode, because the real app's
 * keys change with it: Lsh/Rsh under Arithmetic, Lsh/RshL under Logical, and
 * the single-bit rotations RoL/RoR (circular) and RoLc/RoRc (through carry).
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  var KEYPAD = [
    [
      {
        label: "Lsh", action: "op:lsh", role: "function",
        variants: {
          arithmetic: { label: "Lsh", action: "op:lsh" },
          logical: { label: "Lsh", action: "op:lsh" },
          rotate: { label: "RoL", action: "unary:rol" },
          rotateCarry: { label: "RoLc", action: "unary:rolc" }
        }
      },
      {
        label: "Rsh", action: "op:rsh", role: "function",
        variants: {
          arithmetic: { label: "Rsh", action: "op:rsh" },
          logical: { label: "RshL", action: "op:rsh" },
          rotate: { label: "RoR", action: "unary:ror" },
          rotateCarry: { label: "RoRc", action: "unary:rorc" }
        }
      },
      { label: "\u232b", action: "backspace", role: "function" },
      { label: "CE", action: "clearEntry", role: "function" },
      { label: "C", action: "clear", role: "function" }
    ],
    [
      { label: "A", action: "digit:a", role: "digit" },
      { label: "7", action: "digit:7", role: "digit" },
      { label: "8", action: "digit:8", role: "digit" },
      { label: "9", action: "digit:9", role: "digit" },
      { label: "\u00f7", action: "op:div", role: "operator" }
    ],
    [
      { label: "B", action: "digit:b", role: "digit" },
      { label: "4", action: "digit:4", role: "digit" },
      { label: "5", action: "digit:5", role: "digit" },
      { label: "6", action: "digit:6", role: "digit" },
      { label: "\u00d7", action: "op:mul", role: "operator" }
    ],
    [
      { label: "C", action: "digit:c", role: "digit" },
      { label: "1", action: "digit:1", role: "digit" },
      { label: "2", action: "digit:2", role: "digit" },
      { label: "3", action: "digit:3", role: "digit" },
      { label: "\u2212", action: "op:sub", role: "operator" }
    ],
    [
      { label: "D", action: "digit:d", role: "digit" },
      { label: "0", action: "digit:0", role: "digit" },
      { label: ".", action: "point", role: "digit", ariaLabel: "Decimal separator" },
      { label: "\u00b1", action: "unary:negate", role: "function" },
      { label: "+", action: "op:add", role: "operator" }
    ],
    [
      { label: "E", action: "digit:e", role: "digit" },
      { label: "AND", action: "op:and", role: "function" },
      { label: "OR", action: "op:or", role: "function" },
      { label: "XOR", action: "op:xor", role: "function" },
      { label: "=", action: "equals", role: "equals" }
    ],
    [
      { label: "F", action: "digit:f", role: "digit" },
      { label: "NOT", action: "unary:not", role: "function" },
      { label: "NAND", action: "op:nand", role: "function" },
      { label: "NOR", action: "op:nor", role: "function" },
      { label: "%", action: "op:mod", role: "function", ariaLabel: "Modulo" }
    ]
  ];

  /* The word-size button cycles QWORD -> DWORD -> WORD -> BYTE, as the real
   * app's single button does; these are its labels, widest first. */
  var WORDS = [
    { id: "qword", label: "QWORD" },
    { id: "dword", label: "DWORD" },
    { id: "word", label: "WORD" },
    { id: "byte", label: "BYTE" }
  ];

  /* The four live base readouts; selecting a row switches the active base. */
  var BASES = [
    { id: "hex", label: "HEX" },
    { id: "dec", label: "DEC" },
    { id: "oct", label: "OCT" },
    { id: "bin", label: "BIN" }
  ];

  /* The shift-mode selector: what the shift keys mean. Arithmetic is the
   * real app's default. */
  var SHIFTS = [
    { id: "arithmetic", label: "Arithmetic" },
    { id: "logical", label: "Logical" },
    { id: "rotate", label: "Rotate circular" },
    { id: "rotateCarry", label: "Rotate through carry" }
  ];

  /* Programmer mode's keyboard: the digits, the hex letters the active base
   * accepts (the engine gates them), the operators the real app binds, the
   * editing keys and the memory row's Ctrl chords. */
  var KEYMAP = {
    "0": "digit:0", "1": "digit:1", "2": "digit:2", "3": "digit:3", "4": "digit:4",
    "5": "digit:5", "6": "digit:6", "7": "digit:7", "8": "digit:8", "9": "digit:9",
    "a": "digit:a", "b": "digit:b", "c": "digit:c", "d": "digit:d", "e": "digit:e",
    "f": "digit:f",
    "+": "op:add", "-": "op:sub", "*": "op:mul", "/": "op:div",
    "%": "op:mod", "=": "equals", "Enter": "equals",
    "Escape": "clear", "Delete": "clearEntry", "Backspace": "backspace",
    "&": "op:and", "|": "op:or", "^": "op:xor", "~": "unary:not",
    ".": "op:nand", "\\": "op:nor",
    "<": "op:lsh", ">": "op:rsh",
    "F5": "base:hex", "F6": "base:dec", "F7": "base:oct", "F8": "base:bin",
    "F9": "unary:negate",
    "ctrl+l": "memory:clear",
    "ctrl+r": "memory:recall",
    "ctrl+p": "memory:add",
    "ctrl+q": "memory:subtract",
    "ctrl+m": "memory:store"
  };

  function resolveKey(event) {
    var key = event && event.key;
    if (typeof key !== "string" || key.length === 0) return null;
    if (event.metaKey || event.altKey) return null;
    var name = key.length === 1 ? key.toLowerCase() : key;
    var lookup = (event.ctrlKey ? "ctrl+" : "") + name;
    return Object.prototype.hasOwnProperty.call(KEYMAP, lookup) ? KEYMAP[lookup] : null;
  }

  NS.modes = NS.modes || {};
  NS.modes.programmer = {
    id: "programmer",
    label: "Programmer",
    columns: 5,
    keypad: KEYPAD,
    words: WORDS,
    bases: BASES,
    shifts: SHIFTS,
    keymap: KEYMAP,
    resolveKey: resolveKey
  };

  if (typeof module !== "undefined") module.exports = NS.modes.programmer;
})(typeof globalThis !== "undefined" ? globalThis : this);
