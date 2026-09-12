/* Date Calculation mode (AC-005): the engine's calendar arithmetic and the
 * mode's data.
 *
 * Expected values are the real project's own, from
 * src/Calculator.Tests/DateCalculatorTests.cs as reported by the WO-4 research
 * slice (committed at docs/wo4-scout-date-semantics.md). Each test names the
 * vector it pins. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, readSource } = require("./helper.js");

const app = loadApp();
const { DateCalculator, dateMake, dateDifference, dateDifferenceInDays,
  dateDifferenceText, dateDifferenceDaysText, dateAddDays, dateAddYears,
  dateInRange, dateParse, dateFormat, dateFormatLong, dateIsValid } = app.engine;
const date = app.modes.date;

/* The test clock: a fixed day, so the defaults are deterministic. */
const TODAY = dateMake(2026, 9, 12);

function calculator(today) {
  return new DateCalculator(today || TODAY);
}

/* The two calculators the mode carries. */
function addSubtract(from, direction, offsets) {
  const calc = calculator(from);
  calc.setOption("addSubtract");
  calc.setDirection(direction);
  Object.keys(offsets || {}).forEach((unit) => calc.setOffset(unit, offsets[unit]));
  return calc;
}

function differenceResult(from, to) {
  const calc = calculator(from);
  calc.setDate("to", to);
  return { result: calc.result, inDays: calc.resultInDays };
}

test("the difference is a greedy calendar breakdown, largest unit first", () => {
  // V2: 2008-02-29 -> 2008-03-31, the reference's month-end pair.
  assert.deepEqual(differenceResult(dateMake(2008, 2, 29), dateMake(2008, 3, 31)),
    { result: "1 month, 2 days", inDays: "31 days" });

  // V6/V7: the same span reads the same either way round.
  assert.deepEqual(differenceResult(dateMake(2007, 5, 10), dateMake(2008, 3, 10)),
    { result: "10 months", inDays: "305 days" });
  assert.deepEqual(differenceResult(dateMake(2008, 3, 10), dateMake(2007, 5, 10)),
    { result: "10 months", inDays: "305 days" });

  // V8: a span the picker cannot reach (the reference's own VM tests set it
  // directly), pinned through the engine's own API.
  assert.equal(dateDifferenceText(dateDifference(dateMake(2008, 1, 31), dateMake(9999, 12, 31))),
    "7991 years, 11 months");
  assert.equal(dateDifferenceDaysText(dateDifferenceInDays(dateMake(2008, 1, 31), dateMake(9999, 12, 31))),
    "2918987 days");
});

test("same dates, single-unit spans and the day-only form", () => {
  // V1: the default state.
  const same = calculator();
  assert.equal(same.result, "Same dates");
  assert.equal(same.resultInDays, "");
  assert.deepEqual(differenceResult(dateMake(2008, 2, 29), dateMake(2008, 2, 29)),
    { result: "Same dates", inDays: "" });

  // V3/V5: one day, and the DST days either side of the year.
  assert.deepEqual(differenceResult(dateMake(2019, 3, 10), dateMake(2019, 3, 11)),
    { result: "1 day", inDays: "" });
  assert.deepEqual(differenceResult(dateMake(2019, 11, 3), dateMake(2019, 11, 4)),
    { result: "1 day", inDays: "" });

  // V4: a week is its own unit, and the secondary line is shown with it.
  assert.deepEqual(differenceResult(dateMake(2019, 3, 10), dateMake(2019, 3, 17)),
    { result: "1 week", inDays: "7 days" });

  // V9/V10: the last day the difference engine can reach, either order.
  assert.equal(dateDifferenceInDays(dateMake(9999, 12, 30), dateMake(9999, 12, 31)), 1);
  assert.equal(dateDifferenceInDays(dateMake(9999, 12, 31), dateMake(9999, 12, 30)), 1, "the magnitude is the same either way");

  // A span that is days only omits the secondary line (the reference's
  // IsDiffInDays condition); a span of weeks has its own unit.
  assert.deepEqual(differenceResult(dateMake(2008, 1, 1), dateMake(2008, 1, 4)),
    { result: "3 days", inDays: "" });
  assert.deepEqual(differenceResult(dateMake(2008, 1, 1), dateMake(2008, 1, 21)),
    { result: "2 weeks, 6 days", inDays: "20 days" });
});

