/* Formatting: grouping, the 16-significant-digit switch to scientific
 * notation, negative zero, and the input digit cap. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("./helper.js");
const format = loadApp().format;

test("integers are grouped in threes", () => {
  assert.equal(format.formatNumber(0), "0");
  assert.equal(format.formatNumber(7), "7");
  assert.equal(format.formatNumber(999), "999");
  assert.equal(format.formatNumber(1000), "1,000");
  assert.equal(format.formatNumber(1234567), "1,234,567");
  assert.equal(format.formatNumber(1234567890123456), "1,234,567,890,123,456");
});

test("fractions keep at most 16 significant digits", () => {
  assert.equal(format.formatNumber(1234.5), "1,234.5");
  assert.equal(format.formatNumber(0.1), "0.1");
  assert.equal(format.formatNumber(1 / 3), "0.3333333333333333");
  assert.equal(format.formatNumber(2 / 3), "0.6666666666666666");
  assert.equal(format.formatNumber(0.0001), "0.0001");
});

test("16 significant digits, then scientific notation", () => {
  assert.equal(format.formatNumber(1e15), "1,000,000,000,000,000");
  assert.equal(format.formatNumber(1e16), "1.e+16");
  assert.equal(format.formatNumber(1.5e16), "1.5e+16");
  assert.equal(format.formatNumber(1.2345678901234568e16), "1.234567890123457e+16");
  // Below 1e-4 the small end switches too: 1e-5 -> 1.e-5.
  assert.equal(format.formatNumber(1e-5), "1.e-5");
  assert.equal(format.formatNumber(2.5e-7), "2.5e-7");
});

test("negative zero keeps its sign", () => {
  assert.equal(format.formatNumber(-0), "-0");
  assert.equal(format.formatNumber(0), "0");
  assert.equal(format.formatNumber(-0.0), "-0");
  assert.equal(format.formatNumber(-1), "-1");
});

test("partial entries are grouped without disturbing the typed text", () => {
  assert.equal(format.formatEntry("1234567"), "1,234,567");
  assert.equal(format.formatEntry("1234."), "1,234.");
  assert.equal(format.formatEntry("0."), "0.");
  assert.equal(format.formatEntry("-1234.5"), "-1,234.5");
});

test("digit counting drives the input cap", () => {
  assert.equal(format.digitCount("1234.5"), 5);
  assert.equal(format.digitCount("-1234"), 4);
  assert.equal(format.digitCount("0."), 0);
  assert.equal(format.digitCount("0.0001"), 1);
  assert.equal(format.digitCount("1000"), 4);
  assert.equal(format.MAX_INPUT_DIGITS, 16);
});
