/*
 * Standard mode: the keypad layout and the keyboard map. Data only - the
 * engine owns the behaviour, the UI layer renders this.
 *
 * Keypad rows read top to bottom exactly like the Windows 11 application;
 * each key names an engine action and the colour role the stylesheet uses.
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  var KEYPAD = [
    [
      { label: "%", action: "unary:percent", role: "function" },
      { label: "CE", action: "clearEntry", role: "function" },
      { label: "C", action: "clear", role: "function" },
      { label: "\u232b", action: "backspace", role: "function" }
    ],
    [
      { label: "\u00b9/x", action: "unary:reciprocal", role: "function" },
      { label: "x\u00b2", action: "unary:square", role: "function" },
      { label: "\u00b2\u221ax", action: "unary:sqrt", role: "function" },
      { label: "\u00f7", action: "op:div", role: "operator" }
    ],
    [
      { label: "7", action: "digit:7", role: "digit" },
      { label: "8", action: "digit:8", role: "digit" },
      { label: "9", action: "digit:9", role: "digit" },
      { label: "\u00d7", action: "op:mul", role: "operator" }
    ],
    [
      { label: "4", action: "digit:4", role: "digit" },
      { label: "5", action: "digit:5", role: "digit" },
      { label: "6", action: "digit:6", role: "digit" },
      { label: "\u2212", action: "op:sub", role: "operator" }
    ],
    [
      { label: "1", action: "digit:1", role: "digit" },
      { label: "2", action: "digit:2", role: "digit" },
      { label: "3", action: "digit:3", role: "digit" },
      { label: "+", action: "op:add", role: "operator" }
    ],
    [
      { label: "\u00b1", action: "unary:negate", role: "digit" },
      { label: "0", action: "digit:0", role: "digit" },
      { label: ".", action: "point", role: "digit" },
      { label: "=", action: "equals", role: "equals" }
    ]
  ];

  /* Windows 11 Standard mode shortcuts. Single characters are matched
   * case-insensitively; modifier combinations use a "ctrl+x" key. */
  var KEYMAP = {
    "0": "digit:0",
    "1": "digit:1",
    "2": "digit:2",
    "3": "digit:3",
    "4": "digit:4",
    "5": "digit:5",
    "6": "digit:6",
    "7": "digit:7",
    "8": "digit:8",
    "9": "digit:9",
    ".": "point",
    "+": "op:add",
    "-": "op:sub",
    "*": "op:mul",
    "/": "op:div",
    "=": "equals",
    "Enter": "equals",
    "Escape": "clear",
    "Delete": "clearEntry",
    "Backspace": "backspace",
    "F9": "unary:negate",
    "%": "unary:percent",
    "r": "unary:reciprocal",
    "q": "unary:square",
    "@": "unary:sqrt",
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
  NS.modes.standard = {
    id: "standard",
    label: "Standard",
    keypad: KEYPAD,
    keymap: KEYMAP,
    resolveKey: resolveKey
  };

  if (typeof module !== "undefined") module.exports = NS.modes.standard;
})(typeof globalThis !== "undefined" ? globalThis : this);