test("the breakdown honours the requested unit mask", () => {
  // E1-E10: the reference asks for different masks, and a unit outside the
  // mask leaves its remainder in the days slot.
  const units = (names) => names;
  assert.deepEqual(dateDifference(dateMake(1601, 1, 1), dateMake(9999, 12, 31), units(["years", "months", "days"])),
    { years: 8398, months: 11, weeks: 0, days: 30 });
  assert.deepEqual(dateDifference(dateMake(1601, 1, 1), dateMake(9998, 12, 31), units(["years", "months", "days"])),
    { years: 8397, months: 11, weeks: 0, days: 30 });
  assert.deepEqual(dateDifference(dateMake(9998, 12, 31), dateMake(9999, 12, 31), units(["days"])),
    { years: 0, months: 0, weeks: 0, days: 365 });
  assert.deepEqual(dateDifference(dateMake(9998, 12, 31), dateMake(9999, 12, 31), units(["years"])),
    { years: 1, months: 0, weeks: 0, days: 0 });
  assert.deepEqual(dateDifference(dateMake(9998, 12, 31), dateMake(9999, 12, 31), units(["weeks", "days"])),
    { years: 0, months: 0, weeks: 52, days: 1 });
  assert.deepEqual(dateDifference(dateMake(2008, 2, 29), dateMake(2008, 3, 31), units(["months", "days"])),
    { years: 0, months: 1, weeks: 0, days: 2 });
  assert.deepEqual(dateDifference(dateMake(2008, 2, 29), dateMake(2008, 3, 31), units(["days"])),
    { years: 0, months: 0, weeks: 0, days: 31 });
  assert.deepEqual(dateDifference(dateMake(2007, 2, 28), dateMake(2008, 1, 29), units(["months", "days"])),
    { years: 0, months: 11, weeks: 0, days: 1 });
  assert.deepEqual(dateDifference(dateMake(2008, 1, 31), dateMake(9999, 12, 31), units(["years", "months"])),
    { years: 7991, months: 11, weeks: 0, days: 0 });
  assert.deepEqual(dateDifference(dateMake(2008, 1, 31), dateMake(9999, 12, 31), units(["weeks", "days"])),
    { years: 0, months: 0, weeks: 416998, days: 1 });

  // The mask the view passes: all four units, so the week gets its share.
  assert.deepEqual(dateDifference(dateMake(1601, 1, 1), dateMake(9999, 12, 31)),
    { years: 8398, months: 11, weeks: 4, days: 2 });
});

test("adding applies years, months, days; subtracting reverses the order", () => {
  // A1-A3.
  assert.equal(addSubtract(dateMake(2008, 1, 31), "add", { months: 1 }).result,
    "Friday, February 29, 2008");
  assert.equal(addSubtract(dateMake(2008, 3, 31), "add", { months: 1, days: 10 }).result,
    "Saturday, May 10, 2008");
  assert.equal(addSubtract(dateMake(2008, 1, 31), "add", { months: 1, days: 10 }).result,
    "Monday, March 10, 2008");

  // S1-S3: the day-before-month order is what makes S2 land on 2008-01-29.
  assert.equal(addSubtract(dateMake(2008, 3, 31), "subtract", { months: 1 }).result,
    "Friday, February 29, 2008");
  assert.equal(addSubtract(dateMake(2008, 3, 10), "subtract", { months: 1, days: 10 }).result,
    "Tuesday, January 29, 2008");
  assert.equal(addSubtract(dateMake(2007, 3, 10), "subtract", { months: 1, days: 10 }).result,
    "Sunday, January 28, 2007");
});

test("month arithmetic clamps to the target month's last day", () => {
  assert.equal(addSubtract(dateMake(2008, 1, 31), "add", { months: 1 }).result,
    "Friday, February 29, 2008", "2008 is a leap year");
  assert.equal(addSubtract(dateMake(2008, 3, 31), "subtract", { months: 1 }).result,
    "Friday, February 29, 2008");
  assert.equal(addSubtract(dateMake(2009, 1, 31), "add", { months: 1 }).result,
    "Saturday, February 28, 2009", "2009 is not");
  assert.equal(addSubtract(dateMake(2008, 2, 29), "add", { years: 1 }).result,
    "Saturday, February 28, 2009", "29 February clamps in a non-leap year");
  assert.equal(app.engine.dateFormat(dateAddYears(dateMake(2008, 2, 29), 1)), "2/28/2009");
});

test("offsets are 0-999 and 0 is the identity", () => {
  const plusZero = addSubtract(dateMake(2008, 3, 31), "add", { years: 0, months: 0, days: 0 });
  assert.equal(plusZero.result, "Monday, March 31, 2008");
  assert.equal(plusZero.offset("years"), 0);

  const max = addSubtract(dateMake(2008, 3, 31), "add", { days: 999 });
  assert.equal(max.offset("days"), 999);
  assert.equal(max.result, "Saturday, December 25, 2010");

  const tooBig = addSubtract(dateMake(2008, 3, 31), "add", { days: 1000 });
  assert.equal(tooBig.offset("days"), 0, "an offset above 999 is refused");
  const negative = addSubtract(dateMake(2008, 3, 31), "add", { days: -1 });
  assert.equal(negative.offset("days"), 0, "offsets are not negative; direction carries the sign");

  // 999 in each unit at once.
  const all = addSubtract(dateMake(2008, 1, 1), "add", { years: 999, months: 999, days: 999 });
  assert.equal(all.result, "Date out of Bound", "999 years from 2008 leaves the supported range");
});

