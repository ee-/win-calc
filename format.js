/*
 * Number formatting for WinCalc.
 *
 * Rules mirrored from Windows Calculator (Standard mode):
 *   - integer part grouped with commas, both while typing and in results
 *   - at most 16 significant digits; beyond that the display switches to
 *     scientific notation ("1.e+16", "1.234567890123457e+16", "1.e-5")
 *   - negative zero keeps its sign ("-0")
 *   - at most 16 digits can be typed into one entry
 *
 * Loading: classic <script> in the browser (attaches to globalThis.WinCalc),
 * require()able in Node for the tests.
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  var SIGNIFICANT_DIGITS = 16; // display precision; also the input digit cap
  var SCIENTIFIC_MIN_EXPONENT = SIGNIFICANT_DIGITS; // 1e16 and up -> scientific
  var PLAIN_MIN_EXPONENT = -4; // below 1e-4 -> scientific (1e-5 -> "1.e-5")

  var GROUP = /\B(?=(\d{3})+(?!\d))/g;

  /* Group the integer part of a numeric text: "1234567.5" -> "1,234,567.5".
   * Works on partial entries too ("12." -> "12.", "-1234" -> "-1,234"). */
  function groupIntegerPart(text) {
    var sign = "";
    var body = String(text);
    if (body.charAt(0) === "-") {
      sign = "-";
      body = body.slice(1);
    }
    var dot = body.indexOf(".");
    var integer = dot === -1 ? body : body.slice(0, dot);
    var fraction = dot === -1 ? "" : body.slice(dot);
    return sign + integer.replace(GROUP, ",") + fraction;
  }

  /* Significant digits typed so far: leading zeros do not count, so
   * "0.1111111111111111" is a full 16-digit entry. */
  function digitCount(text) {
    return String(text).replace(/[^0-9]/g, "").replace(/^0+/, "").length;
  }

  function isNegativeZero(value) {
    return value === 0 && 1 / value === -Infinity;
  }

  /* Decimal exponent and 16-significant-digit mantissa, taken from the
   * shortest exact decimal representation so no float error creeps in. */
  function decompose(absolute) {
    var text = absolute.toExponential(SIGNIFICANT_DIGITS - 1);
    var e = text.indexOf("e");
    return {
      mantissa: text.slice(0, e), // "d.dddddddddddddd"
      exponent: parseInt(text.slice(e + 1), 10)
    };
  }

  function trimTrailingZeros(text) {
    if (text.indexOf(".") === -1) return text;
    return text.replace(/0+$/, "").replace(/\.$/, "");
  }

  function scientific(absolute) {
    var parts = decompose(absolute);
    var mantissa = trimTrailingZeros(parts.mantissa);
    // Windows prints "1.e+16" (mantissa keeps its point) but "1.23e+16".
    if (mantissa.indexOf(".") === -1) mantissa += ".";
    var sign = parts.exponent < 0 ? "-" : "+";
    return mantissa + "e" + sign + Math.abs(parts.exponent);
  }

  function decimal(absolute, exponent) {
    var text = absolute.toPrecision(SIGNIFICANT_DIGITS);
    // toPrecision falls back to exponential form outside its fixed range;
    // toFixed covers the small-magnitude end of the plain range.
    if (text.indexOf("e") !== -1) {
      text = absolute.toFixed(Math.max(0, SIGNIFICANT_DIGITS - 1 - exponent));
    }
    return groupIntegerPart(trimTrailingZeros(text));
  }

  /* Format a finite number the way the calculator display shows it.
   * Callers handle non-finite values themselves (the engine raises an
   * Overflow / divide-by-zero error before formatting). */
  function formatNumber(value) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return isNegativeZero(value) ? "-0" : "0";
    var negative = value < 0;
    var absolute = Math.abs(value);
    var exponent = decompose(absolute).exponent;
    var text = exponent >= SCIENTIFIC_MIN_EXPONENT || exponent < PLAIN_MIN_EXPONENT
      ? scientific(absolute)
      : decimal(absolute, exponent);
    return (negative ? "-" : "") + text;
  }

  /* Format an in-progress entry ("1200." -> "1,200."). */
  function formatEntry(entry) {
    return groupIntegerPart(entry);
  }

  NS.format = {
    SIGNIFICANT_DIGITS: SIGNIFICANT_DIGITS,
    MAX_INPUT_DIGITS: SIGNIFICANT_DIGITS,
    groupIntegerPart: groupIntegerPart,
    digitCount: digitCount,
    isNegativeZero: isNegativeZero,
    formatNumber: formatNumber,
    formatEntry: formatEntry
  };

  if (typeof module !== "undefined") module.exports = NS.format;
})(typeof globalThis !== "undefined" ? globalThis : this);
