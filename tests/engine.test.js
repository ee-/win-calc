/* Engine semantics (AC-001): left-to-right evaluation, repeated "=", operator
 * replacement, CE / C / Backspace, unary operations, errors and recovery. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { calculator, press } = require("./helper.js");

test("Standard mode evaluates left to right, not by precedence", () => {
  const calc = calculator();
  assert.equal(press(calc, "1,op:add,2,op:mul,3,equals"), "9");
  assert.equal(press(calc, "1,op:add,2,op:mul,3,equals"), "9");
  // Intermediate results appear as soon as the next operator arrives.
  const chained = calculator();
  assert.equal(press(chained, "2,op:add,3,op:mul"), "5");
  assert.equal(chained.expression, "5 \u00d7");
  assert.equal(press(chained, "4,equals"), "20");
});

test("pressing = repeats the last operation", () => {
  const calc = calculator();
  assert.equal(press(calc, "2,op:add,3,equals"), "5");
  assert.equal(press(calc, "equals"), "8");
  assert.equal(press(calc, "equals"), "11");

  const multiply = calculator();
  assert.equal(press(multiply, "2,op:mul,3,equals"), "6");
  assert.equal(press(multiply, "equals"), "18");
  assert.equal(press(multiply, "equals"), "54");

  // A new number then "=" repeats with the stored operand.
  assert.equal(press(calc, "1,0,equals"), "13");
});

test("= with nothing to repeat is inert", () => {
  assert.equal(press(calculator(), "equals"), "0");
  assert.equal(press(calculator(), "5,equals"), "5");
  assert.equal(press(calculator(), "2,op:add,equals"), "4");
});

test("pressing an operator twice replaces it", () => {
  const add = calculator();
  assert.equal(press(add, "5,op:add,op:add,3,equals"), "8");

  const swap = calculator();
  assert.equal(press(swap, "5,op:add,op:mul,3,equals"), "15");

  const minus = calculator();
  assert.equal(press(minus, "5,op:add,op:sub,3,equals"), "2");

  // Unknown or malformed actions are ignored rather than throwing.
  assert.equal(press(minus, "op:multiply"), "2");
  assert.equal(press(minus, "nonsense"), "2");
  assert.equal(press(minus, "digit"), "2");
  assert.equal(press(minus, "digit:x"), "2");
  assert.equal(press(minus, "op"), "2");
  assert.equal(press(minus, ""), "2");
  assert.equal(minus.press(null), undefined, "a null action is ignored");
  assert.equal(minus.display, "2");
});

test("an operator after = continues from the result", () => {
  const calc = calculator();
  assert.equal(press(calc, "2,op:add,3,equals"), "5");
  assert.equal(press(calc, "op:mul,4,equals"), "20");
});

test("CE clears the current entry only", () => {
  const calc = calculator();
  assert.equal(press(calc, "1,2,op:add,5"), "5");
  assert.equal(press(calc, "clearEntry"), "0");
  assert.equal(calc.expression, "12 +");
  // The pending operation survives, so the new entry replaces the old one.
  assert.equal(press(calc, "6,equals"), "18");

  const result = calculator();
  assert.equal(press(result, "2,op:add,3,equals"), "5");
  assert.equal(press(result, "clearEntry"), "0");
});

test("C clears the operation but keeps memory and history", () => {
  const calc = calculator();
  press(calc, "5,memory:store");
  press(calc, "2,op:add,3,equals");
  assert.equal(press(calc, "clear"), "0");
  assert.equal(calc.expression, "");
  assert.equal(calc.pendingOp, null);
  assert.equal(calc.history.length, 1);
  assert.equal(calc.memory, 5);
  assert.equal(press(calc, "memory:recall"), "5");
});

test("Backspace edits the entry and is inert on a computed result", () => {
  const calc = calculator();
  assert.equal(press(calc, "1,2,3,backspace"), "12");
  assert.equal(press(calc, "backspace,backspace,backspace"), "0");
  assert.equal(press(calc, "7"), "7");

  const fraction = calculator();
  assert.equal(press(fraction, "5,point,backspace"), "5");

  const result = calculator();
  assert.equal(press(result, "2,op:add,3,equals"), "5");
  assert.equal(press(result, "backspace"), "5");

  const negative = calculator();
  assert.equal(press(negative, "5,unary:negate,backspace"), "0");
});

test("+/- negates the entry and toggles back", () => {
  const calc = calculator();
  assert.equal(press(calc, "5,unary:negate"), "-5");
  assert.equal(press(calc, "3"), "-53");
  assert.equal(press(calc, "unary:negate"), "53");

  const squared = calculator();
  assert.equal(press(squared, "2,op:add,3,equals,unary:negate"), "-5");
});

test("percent is relative to the pending + or - operand", () => {
  const add = calculator();
  assert.equal(press(add, "50,op:add,1,0,unary:percent,equals"), "55");

  const minus = calculator();
  assert.equal(press(minus, "50,op:sub,1,0,unary:percent,equals"), "45");

  const bare = calculator();
  assert.equal(press(bare, "50,unary:percent"), "0.5");
});

test("percent under multiply and divide converts the entry to a fraction", () => {
  const mul = calculator();
  assert.equal(press(mul, "200,op:mul,1,0,unary:percent"), "0.1");
  assert.equal(press(mul, "equals"), "20");

  const div = calculator();
  assert.equal(press(div, "200,op:div,1,0,unary:percent"), "0.1");
  assert.equal(press(div, "equals"), "2,000");
});

test("1/x, x^2 and sqrt", () => {
  const reciprocal = calculator();
  assert.equal(press(reciprocal, "4,unary:reciprocal"), "0.25");

  const square = calculator();
  assert.equal(press(square, "9,unary:square"), "81");
  assert.equal(press(square, "unary:reciprocal"), "0.01234567901234568");

  const root = calculator();
  assert.equal(press(root, "9,unary:sqrt"), "3");
  assert.equal(press(root, "clear,2,unary:sqrt"), "1.414213562373095");
});

test("divide by zero and zero divided by zero", () => {
  const byZero = calculator();
  assert.equal(press(byZero, "5,op:div,0,equals"), "Cannot divide by zero");

  const zeroByZero = calculator();
  assert.equal(press(zeroByZero, "0,op:div,0,equals"), "Result is undefined");

  const unary = calculator();
  assert.equal(press(unary, "0,unary:reciprocal"), "Cannot divide by zero");
});

test("invalid input and overflow are shown", () => {
  const root = calculator();
  assert.equal(press(root, "9,unary:negate,unary:sqrt"), "Invalid input");

  const overflow = calculator();
  press(overflow, "9");
  for (let i = 0; i < 9; i++) press(overflow, "unary:square");
  assert.equal(overflow.display, "Overflow");
});

test("errors recover through C, CE, Backspace or a fresh digit", () => {
  const digit = calculator();
  press(digit, "6,op:div,0,equals");
  assert.equal(press(digit, "4"), "4");
  assert.equal(press(digit, "op:add,1,equals"), "5");

  const clearEntry = calculator();
  press(clearEntry, "6,op:div,0,equals");
  assert.equal(press(clearEntry, "clearEntry"), "0");

  const clear = calculator();
  press(clear, "6,op:div,0,equals");
  assert.equal(press(clear, "clear"), "0");

  const backspace = calculator();
  press(backspace, "6,op:div,0,equals");
  assert.equal(press(backspace, "backspace"), "0");

  // Operators and unary keys do nothing while an error is displayed.
  const others = calculator();
  const message = press(others, "6,op:div,0,equals");
  assert.equal(press(others, "unary:sqrt"), message);
  assert.equal(press(others, "op:add"), message);
  assert.equal(others.pendingOp, null);
});

test("history records completed calculations", () => {
  const calc = calculator();
  press(calc, "2,op:add,3,op:mul,4");
  assert.equal(calc.history.length, 0, "chained input is not history");

  press(calc, "equals");
  assert.equal(calc.history.length, 1);
  assert.equal(calc.history[0].expression, "5 \u00d7 4 =");
  assert.equal(calc.history[0].result, "20");

  press(calc, "equals");
  assert.equal(calc.history.length, 2);
  assert.equal(calc.history[1].expression, "20 \u00d7 4 =");
  assert.equal(calc.history[1].result, "80");

  const error = calculator();
  press(error, "1,op:div,0,equals");
  assert.equal(error.history.length, 0, "failed calculations are not history");

  calc.clearHistory();
  assert.equal(calc.history.length, 0);
});

test("memory: MS, M+, M-, MR, MC", () => {
  const calc = calculator();
  assert.equal(calc.hasMemory, false);
  assert.equal(press(calc, "5,memory:store"), "5");
  assert.equal(calc.hasMemory, true);

  press(calc, "clear,3,memory:add");
  assert.equal(calc.memory, 8);
  press(calc, "memory:subtract");
  assert.equal(calc.memory, 5);

  press(calc, "clear");
  assert.equal(press(calc, "memory:recall"), "5");

  press(calc, "memory:clear");
  assert.equal(calc.hasMemory, false);
  // MR with nothing stored leaves the display alone.
  assert.equal(press(calc, "clear,7,memory:recall"), "7");
});

test("the entry accepts at most 16 digits", () => {
  const calc = calculator();
  press(calc, "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1");
  assert.equal(calc.display, "1,111,111,111,111,111");
  assert.equal(press(calc, "1"), "1,111,111,111,111,111");

  const decimals = calculator();
  press(decimals, "0,point,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1");
  assert.equal(decimals.display, "0.1111111111111111");
});

test("entry typing replaces a leading zero and collapses repeated points", () => {
  const calc = calculator();
  assert.equal(press(calc, "0,5"), "5");
  assert.equal(press(calc, "clear,0,0"), "0");
  assert.equal(press(calc, "point,5"), "0.5");
  assert.equal(press(calc, "point,2"), "0.52", "a second decimal point is ignored");
  assert.equal(press(calc, "clear,point"), "0.");
});

test("typing after a result starts a new entry", () => {
  const calc = calculator();
  press(calc, "2,op:add,3,equals");
  assert.equal(press(calc, "7"), "7");
  assert.equal(press(calc, "equals"), "10");
});

test("the expression line shows the pending operation", () => {
  const calc = calculator();
  assert.equal(calc.expression, "");
  press(calc, "1,2,op:sub");
  assert.equal(calc.expression, "12 \u2212");
  press(calc, "3,equals");
  assert.equal(calc.expression, "");
});
