/* Scientific mode (AC-003): expression evaluation with standard precedence
 * and parentheses on "=", the Scientific function set, DEG/RAD/GRAD,
 * exponent entry, memory and history - plus the keypad data the shell
 * renders. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, press } = require("./helper.js");

const app = loadApp();
const { scientific } = app.modes;
const { Calculator, ERRORS } = app.engine;

function sci() {
  const calc = new Calculator();
  calc.setMode("scientific");
  return calc;
}

test("Scientific evaluates with operator precedence, on =", () => {
  const calc = sci();
  // Standard would answer 9 here; Scientific answers 7 and only on "=".
  assert.equal(press(calc, "1,op:add,2,op:mul,3"), "3");
  assert.equal(calc.expression, "1 + 2 \u00d7");
  assert.equal(press(calc, "equals"), "7");
  assert.equal(calc.expression, "1 + 2 \u00d7 3 =");

  const minus = sci();
  assert.equal(press(minus, "1,0,op:sub,2,op:mul,3,equals"), "4");

  const power = sci();
  assert.equal(press(power, "2,op:add,3,op:pow,2,equals"), "11");

  const divide = sci();
  assert.equal(press(divide, "1,0,0,op:div,1,0,op:add,5,equals"), "15");
});

test("parentheses group, nest, and close at =", () => {
  const grouped = sci();
  assert.equal(press(grouped, "paren:open,2,op:add,3,paren:close,op:mul,4,equals"), "20");
  assert.equal(grouped.expression, "(2 + 3) \u00d7 4 =");

  const nested = sci();
  assert.equal(press(nested, "paren:open,paren:open,2,op:add,3,paren:close,op:mul,4,paren:close,op:sub,1,equals"), "19");

  // An operand directly before "(" multiplies.
  const implicit = sci();
  assert.equal(press(implicit, "2,op:mul,paren:open,3,op:add,4,paren:close,equals"), "14");
  assert.equal(press(implicit, "clear,paren:open,1,op:add,1,paren:close,paren:open,1,op:add,1,paren:close,equals"), "4");

  // An unclosed group is closed implicitly, as in the real app.
  const unclosed = sci();
  assert.equal(press(unclosed, "paren:open,2,op:add,3,equals"), "5");
  assert.equal(press(unclosed, "clear,2,op:add,3,paren:close,equals"), "5", "a stray ) is inert");
});

test("the expression line grows while the expression is typed", () => {
  const calc = sci();
  assert.equal(calc.expression, "");
  press(calc, "1,2,op:add,3");
  assert.equal(calc.expression, "12 +", "the operand being typed stays on the value line");
  assert.equal(calc.display, "3");
  press(calc, "4,op:mul");
  assert.equal(calc.expression, "12 + 34 \u00d7");
  press(calc, "2");
  assert.equal(calc.expression, "12 + 34 \u00d7");
  press(calc, "equals");
  assert.equal(calc.expression, "12 + 34 \u00d7 2 =");
  assert.equal(calc.display, "80");
  // A digit starts a new expression; an operator continues from the result.
  press(calc, "7");
  assert.equal(calc.expression, "");
  assert.equal(press(calc, "op:add,3,equals"), "10");
});

test("a unary function applies to the current operand and wraps it", () => {
  const square = sci();
  assert.equal(press(square, "9,unary:square"), "81");
  assert.equal(square.expression, "sqr(9)");
  assert.equal(press(square, "unary:negate"), "-81");
  assert.equal(square.expression, "-sqr(9)");

  const root = sci();
  assert.equal(press(root, "9,unary:sqrt,op:add,1,equals"), "4");
  assert.equal(root.expression, "\u221a(9) + 1 =");

  // A parenthesised group keeps its own brackets in the expression line.
  const grouped = sci();
  assert.equal(press(grouped, "paren:open,9,op:add,7,paren:close,unary:sqrt"), "4");
  assert.equal(grouped.expression, "\u221a(9 + 7)");

  // Functions nest.
  const nested = sci();
  assert.equal(press(nested, "9,unary:square,unary:sqrt"), "9");
  assert.equal(nested.expression, "\u221a(sqr(9))");
});

test("DEG, RAD and GRAD drive the trigonometric functions", () => {
  const degrees = sci();
  assert.equal(degrees.angleUnit, "DEG", "degrees are the default, as in the app");
  assert.equal(press(degrees, "3,0,unary:sin"), "0.5");
  assert.equal(press(degrees, "clear,6,0,unary:cos"), "0.5");
  assert.equal(press(degrees, "clear,4,5,unary:tan"), "1");
  assert.equal(press(degrees, "clear,9,0,unary:cos"), "0");
  assert.equal(press(degrees, "clear,1,8,0,unary:sin"), "0");
  assert.equal(press(degrees, "clear,9,0,unary:tan"), ERRORS.undefined);

  const radians = sci();
  assert.equal(press(radians, "angle:rad,paren:open,const:pi,op:div,2,paren:close,unary:sin"), "1");
  assert.equal(press(radians, "clear,1,unary:sin"), "0.8414709848078965");
  assert.equal(press(radians, "clear,0,unary:cos"), "1");

  const gradians = sci();
  assert.equal(press(gradians, "angle:grad,1,0,0,unary:sin"), "1");
  assert.equal(press(gradians, "clear,2,0,0,unary:cos"), "-1", "200 gradians is a half turn");
  assert.equal(press(gradians, "clear,5,0,unary:sin"), "0.7071067811865475");

  // The angle unit only affects trigonometry.
  const plain = sci();
  assert.equal(press(plain, "angle:rad,3,0,op:add,1,equals"), "31");
});

test("inverse trigonometric functions return the active unit", () => {
  const degrees = sci();
  assert.equal(press(degrees, "0,point,5,unary:asin"), "30");
  assert.equal(press(degrees, "clear,0,point,5,unary:acos"), "60");
  assert.equal(press(degrees, "clear,1,unary:atan"), "45");

  const radians = sci();
  assert.equal(press(radians, "angle:rad,0,point,5,unary:asin"), "0.5235987755982989");
  assert.equal(press(radians, "clear,1,unary:atan"), "0.7853981633974483");

  const gradians = sci();
  assert.equal(press(gradians, "angle:grad,0,point,5,unary:asin"), "33.33333333333334");
  assert.equal(press(gradians, "clear,0,point,5,unary:acos"), "66.66666666666667");
});

test("out-of-domain functions report Invalid input", () => {
  const asin = sci();
  assert.equal(press(asin, "2,unary:asin"), ERRORS.invalidInput);
  assert.equal(press(asin, "clear,9,unary:negate,unary:sqrt"), ERRORS.invalidInput);
  assert.equal(press(asin, "clear,1,0,unary:negate,unary:ln"), ERRORS.invalidInput);
  assert.equal(press(asin, "clear,0,unary:log"), ERRORS.invalidInput);
  assert.equal(press(asin, "clear,2,unary:negate,unary:factorial"), ERRORS.invalidInput);
  // A digit recovers, as in Standard.
  assert.equal(press(asin, "4"), "4");
});

test("log, ln, e^x, 10^x and 2^x", () => {
  const calc = sci();
  assert.equal(press(calc, "1,0,0,0,unary:log"), "3");
  assert.equal(press(calc, "clear,0,point,0,0,1,unary:log"), "-3");
  assert.equal(press(calc, "clear,2,unary:log"), "0.3010299956639812");
  assert.equal(press(calc, "clear,const:e,unary:ln"), "1");
  assert.equal(press(calc, "clear,1,unary:exp,unary:ln"), "1");
  assert.equal(press(calc, "clear,3,unary:tenpow"), "1,000");
  assert.equal(press(calc, "clear,1,0,unary:twopow"), "1,024");
  assert.equal(press(calc, "clear,8,op:logy,2,equals"), "3");
});

test("powers and roots: x squared, x cubed, x to the y, sqrt, cbrt, y-root", () => {
  const calc = sci();
  assert.equal(press(calc, "7,op:pow,3,equals"), "343");
  assert.equal(press(calc, "clear,9,op:pow,0,point,5,equals"), "3");
  assert.equal(press(calc, "clear,2,op:pow,1,0,equals"), "1,024", "y wins over the pending x");
  assert.equal(press(calc, "clear,3,unary:cube"), "27");
  assert.equal(press(calc, "clear,2,7,op:root,3,equals"), "3");
  assert.equal(press(calc, "clear,1,6,op:root,4,equals"), "2");
  assert.equal(press(calc, "clear,8,unary:sqrt"), "2.82842712474619");
  assert.equal(press(calc, "clear,2,7,unary:cbrt"), "3");
});

test("factorial, absolute value, mod, floor, ceil and round", () => {
  const calc = sci();
  assert.equal(press(calc, "5,unary:factorial"), "120");
  assert.equal(press(calc, "clear,2,0,unary:factorial"), "2.43290200817664e+18");
  assert.equal(press(calc, "clear,0,unary:factorial"), "1");
  assert.equal(press(calc, "clear,0,point,5,unary:factorial"), "0.8862269254527586");
  assert.equal(press(calc, "clear,3,point,7,unary:negate,unary:abs"), "3.7");
  assert.equal(press(calc, "clear,1,0,op:mod,3,equals"), "1");
  assert.equal(press(calc, "clear,1,0,op:mod,0,equals"), ERRORS.undefined);
  assert.equal(press(calc, "clear,3,point,7,unary:floor"), "3");
  assert.equal(press(calc, "clear,1,0,unary:negate,unary:floor"), "-10");
  assert.equal(press(calc, "clear,3,point,2,unary:ceil"), "4");
  assert.equal(press(calc, "clear,1,0,unary:negate,unary:ceil"), "-10");
  assert.equal(press(calc, "clear,3,point,7,unary:round"), "4");
  assert.equal(press(calc, "clear,3,point,5,unary:round"), "4", "half rounds away from zero");
  assert.equal(press(calc, "clear,4,point,5,unary:negate,unary:round"), "-5");
});

test("percent and reciprocal keep their meanings", () => {
  const calc = sci();
  assert.equal(press(calc, "5,0,unary:percent"), "0.5");
  assert.equal(calc.expression, "/100(50)");
  assert.equal(press(calc, "op:mul,8,equals"), "4");
  assert.equal(press(calc, "clear,8,unary:reciprocal"), "0.125");
  assert.equal(press(calc, "clear,0,unary:reciprocal"), ERRORS.divideByZero);
});

test("pi and e are the real constants", () => {
  const calc = sci();
  assert.equal(press(calc, "const:pi"), "3.141592653589793");
  assert.equal(calc.expression, "\u03c0");
  assert.equal(press(calc, "op:mul,2,equals"), "6.283185307179586");

  const euler = sci();
  assert.equal(press(euler, "const:e"), "2.718281828459045");
  assert.equal(euler.expression, "e");
  assert.equal(press(euler, "op:pow,2,equals"), "7.38905609893065");
});

test("the exp key types the times-ten-to-the-n exponent entry", () => {
  const calc = sci();
  assert.equal(press(calc, "2,entry:exp,3"), "2e+3");
  assert.equal(press(calc, "op:mul,2,equals"), "4,000");
  assert.equal(calc.history[0].expression, "2e+3 \u00d7 2 =");

  const implicitOne = sci();
  assert.equal(press(implicitOne, "entry:exp,3"), "1e+3");
  assert.equal(press(implicitOne, "op:add,0,equals"), "1,000");

  const negative = sci();
  assert.equal(press(negative, "5,entry:exp,unary:negate,2"), "5e-2");
  assert.equal(press(negative, "op:mul,1,equals"), "0.05");

  // The exponent takes at most three digits and backspace leaves it whole.
  const capped = sci();
  assert.equal(press(capped, "1,2,entry:exp,1,2,3,4"), "12e+123");
  assert.equal(press(capped, "backspace"), "12e+12");
  assert.equal(press(capped, "backspace,backspace"), "12");
});

test("memory works in Scientific, as it does in Standard", () => {
  const calc = sci();
  assert.equal(calc.hasMemory, false);
  assert.equal(press(calc, "5,memory:store"), "5");
  assert.equal(calc.hasMemory, true);

  press(calc, "clear,3,memory:add");
  assert.equal(calc.memory, 8);
  press(calc, "memory:subtract");
  assert.equal(calc.memory, 5);

  press(calc, "clear");
  assert.equal(press(calc, "memory:recall"), "5");
  assert.equal(press(calc, "op:add,2,equals"), "7", "a recalled value is an operand");

  press(calc, "memory:clear");
  assert.equal(calc.hasMemory, false);
  assert.equal(press(calc, "clear,9,memory:recall"), "9", "MR is inert with nothing stored");

  // A computed expression can be stored too.
  const computed = sci();
  press(computed, "2,op:add,3,op:mul,4,equals,memory:store");
  assert.equal(computed.memory, 14);
});

test("history records scientific evaluations", () => {
  const calc = sci();
  press(calc, "2,op:add,3,op:mul,4");
  assert.equal(calc.history.length, 0, "an unfinished expression is not history");

  press(calc, "equals");
  assert.equal(calc.history.length, 1);
  assert.equal(calc.history[0].expression, "2 + 3 \u00d7 4 =");
  assert.equal(calc.history[0].result, "14");

  press(calc, "equals");
  assert.equal(calc.history.length, 2);
  assert.equal(calc.history[1].expression, "14 \u00d7 4 =");
  assert.equal(calc.history[1].result, "56");

  const failed = sci();
  press(failed, "1,op:div,0,equals");
  assert.equal(failed.history.length, 0, "failed calculations are not history");

  calc.clearHistory();
  assert.equal(calc.history.length, 0);
});

test("errors surface and recover through C, CE, Backspace or a digit", () => {
  const divide = sci();
  assert.equal(press(divide, "5,op:div,0,equals"), ERRORS.divideByZero);
  assert.equal(press(divide, "0,op:div,0,equals"), ERRORS.undefined);

  const overflow = sci();
  assert.equal(press(overflow, "2,0,0,unary:tenpow,unary:square"), ERRORS.overflow);

  const digit = sci();
  press(digit, "5,op:div,0,equals");
  assert.equal(press(digit, "4,op:add,1,equals"), "5");

  const clear = sci();
  press(clear, "5,op:div,0,equals");
  assert.equal(press(clear, "clear"), "0");

  const clearEntry = sci();
  press(clearEntry, "5,op:div,0,equals");
  assert.equal(press(clearEntry, "clearEntry"), "0");

  const backspace = sci();
  press(backspace, "5,op:div,0,equals");
  assert.equal(press(backspace, "backspace"), "0");

  // Unary keys and operators do nothing while an error is displayed.
  const others = sci();
  const message = press(others, "5,op:div,0,equals");
  assert.equal(press(others, "unary:sqrt"), message);
  assert.equal(press(others, "op:add"), message);
  assert.equal(press(others, "paren:open"), message);
});

test("= repeats the last operation and an operator pressed twice is replaced", () => {
  const repeat = sci();
  assert.equal(press(repeat, "2,op:add,3,equals"), "5");
  assert.equal(press(repeat, "equals"), "8");
  assert.equal(press(repeat, "equals"), "11");
  assert.equal(press(repeat, "1,0,equals"), "13");
  assert.equal(repeat.expression, "10 + 3 =");

  const replaced = sci();
  assert.equal(press(replaced, "5,op:add,op:mul,3,equals"), "15");
  assert.equal(press(replaced, "clear,5,op:add,op:sub,3,equals"), "2");

  // = with nothing to repeat is inert.
  const bare = sci();
  assert.equal(press(bare, "equals"), "0");
  assert.equal(press(bare, "5,equals"), "5");
  assert.equal(press(sci(), "2,op:add,equals"), "4");
});

test("CE clears the entry, C clears the expression, Backspace edits the entry", () => {
  const calc = sci();
  press(calc, "1,2,op:add,5");
  assert.equal(press(calc, "clearEntry"), "0");
  assert.equal(calc.expression, "12 +", "the expression survives CE");
  assert.equal(press(calc, "6,equals"), "18");

  press(calc, "1,2,3,backspace");
  assert.equal(calc.display, "12");
  assert.equal(press(calc, "backspace,backspace,backspace"), "0");

  press(calc, "1,op:add,2,equals");
  assert.equal(press(calc, "backspace"), "3", "results are not editable");

  press(calc, "clear");
  assert.equal(calc.expression, "");
  assert.equal(calc.display, "0");
});

test("the input cap and the decimal point keep their Standard rules", () => {
  const calc = sci();
  press(calc, "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1");
  assert.equal(calc.display, "1,111,111,111,111,111");

  press(calc, "clear,0,point,5");
  assert.equal(calc.display, "0.5");
  assert.equal(press(calc, "point,2"), "0.52", "a second decimal point is ignored");

  press(calc, "clear,point,5");
  assert.equal(calc.display, "0.5");
});

test("switching modes evaluates differently and keeps value, memory and history", () => {
  const calc = new Calculator();
  assert.equal(press(calc, "5,memory:store,clear,1,op:add,2,op:mul,3,equals"), "9");
  assert.equal(calc.mode, "standard");

  calc.setMode("scientific");
  assert.equal(calc.mode, "scientific");
  assert.equal(calc.display, "9", "the value carries across the switch");
  assert.equal(calc.memory, 5);
  assert.equal(calc.history.length, 1);
  assert.equal(press(calc, "clear,1,op:add,2,op:mul,3,equals"), "7");

  calc.setMode("standard");
  assert.equal(press(calc, "clear,1,op:add,2,op:mul,3,equals"), "9", "Standard stays left to right");
  assert.equal(calc.memory, 5);
  assert.equal(calc.history.length, 3);

  // The unimplemented modes run the Standard machine; the expression in
  // progress does not follow the value across the switch.
  calc.setMode("scientific");
  press(calc, "clear,2,op:add,3,paren:open");
  assert.equal(calc.expression, "2 + 3 \u00d7 (");
  calc.setMode("graphing");
  assert.equal(calc.mode, "standard");
  assert.equal(calc.display, "3");
  assert.equal(calc.expression, "");
  press(calc, "1,op:add,2,equals");
  assert.equal(calc.display, "3");
  assert.equal(calc.expression, "");
});

test("the Scientific keypad is the Windows 11 layout", () => {
  assert.equal(scientific.columns, 6, "Scientific is six keys wide");
  assert.equal(scientific.keypad.length, 8);
  for (const row of scientific.keypad) assert.equal(row.length, 6);

  const labels = scientific.keypad.map((row) => row.map((key) => key.label));
  assert.deepEqual(labels[0], ["2nd", "DEG", "RAD", "GRAD", "x\u00b2", "\u232b"]);
  assert.deepEqual(labels[1].slice(0, 4), ["x\u02b8", "7", "8", "9"]);
  assert.deepEqual(labels[4].slice(1), ["\u00b1", "0", ".", "+", "="]);
  assert.deepEqual(labels[5].slice(4), ["(", ")"]);
});

test("the keypad covers every AC-003 family exactly once", () => {
  const keys = scientific.keypad.flat();
  const actions = keys.map((key) => key.action);
  assert.equal(new Set(actions).size, actions.length, "duplicate action in the keypad");

  // Some functions live in the 2nd layer (see the next test): coverage counts
  // a button's base action and its alt layer together.
  const available = actions.concat(keys.filter((key) => key.alt).map((key) => key.alt.action));
  const families = [
    // DEG/RAD/GRAD, trig and its inverses, log/ln, exp, powers and roots,
    // factorial, absolute value, mod, floor/ceil/round, pi and e,
    // parentheses, exponent entry
    "angle:deg", "angle:rad", "angle:grad",
    "unary:sin", "unary:cos", "unary:tan", "unary:asin", "unary:acos", "unary:atan",
    "unary:log", "unary:ln", "unary:exp", "op:logy",
    "unary:square", "unary:cube", "unary:sqrt", "unary:cbrt", "unary:tenpow",
    "unary:twopow", "op:pow", "op:root",
    "unary:factorial", "unary:abs", "op:mod", "unary:floor", "unary:ceil", "unary:round",
    "const:pi", "const:e", "paren:open", "paren:close", "entry:exp"
  ];
  for (let digit = 0; digit <= 9; digit++) families.push("digit:" + digit);
  families.push("point", "equals", "clear", "clearEntry", "backspace", "unary:negate",
    "unary:percent", "unary:reciprocal", "op:add", "op:sub", "op:mul", "op:div");

  for (const action of families) {
    assert.ok(available.includes(action), action + " is missing from the Scientific keypad");
  }

  for (const key of keys) {
    assert.ok(Calculator.isAction(key.action), key.action + " is not an engine action");
    assert.ok(["digit", "function", "operator", "equals"].includes(key.role),
      key.label + " has an unknown role");
  }
  const equals = keys.filter((key) => key.role === "equals");
  assert.equal(equals.length, 1);
  assert.equal(equals[0].label, "=");
});

test("the 2nd layer carries the inverse functions and the real app's variants", () => {
  const byAction = {};
  for (const key of scientific.keypad.flat()) byAction[key.action] = key;

  const expected = {
    "unary:sin": "unary:asin",
    "unary:cos": "unary:acos",
    "unary:tan": "unary:atan",
    "unary:sqrt": "unary:cbrt",
    "unary:tenpow": "unary:twopow",
    "unary:log": "op:logy",
    "unary:ln": "unary:exp"
  };
  for (const [base, alt] of Object.entries(expected)) {
    assert.ok(byAction[base], base + " is missing from the keypad");
    assert.equal(byAction[base].alt.action, alt, base + "'s 2nd layer");
    assert.ok(Calculator.isAction(alt), alt + " is not an engine action");
    assert.ok(byAction[base].alt.label.length > 0);
  }
});

test("the 2nd toggle is engine state and C leaves it alone", () => {
  const calc = sci();
  assert.equal(calc.second, false);
  press(calc, "second");
  assert.equal(calc.second, true);
  assert.equal(press(calc, "second"), "0");
  assert.equal(calc.second, false);

  press(calc, "second,5,clear");
  assert.equal(calc.second, true, "C clears the expression, not the 2nd layer");
  calc.setMode("standard");
  calc.setMode("scientific");
  assert.equal(calc.second, false, "switching modes drops the 2nd layer");
});
