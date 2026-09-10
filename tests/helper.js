/* Shared test helpers: load the browser files the same way index.html does
 * (one namespace, no modules) and drive the engine with key sequences. */
"use strict";

const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const FILES = ["format.js", "engine.js", "modes/standard.js", "ui.js"];

function loadApp() {
  for (const file of FILES) require(path.join(ROOT, file));
  return globalThis.WinCalc;
}

function readSource(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function calculator() {
  const app = loadApp();
  return new app.engine.Calculator();
}

/* press(calc, "1+2=") walks an action list; "d5" is digit 5. */
function press(calc, sequence) {
  for (const key of keyList(sequence)) calc.press(key);
  return calc.display;
}

function keyList(sequence) {
  const keys = [];
  for (const token of sequence.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) {
      for (const digit of trimmed) keys.push("digit:" + digit);
    } else {
      keys.push(trimmed);
    }
  }
  return keys;
}

module.exports = { ROOT, FILES, loadApp, readSource, calculator, press, keyList };
