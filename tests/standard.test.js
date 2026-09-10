/* Standard mode: the keypad definition and the keyboard map (AC-002). */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, calculator, press } = require("./helper.js");

const app = loadApp();
const { standard } = app.modes;
const { Calculator } = app.engine;

test("the keypad is the Windows 11 Standard layout", () => {
  assert.equal(standard.keypad.length, 6);
  for (const row of standard.keypad) assert.equal(row.length, 4);

  const labels = standard.keypad.map((row) => row.map((key) => key.label));
  assert.deepEqual(labels[5], ["\u00b1", "0", ".", "="]);
  assert.deepEqual(labels[0], ["%", "CE", "C", "\u232b"]);
  assert.deepEqual(labels[2], ["7", "8", "9", "\u00d7"]);
  assert.equal(labels[1][3], "\u00f7");
  assert.equal(labels[3][3], "\u2212");
  assert.equal(labels[4][3], "+");
});

test("the keypad covers every Standard operation exactly once", () => {
  const actions = standard.keypad.flat().map((key) => key.action);
  const expected = [
    "digit:0", "digit:1", "digit:2", "digit:3", "digit:4",
    "digit:5", "digit:6", "digit:7", "digit:8", "digit:9",
    "point", "equals", "clear", "clearEntry", "backspace",
    "op:add", "op:sub", "op:mul", "op:div",
    "unary:negate", "unary:percent", "unary:reciprocal", "unary:square", "unary:sqrt"
  ];
  assert.equal(new Set(actions).size, actions.length, "duplicate action in the keypad");
  assert.deepEqual(actions.slice().sort(), expected.slice().sort());
  for (const action of actions) {
    assert.ok(Calculator.isAction(action), action + " is not an engine action");
  }
});

test("colour roles match the four Windows key roles", () => {
  const roles = new Set(standard.keypad.flat().map((key) => key.role));
  assert.deepEqual([...roles].sort(), ["digit", "equals", "function", "operator"]);
  const equals = standard.keypad.flat().filter((key) => key.role === "equals");
  assert.equal(equals.length, 1);
  assert.equal(equals[0].label, "=");
});

test("the keyboard map resolves the Windows 11 shortcuts", () => {
  const cases = {
    "0": "digit:0", "9": "digit:9", ".": "point",
    "+": "op:add", "-": "op:sub", "*": "op:mul", "/": "op:div",
    "=": "equals", "Enter": "equals",
    "Escape": "clear", "Delete": "clearEntry", "Backspace": "backspace",
    "F9": "unary:negate", "%": "unary:percent",
    "r": "unary:reciprocal", "q": "unary:square", "@": "unary:sqrt"
  };
  for (const [key, action] of Object.entries(cases)) {
    assert.equal(standard.resolveKey({ key }), action, key);
  }
});

test("Ctrl shortcuts drive the memory row", () => {
  const cases = {
    l: "memory:clear", r: "memory:recall", p: "memory:add",
    q: "memory:subtract", m: "memory:store"
  };
  for (const [key, action] of Object.entries(cases)) {
    assert.equal(standard.resolveKey({ key, ctrlKey: true }), action, key);
    assert.equal(standard.resolveKey({ key: key.toUpperCase(), ctrlKey: true }), action, "Ctrl+" + key.toUpperCase());
  }
});

test("unmapped and modified keys resolve to nothing", () => {
  for (const event of [
    { key: "F5" }, { key: "a" }, { key: "l" }, { key: " " }, { key: "Shift" },
    { key: "l", metaKey: true }, { key: "7", altKey: true }, { key: "l", altKey: true },
    { key: "Enter", metaKey: true }, {}, { key: "" }
  ]) {
    assert.equal(standard.resolveKey(event), null, JSON.stringify(event));
  }
});

test("keyboard input drives a calculation end to end", () => {
  const calc = calculator();
  // 123 + 45 = 168, typed entirely through the keyboard map.
  for (const key of ["1", "2", "3", "+", "4", "5", "Enter"]) {
    calc.press(standard.resolveKey({ key }));
  }
  assert.equal(calc.display, "168");
  assert.equal(calc.history.length, 1);

  // Backspace edits the entry, Delete clears it, Escape clears the operation.
  press(calc, "clear,7,8,9,backspace");
  assert.equal(calc.display, "78");
  calc.press(standard.resolveKey({ key: "Delete" }));
  assert.equal(calc.display, "0");

  calc.press(standard.resolveKey({ key: "7" }));
  calc.press(standard.resolveKey({ key: "+" }));
  assert.equal(calc.expression, "7 +");
  calc.press(standard.resolveKey({ key: "Escape" }));
  assert.equal(calc.display, "0");
  assert.equal(calc.expression, "");

  // Ctrl+L clears memory through the same map.
  calc.memoryAction("store");
  calc.press(standard.resolveKey({ key: "l", ctrlKey: true }));
  assert.equal(calc.hasMemory, false);
});

test("every keyboard shortcut is a valid engine action", () => {
  for (const action of Object.values(standard.keymap)) {
    assert.ok(Calculator.isAction(action), action + " is not an engine action");
  }
});