test("a result outside the supported range is refused", () => {
  // The reachable cases: the picker's own bounds.
  assert.equal(addSubtract(dateMake(2550, 12, 31), "add", { days: 1 }).result, "Date out of Bound");
  assert.equal(addSubtract(dateMake(1601, 1, 1), "subtract", { days: 1 }).result, "Date out of Bound");
  assert.equal(addSubtract(dateMake(2550, 12, 31), "add", { years: 1 }).result, "Date out of Bound");
  assert.equal(addSubtract(dateMake(1601, 12, 31), "subtract", { years: 1 }).result, "Date out of Bound");

  // O1-O4: the reference's own out-of-bound vectors, which sit beyond the
  // picker's range and are therefore engine-level (the scout flags them so).
  assert.equal(dateInRange(dateAddDays(dateMake(9999, 12, 30), 2)), false);
  assert.equal(dateInRange(dateAddYears(dateMake(9998, 12, 31), 2008)), false);
  assert.equal(dateInRange(dateAddDays(dateMake(1601, 1, 1), -2)), false);
  assert.equal(dateInRange(dateAddYears(dateMake(2008, 3, 31), -2008)), false);

  // The bound itself is inside.
  assert.equal(addSubtract(dateMake(2550, 12, 30), "add", { days: 1 }).result,
    "Thursday, December 31, 2550");
  assert.equal(addSubtract(dateMake(1601, 1, 2), "subtract", { days: 1 }).result,
    "Monday, January 1, 1601");
});

test("every input change updates the result, with no Calculate step", () => {
  const calc = calculator(dateMake(2008, 1, 31));
  assert.equal(calc.result, "Same dates");

  calc.setDate("to", dateMake(2008, 2, 29));
  assert.equal(calc.result, "1 month", "setting To recomputed at once");

  calc.setOption("addSubtract");
  assert.equal(calc.result, "Thursday, January 31, 2008", "the option switch recomputed at once");
  assert.equal(calc.resultInDays, "", "the secondary line belongs to the difference calculator");

  calc.setOffset("months", 1);
  assert.equal(calc.result, "Friday, February 29, 2008");

  calc.setDirection("subtract");
  assert.equal(calc.result, "Monday, December 31, 2007");

  calc.setDateText("from", "12/15/2007");
  assert.equal(calc.result, "Thursday, November 15, 2007");
});

test("defaults: difference, add, today for both dates, offsets 0", () => {
  const calc = calculator();
  assert.equal(calc.option, "difference");
  assert.equal(calc.direction, "add");
  assert.equal(calc.fromText, "9/12/2026");
  assert.equal(calc.toText, "9/12/2026");
  assert.equal(calc.offset("years"), 0);
  assert.equal(calc.offset("months"), 0);
  assert.equal(calc.offset("days"), 0);
  assert.equal(calc.result, "Same dates");

  const add = calculator();
  add.setOption("addSubtract");
  assert.equal(add.result, "Saturday, September 12, 2026", "From at offset 0 is From");
});

test("the From date survives switching between the two calculators", () => {
  const calc = calculator(dateMake(2008, 1, 31));
  calc.setDate("to", dateMake(2008, 3, 31));
  assert.equal(calc.result, "2 months");

  calc.setOption("addSubtract");
  assert.equal(calc.fromText, "1/31/2008", "the date carries into the other calculator");
  calc.setOffset("months", 1);
  assert.equal(calc.result, "Friday, February 29, 2008");

  calc.setOption("difference");
  assert.equal(calc.fromText, "1/31/2008", "and back again");
  assert.equal(calc.result, "2 months", "the To date is still there too");
});

test("dates parse in the shapes the field accepts and only real dates pass", () => {
  assert.equal(dateFormat(dateParse("2/29/2008")), "2/29/2008");
  assert.equal(dateFormat(dateParse("02/29/2008")), "2/29/2008");
  assert.equal(dateFormat(dateParse("2008-02-29")), "2/29/2008");
  assert.equal(dateFormat(dateParse("February 29, 2008")), "2/29/2008");
  assert.equal(dateFormat(dateParse("Feb 29, 2008")), "2/29/2008");
  assert.equal(dateFormat(dateParse("29 February 2008")), "2/29/2008");
  assert.equal(dateFormat(dateParse("  2/29/2008  ")), "2/29/2008");

  assert.equal(dateParse("2/30/2008"), null, "February has no 30th");
  assert.equal(dateParse("2/29/2007"), null, "2007 is not a leap year");
  assert.equal(dateParse("13/1/2008"), null);
  assert.equal(dateParse("1/32/2008"), null);
  assert.equal(dateParse("Smarch 1, 2008"), null);
  assert.equal(dateParse("garbage"), null);
  assert.equal(dateParse(""), null);
  assert.equal(dateParse(null), null);

  assert.equal(dateFormat(dateMake(2013, 9, 2)), "9/2/2013", "no leading zeros");
  assert.equal(dateFormatLong(dateMake(2013, 9, 2)), "Monday, September 2, 2013");
  assert.equal(dateIsValid(dateMake(2008, 2, 29)), true);
  assert.equal(dateIsValid(dateMake(2007, 2, 29)), false);
});

