/*
 * Date Calculation mode: the mode's data. The engine owns the calendar
 * arithmetic (NS.engine.DateCalculator); this file carries the labels and the
 * control set so the shell can render the form without hard-coding a mode.
 *
 * The strings are the real application's en-US wording, read from its
 * Resources.resw (see docs/wo4-scout-date-semantics.md for the citations).
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  var OPTIONS = [
    { id: "difference", label: "Difference between dates" },
    { id: "addSubtract", label: "Add or subtract days" }
  ];

  var DIRECTIONS = [
    { id: "add", label: "Add" },
    { id: "subtract", label: "Subtract" }
  ];

  var UNITS = [
    { id: "years", label: "Years" },
    { id: "months", label: "Months" },
    { id: "days", label: "Days" }
  ];

  var STRINGS = {
    from: "From",
    to: "To",
    difference: "Difference",
    date: "Date"
  };

  NS.modes = NS.modes || {};
  NS.modes.date = {
    id: "date",
    label: "Date Calculation",
    options: OPTIONS,
    directions: DIRECTIONS,
    units: UNITS,
    strings: STRINGS
  };

  if (typeof module !== "undefined") module.exports = NS.modes.date;
})(typeof globalThis !== "undefined" ? globalThis : this);
