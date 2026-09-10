/*
 * Scientific mode: the keypad layout. Data only - the engine owns the
 * behaviour, the UI layer renders this.
 *
 * Windows 11 Scientific geometry: six columns, eight rows read top to bottom:
 * the 2nd toggle and the angle-unit keys on the first row, the digit and
 * operator block from Standard, the transcendental functions to its left,
 * and the remaining functions below. Keys with an `alt` entry carry the 2nd
 * layer's label and action (the real app's inverse toggle): sin -> sin-1 and
 * the other inverse trigonometric keys, sqrt -> cbrt, 10^x -> 2^x, log ->
 * log base y, ln -> e^x.
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  var KEYPAD = [
    [
      { label: "2nd", action: "second", role: "function" },
      { label: "DEG", action: "angle:deg", role: "function" },
      { label: "RAD", action: "angle:rad", role: "function" },
      { label: "GRAD", action: "angle:grad", role: "function" },
      { label: "x\u00b2", action: "unary:square", role: "function" },
      { label: "\u232b", action: "backspace", role: "function" }
    ],
    [
      { label: "x\u02b8", action: "op:pow", role: "function" },
      { label: "7", action: "digit:7", role: "digit" },
      { label: "8", action: "digit:8", role: "digit" },
      { label: "9", action: "digit:9", role: "digit" },
      { label: "\u00f7", action: "op:div", role: "operator" },
      { label: "C", action: "clear", role: "function" }
    ],
    [
      {
        label: "\u221a", action: "unary:sqrt", role: "function",
        alt: { label: "\u221b", action: "unary:cbrt" }
      },
      { label: "4", action: "digit:4", role: "digit" },
      { label: "5", action: "digit:5", role: "digit" },
      { label: "6", action: "digit:6", role: "digit" },
      { label: "\u00d7", action: "op:mul", role: "operator" },
      { label: "CE", action: "clearEntry", role: "function" }
    ],
    [
      {
        label: "10\u02e3", action: "unary:tenpow", role: "function",
        alt: { label: "2\u02e3", action: "unary:twopow" }
      },
      { label: "1", action: "digit:1", role: "digit" },
      { label: "2", action: "digit:2", role: "digit" },
      { label: "3", action: "digit:3", role: "digit" },
      { label: "\u2212", action: "op:sub", role: "operator" },
      { label: "%", action: "unary:percent", role: "function" }
    ],
    [
      {
        label: "log", action: "unary:log", role: "function",
        alt: { label: "log\u1d67", action: "op:logy" }
      },
      { label: "\u00b1", action: "unary:negate", role: "digit" },
      { label: "0", action: "digit:0", role: "digit" },
      { label: ".", action: "point", role: "digit" },
      { label: "+", action: "op:add", role: "operator" },
      { label: "=", action: "equals", role: "equals" }
    ],
    [
      {
        label: "ln", action: "unary:ln", role: "function",
        alt: { label: "e\u02e3", action: "unary:exp" }
      },
      {
        label: "sin", action: "unary:sin", role: "function",
        alt: { label: "sin\u207b\u00b9", action: "unary:asin" }
      },
      {
        label: "cos", action: "unary:cos", role: "function",
        alt: { label: "cos\u207b\u00b9", action: "unary:acos" }
      },
      {
        label: "tan", action: "unary:tan", role: "function",
        alt: { label: "tan\u207b\u00b9", action: "unary:atan" }
      },
      { label: "(", action: "paren:open", role: "function" },
      { label: ")", action: "paren:close", role: "function" }
    ],
    [
      { label: "\u00b9/x", action: "unary:reciprocal", role: "function" },
      { label: "|x|", action: "unary:abs", role: "function" },
      { label: "n!", action: "unary:factorial", role: "function" },
      { label: "exp", action: "entry:exp", role: "function" },
      { label: "mod", action: "op:mod", role: "function" },
      { label: "\u02b8\u221ax", action: "op:root", role: "function" }
    ],
    [
      { label: "\u230ax\u230b", action: "unary:floor", role: "function" },
      { label: "\u2308x\u2309", action: "unary:ceil", role: "function" },
      { label: "round", action: "unary:round", role: "function" },
      { label: "x\u00b3", action: "unary:cube", role: "function" },
      { label: "\u03c0", action: "const:pi", role: "function" },
      { label: "e", action: "const:e", role: "function" }
    ]
  ];

  NS.modes = NS.modes || {};
  NS.modes.scientific = {
    id: "scientific",
    label: "Scientific",
    columns: 6,
    keypad: KEYPAD
  };

  if (typeof module !== "undefined") module.exports = NS.modes.scientific;
})(typeof globalThis !== "undefined" ? globalThis : this);