test("the mode's range is the reference's 1601-01-01 to 2550-12-31", () => {
  assert.equal(dateInRange(dateMake(1601, 1, 1)), true);
  assert.equal(dateInRange(dateMake(1600, 12, 31)), false);
  assert.equal(dateInRange(dateMake(2550, 12, 31)), true);
  assert.equal(dateInRange(dateMake(2551, 1, 1)), false);

  const calc = calculator();
  assert.equal(calc.setDateText("from", "12/31/1600"), false, "below the range is refused");
  assert.equal(calc.fromText, "9/12/2026", "and the date does not move");
  assert.equal(calc.setDateText("from", "1/1/2551"), false);
  assert.equal(calc.setDateText("from", "1/1/1601"), true);
  assert.equal(calc.setDateText("from", "12/31/2550"), true);

  // An unparsable entry leaves the date as it was, as the reference's reselect
  // path does.
  assert.equal(calc.setDateText("to", "nonsense"), false);
  assert.equal(calc.toText, "9/12/2026");
});

test("a difference that cannot be decomposed reports 'Calculation failed'", () => {
  // No UI path reaches this: the field setters validate. The engine-level
  // branch is what the reference's CalculationFailed string is for, and the
  // scout notes the reference's own branch is likewise unreachable.
  const calc = calculator(dateMake(2008, 1, 31));
  calc.from = dateMake(2008, 2, 30); // not a real date
  assert.equal(calc.result, "Calculation failed");
  assert.equal(calc.resultInDays, "");
  assert.equal(app.engine.DATE_FAILED_TEXT, "Calculation failed");
});

test("the string surfaces are the reference's en-US wording", () => {
  assert.equal(app.engine.DATE_SAME_TEXT, "Same dates");
  assert.equal(app.engine.DATE_OUT_OF_BOUND_TEXT, "Date out of Bound");
  assert.equal(dateDifferenceText({ years: 1, months: 2, weeks: 3, days: 4 }),
    "1 year, 2 months, 3 weeks, 4 days");
  assert.equal(dateDifferenceText({ years: 0, months: 2, weeks: 0, days: 1 }), "2 months, 1 day",
    "zero units are omitted and the separator is a comma and a space");
  assert.equal(dateDifferenceDaysText(1), "1 day");
  assert.equal(dateDifferenceDaysText(2918987), "2918987 days");

  // The mode's data carries the reference's labels.
  assert.equal(date.label, "Date Calculation");
  assert.deepEqual(date.options.map((option) => option.label),
    ["Difference between dates", "Add or subtract days"]);
  assert.deepEqual(date.directions.map((direction) => direction.label), ["Add", "Subtract"]);
  assert.deepEqual(date.units.map((unit) => unit.label), ["Years", "Months", "Days"]);
  assert.equal(date.strings.from, "From");
  assert.equal(date.strings.to, "To");
  assert.equal(date.strings.difference, "Difference");
  assert.equal(date.strings.date, "Date");
});

test("the date view replaces the keypad and carries no memory or history", () => {
  // The reference's date view has no memory controls and disables history; the
  // shell hides both with it. These are source-level checks because Node has
  // no DOM (the browser check covers the live behaviour).
  const html = readSource("index.html");
  const css = readSource("styles.css");
  const ui = readSource("ui.js");

  assert.ok(html.includes('id="date-panel"'), "the date panel is in the document");
  assert.ok(/<script src="modes\/date\.js"><\/script>/.test(html), "the mode file is loaded");
  assert.ok(css.includes('.calc[data-mode="date"] .memory-row'), "the memory row is hidden in this mode");
  assert.ok(ui.includes("historyButton.hidden = isDate"), "the history button is hidden in this mode");
  assert.ok(ui.includes('element("date-option")'), "the option selector is wired");
  assert.ok(ui.includes('element("date-calendar")'), "the calendar is wired");

  // The panel carries what the reference's two calculators carry.
  for (const id of ["date-from", "date-to", "date-from-button", "date-to-button",
    "date-directions", "date-units", "date-result-value", "date-result-days",
    "date-calendar", "date-calendar-prev", "date-calendar-next", "date-calendar-grid"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing #" + id);
  }
});
