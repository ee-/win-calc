/* Shell and packaging (AC-009): the app must run straight from the filesystem
 * with no dependencies and no build step, and the DOM contract between
 * index.html and ui.js must hold. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ROOT, FILES, readSource } = require("./helper.js");

const html = readSource("index.html");
const css = readSource("styles.css");

function tags(pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

test("index.html loads plain scripts, in dependency order, from this folder", () => {
  assert.equal(/type\s*=\s*["']module["']/.test(html), false, "module scripts do not run over file://");
  const sources = tags(/<script[^>]*\ssrc="([^"]+)"/g);
  assert.deepEqual(sources, FILES, "scripts must load format, engine, mode, ui in that order");
  for (const source of sources) {
    const file = path.join(ROOT, source);
    assert.ok(fs.existsSync(file), source + " is missing");
  }
  // Classic inline script tags only: no async/defer/module attributes.
  for (const attributes of tags(/<script([^>]*)>/g)) {
    assert.equal(/type=|defer|async|nomodule/.test(attributes), false, "<script" + attributes + ">");
  }
});

test("assets are local: no network, no CDN, no remote imports", () => {
  const remote = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i;
  assert.equal(remote.test(html), false, "index.html references a remote URL");
  assert.equal(remote.test(css), false, "styles.css references a remote URL");
  for (const file of FILES) {
    const source = readSource(file);
    assert.equal(remote.test(source), false, file + " references a remote URL");
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/.test(source), false,
      file + " performs a network call");
  }
  assert.equal(fs.existsSync(path.join(ROOT, "package.json")), false, "no build or dependency manifest");
  assert.equal(fs.existsSync(path.join(ROOT, "node_modules")), false, "no installed dependencies");
});

test("every browser file is also loadable by Node", () => {
  for (const file of FILES) {
    const source = readSource(file);
    assert.ok(/if \(typeof module !== "undefined"\) module\.exports =/.test(source),
      file + " is missing the module.exports guard");
    assert.equal(/^\s*(import|export)\s/m.test(source), false, file + " uses module syntax");
    assert.equal(/require\((["'])(?!\.)/.test(source), false, file + " requires a dependency");
  }
});

const NAMESPACE = {
  "format.js": "format",
  "engine.js": "engine",
  "modes/standard.js": "modes.standard",
  "modes/scientific.js": "modes.scientific",
  "modes/programmer.js": "modes.programmer",
  "ui.js": "ui"
};

function resolveNamespace(dotted) {
  return dotted.split(".").reduce((value, key) => value[key], globalThis.WinCalc);
}

test("scripts attach to one shared namespace and export their module", () => {
  for (const file of FILES) {
    const exported = require(path.join(ROOT, file));
    assert.ok(exported && typeof exported === "object", file + " exported nothing");
    assert.equal(exported, resolveNamespace(NAMESPACE[file]),
      file + " exported a different object than it attached");
  }
  assert.equal(typeof globalThis.WinCalc.ui.start, "function");
  assert.equal(typeof globalThis.WinCalc.engine.Calculator, "function");
  assert.equal(typeof globalThis.WinCalc.format.formatNumber, "function");
  assert.equal(typeof globalThis.WinCalc.modes.standard.resolveKey, "function");
});

test("ui.js only reaches for elements index.html declares", () => {
  const source = readSource("ui.js");
  const ids = [...source.matchAll(/element\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(ids.length >= 10, "expected the shell to look up its elements");
  for (const id of ids) {
    assert.ok(html.includes('id="' + id + '"'), "index.html has no element with id " + id);
  }
});

test("the shell ships every control the work order names", () => {
  for (const id of ["value", "expression", "keypad", "memory-row", "history-panel",
    "history-list", "history-clear", "mode-drawer", "mode-list", "mode-title", "nav-button",
    "history-button", "placeholder-panel"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing #" + id);
  }
  for (const key of ["MC", "MR", "M+", "MS"]) {
    assert.ok(readSource("ui.js").includes('"' + key + '"'), "memory row is missing " + key);
  }
  assert.ok(readSource("ui.js").includes('"M\\u2212"'), "memory row is missing M-");
  assert.ok(css.includes(".memory-row") && css.includes(".keypad") && css.includes(".history"),
    "styles.css is missing a shell region");
});

test("the six modes are listed and Standard is the only implemented one", () => {
  const source = readSource("ui.js");
  const ids = [...source.matchAll(/\{ id: "([a-z]+)", label: "/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["standard", "scientific", "graphing", "programmer", "date", "converter"]);
});

test("the stylesheet carries the Windows 11 theme and key roles", () => {
  assert.match(html, /<html[^>]*data-theme="dark"/, "dark theme must be the default");
  assert.match(css, /data-theme="light"/, "a light theme must exist");
  for (const token of ["--accent", "--key-digit", "--key-function", "--key-operator", "--radius-key"]) {
    assert.ok(css.includes(token), "styles.css is missing " + token);
  }
  assert.ok(css.includes('.key[data-role="equals"]'), "the equals key has no accent rule");
  assert.ok(css.includes("border-radius"), "the Windows 11 look needs rounded corners");
});
