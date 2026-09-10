/* Programmer mode (AC-004): four live base readouts, base-restricted input,
 * word sizes with truncation, the bitwise family, the shift family and its
 * four modes, integer division and modulo conventions, errors, memory and
 * history, and the keypad data the shell renders.
 *
 * The expected values are the real project's own: CalculatorUnitTests/
 * CalculatorManagerTest.cpp (CalculatorManagerTestProgrammer) and
 * CalculatorUITests/ProgrammerModeFunctionalTests.cs, as reported by the
 * WO-3 research slice. Grouping is asserted in this project's form (a space
 * every N digits); the receipt records the difference from the UI tests'
 * per-digit spacing. */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, press } = require("./helper.js");

const app = loadApp();
const { programmer } = app.modes;
const { Calculator, ERRORS } = app.engine;

function prog() {
  const calc = new Calculator();
  calc.setMode("programmer");
  return calc;
}

/* The real app's default is DEC + QWORD + arithmetic shifts. */
function defaults() {
  const calc = prog();
  assert.equal(calc.base, "dec");
  assert.equal(calc.wordSize, "qword");
  assert.equal(calc.shiftMode, "arithmetic");
  assert.equal(calc.display, "0");
  return calc;
}

test("Programmer starts in DEC, QWORD, arithmetic shift", () => {
  defaults();
});

test("all four bases read the value live, and a row selects its base", () => {
  const calc = defaults();
  press(calc, "2,5,5");
  const readout = ["hex", "dec", "oct", "bin"].map((base) => calc.baseValue(base));
  assert.deepEqual(readout, ["FF", "255", "377", "1111 1111"]);

  press(calc, "base:hex");
  assert.equal(calc.display, "FF");
  assert.equal(calc.base, "hex");
  press(calc, "base:oct");
  assert.equal(calc.display, "377");
  press(calc, "base:bin");
  assert.equal(calc.display, "1111 1111");
  press(calc, "base:dec");
  assert.equal(calc.display, "255");

  // The readout keeps showing every base whichever one is active.
  const all = ["hex", "dec", "oct", "bin"].map((base) => calc.baseValue(base));
  assert.deepEqual(all, ["FF", "255", "377", "1111 1111"]);
});

test("digits group per radix, and the binary row is padded to a nibble", () => {
  const calc = defaults();
  press(calc, "1,2,3,4,5,6,7");
  assert.equal(calc.baseValue("dec"), "1,234,567");
  assert.equal(calc.baseValue("hex"), "12 D687");
  assert.equal(calc.baseValue("oct"), "4 553 207");
  // 0b100101101011010000111 -> padded to a whole nibble, then grouped by 4.
  assert.equal(calc.baseValue("bin"), "0001 0010 1101 0110 1000 0111");

  const zero = defaults();
  assert.equal(zero.baseValue("bin"), "0", "zero is not padded");
  assert.equal(zero.baseValue("dec"), "0");
});

test("negative values read signed in DEC and two's complement elsewhere", () => {
  const calc = defaults();
  press(calc, "5,unary:negate");
  assert.equal(calc.baseValue("dec"), "-5");
  assert.equal(calc.baseValue("hex"), "FFFF FFFF FFFF FFFB");
  assert.equal(calc.baseValue("oct"), "1 777 777 777 777 777 777 773");
  assert.equal(calc.baseValue("bin"),
    "1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1011");

  const wide = defaults();
  press(wide, "bit:63");
  assert.equal(wide.display, "-9,223,372,036,854,775,808");
  assert.equal(wide.baseValue("hex"), "8000 0000 0000 0000");

  const byte = defaults();
  press(byte, "word:cycle,word:cycle,word:cycle");
  assert.equal(byte.wordSize, "byte");
  press(byte, "1,unary:negate");
  assert.equal(byte.baseValue("dec"), "-1");
  assert.equal(byte.baseValue("hex"), "FF", "BYTE is two hex digits");
});

test("word size cycles QWORD to BYTE and truncates the value to the width", () => {
  const calc = defaults();
  press(calc, "base:hex,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f," +
    "digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f");
  assert.equal(calc.display, "FFFF FFFF FFFF FFFF");

  press(calc, "word:cycle");
  assert.equal(calc.wordSize, "dword");
  assert.equal(calc.display, "FFFF FFFF");
  press(calc, "word:cycle");
  assert.equal(calc.wordSize, "word");
  assert.equal(calc.display, "FFFF");
  press(calc, "word:cycle");
  assert.equal(calc.wordSize, "byte");
  assert.equal(calc.display, "FF");
  press(calc, "word:cycle");
  assert.equal(calc.wordSize, "qword", "the button cycles back round");

  // Truncation keeps the low bits and re-reads the sign.
  const truncate = defaults();
  press(truncate, "3,0,0,word:cycle,word:cycle,word:cycle");
  assert.equal(truncate.baseValue("byte"), "44");
  assert.equal(truncate.display, "44");

  const sign = defaults();
  press(sign, "2,5,5,word:cycle,word:cycle,word:cycle");
  assert.equal(sign.baseValue("hex"), "FF", "the pattern keeps its low byte");
  assert.equal(sign.display, "-1", "0xFF reads as -1 in a byte");
  assert.equal(sign.baseValue("hex"), "FF");
});

test("input is restricted to the active base, and A-F to HEX", () => {
  const calc = defaults();
  press(calc, "base:hex,digit:a,digit:f,digit:9,digit:c,digit:e");
  assert.equal(calc.display, "A F9CE");

  press(calc, "clear,base:dec,5,digit:a,digit:f,7");
  assert.equal(calc.display, "57", "DEC rejects the hex letters");

  press(calc, "clear,base:oct,7,7,8,9,1");
  assert.equal(calc.display, "771", "OCT rejects 8 and 9");

  press(calc, "clear,base:bin,1,0,1,2,3,7,8,9");
  assert.equal(calc.display, "0101", "BIN accepts only 0 and 1 (and pads to a nibble)");

  // The shell asks the same question when it dims the keys.
  press(calc, "clear,base:bin");
  assert.deepEqual(
    ["0", "1", "2", "9", "a", "f"].map((digit) => calc.acceptsDigit(digit)),
    [true, true, false, false, false, false]);
  press(calc, "base:oct");
  assert.deepEqual(
    ["0", "7", "8", "9", "a"].map((digit) => calc.acceptsDigit(digit)),
    [true, true, false, false, false]);
  press(calc, "base:hex");
  assert.deepEqual(
    ["0", "9", "a", "f"].map((digit) => calc.acceptsDigit(digit)),
    [true, true, true, true]);
  press(calc, "base:dec");
  assert.deepEqual(
    ["0", "9", "a", "f"].map((digit) => calc.acceptsDigit(digit)),
    [true, true, false, false]);
});

test("DEC input stops at the signed maximum for the width", () => {
  const calc = defaults();
  press(calc, "word:cycle,word:cycle,word:cycle"); // BYTE
  press(calc, "1,2,7");
  assert.equal(calc.display, "127");
  press(calc, "2");
  assert.equal(calc.display, "127", "a BYTE holds at most 127 in DEC input");

  // The limit for a negative entry is one more than for a positive one, so
  // -128 is reachable by negating first, and 128 alone is not.
  press(calc, "clear,1,2,unary:negate,8");
  assert.equal(calc.display, "-128", "the negative limit is reachable");
  assert.equal(calc.baseValue("hex"), "80");

  const wide = defaults();
  press(wide, "9,2,2,3,3,7,2,0,3,6,8,5,4,7,7,5,8,0,7");
  assert.equal(wide.display, "9,223,372,036,854,775,807");
  press(wide, "9");
  assert.equal(wide.display, "9,223,372,036,854,775,807", "the QWORD DEC limit holds");

  // HEX uses the whole pattern instead.
  const hex = defaults();
  press(hex, "base:hex,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f," +
    "digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f,digit:f");
  assert.equal(hex.display, "FFFF FFFF FFFF FFFF");
});

test("the bit panel toggles exactly one bit at the current width", () => {
  const calc = defaults();
  press(calc, "bit:0,bit:3");
  assert.equal(calc.display, "9");
  assert.equal(calc.bitValue(0), 1);
  assert.equal(calc.bitValue(3), 1);
  assert.equal(calc.bitValue(1), 0);

  press(calc, "bit:3");
  assert.equal(calc.display, "1", "toggling the same bit turns it off");

  press(calc, "bit:63");
  assert.equal(calc.display, "-9,223,372,036,854,775,807", "bit 0 is still set");

  // A bit outside the selected width does nothing.
  press(calc, "word:cycle,word:cycle,word:cycle"); // BYTE
  const before = calc.value;
  press(calc, "bit:9,bit:63");
  assert.equal(calc.value, before, "bits above the width are inert");
  assert.equal(calc.wordWidth(), 8);
});

test("integer arithmetic: + - x / with truncation, modulo and +/-", () => {
  const calc = defaults();
  assert.equal(press(calc, "1,2,op:add,3,0,equals"), "42");
  assert.equal(press(calc, "clear,5,0,op:sub,8,equals"), "42");
  assert.equal(press(calc, "clear,6,op:mul,7,equals"), "42");
  assert.equal(press(calc, "clear,8,4,op:div,2,equals"), "42");
  assert.equal(press(calc, "clear,1,0,op:mod,3,equals"), "1");
  assert.equal(press(calc, "clear,5,unary:negate"), "-5");

  // Division truncates toward zero; modulo takes the sign of the dividend.
  const divided = defaults();
  assert.equal(press(divided, "7,op:div,2,equals"), "3");
  assert.equal(press(divided, "clear,7,unary:negate,op:div,2,equals"), "-3");
  assert.equal(press(divided, "clear,7,op:div,2,unary:negate,equals"), "-3");
  assert.equal(press(divided, "clear,1,op:div,3,equals"), "0", "there is no fractional part");

  const modulo = defaults();
  assert.equal(press(modulo, "7,op:mod,2,equals"), "1");
  assert.equal(press(modulo, "clear,7,unary:negate,op:mod,2,equals"), "-1");
  assert.equal(press(modulo, "clear,7,op:mod,2,unary:negate,equals"), "1");

  // The real project's own division vectors.
  assert.equal(press(calc, "clear,4,2,9,4,9,6,7,2,9,6,op:div,2,5,5,equals"), "16,843,009");
  assert.equal(press(calc, "clear,4,2,9,4,9,6,7,3,0,3,op:div,2,5,5,equals"), "16,843,009");
  assert.equal(press(calc, "clear,1,0,0,0,0,0,0,0,0,0,op:div,6,4,4,8,7,equals"), "15,507");
  assert.equal(press(calc, "clear,1,0,0,0,0,0,0,0,0,0,op:div,6,4,4,8,8,equals"), "15,506");
});

test("results truncate to the selected width as they are computed", () => {
  const byte = defaults();
  press(byte, "word:cycle,word:cycle,word:cycle"); // BYTE
  press(byte, "base:hex,digit:c,digit:8,base:dec"); // 200 in hex
  assert.equal(byte.display, "-56", "0xC8 reads as -56 in a byte");
  assert.equal(press(byte, "op:mul,2,equals"), "-112", "200 x 2 in a byte");
  assert.equal(byte.baseValue("hex"), "90");

  const word = defaults();
  press(word, "word:cycle,word:cycle"); // WORD
  assert.equal(press(word, "1,0,0,0,op:mul,1,0,0,0,equals"), "16,960");
  assert.equal(word.baseValue("hex"), "4240");

  const qword = defaults();
  assert.equal(press(qword, "9,2,2,3,3,7,2,0,3,6,8,5,4,7,7,5,8,0,7,op:mul,2,equals"),
    "-2", "QWORD wraps round, as the pattern does");
});

test("bitwise AND, OR, XOR, NOT, NAND and NOR", () => {
  const calc = defaults();
  assert.equal(press(calc, "2,5,op:and,7,equals"), "1");
  assert.equal(press(calc, "clear,2,5,op:or,7,equals"), "31");
  assert.equal(press(calc, "clear,2,5,op:xor,7,equals"), "30");
  assert.equal(press(calc, "clear,2,5,unary:not"), "-26");
  assert.equal(press(calc, "clear,2,5,op:nand,7,equals"), "-2");
  assert.equal(press(calc, "clear,2,5,op:nor,7,equals"), "-32");

  // The same in the other bases, from the real project's UI tests.
  const oct = defaults();
  press(oct, "base:oct");
  assert.equal(press(oct, "1,6,op:and,7,equals"), "6");
  assert.equal(press(oct, "clear,1,6,op:or,7,equals"), "17");
  assert.equal(press(oct, "clear,1,6,op:xor,7,equals"), "11");
  assert.equal(press(oct, "clear,1,6,unary:not"), "1 777 777 777 777 777 777 761");

  const hex = defaults();
  press(hex, "base:hex");
  assert.equal(press(hex, "digit:a,digit:b,digit:c,op:and,digit:f,equals"), "C");
  assert.equal(press(hex, "clear,digit:a,digit:b,digit:c,op:or,digit:f,equals"), "ABF");
  assert.equal(press(hex, "clear,digit:a,digit:b,digit:c,op:xor,digit:f,equals"), "AB3");
  assert.equal(press(hex, "clear,digit:a,digit:b,digit:c,unary:not"), "FFFF FFFF FFFF F543");

  const bin = defaults();
  press(bin, "base:bin");
  assert.equal(press(bin, "1,0,1,0,op:and,1,0,0,0,equals"), "1000");
  assert.equal(press(bin, "clear,1,0,1,0,op:or,1,1,0,0,equals"), "1110");
  assert.equal(press(bin, "clear,1,0,1,0,op:xor,1,1,0,0,equals"), "0110");
});

test("the operators follow the real engine's precedence", () => {
  // Bitwise binds loosest, then +/-, then the shifts, Mod, x and /.
  const calc = defaults();
  assert.equal(press(calc, "5,3,op:nand,8,3,op:and"), "-18");
  assert.equal(calc.expression, "53 NAND 83 AND ", "a lower-precedence key resolves the pending one");
  assert.equal(press(calc, "clear,5,3,op:nor,8,3,op:and"), "-120");
  assert.equal(press(calc, "clear,5,op:lsh,1,op:and"), "10");
  assert.equal(press(calc, "clear,5,op:add,2,op:mul,3,equals"), "11", "x binds tighter than +");
  assert.equal(press(calc, "clear,1,op:add,2,op:and,3,equals"), "3", "(1 + 2) AND 3");
});

test("a shift by the whole word width is 'Result not defined'", () => {
  const calc = defaults();
  assert.equal(press(calc, "1,op:lsh,6,4,equals"), ERRORS.resultNotDefined);
  assert.equal(press(calc, "clear,1,op:rsh,6,4,equals"), ERRORS.resultNotDefined);

  // The count is the operator's second operand, so it is per-width.
  const byte = defaults();
  press(byte, "word:cycle,word:cycle,word:cycle");
  assert.equal(press(byte, "1,op:lsh,7,equals"), "-128", "0x80 reads as -128 in a byte");
  assert.equal(byte.baseValue("hex"), "80");
  assert.equal(press(byte, "clear,1,op:lsh,8,equals"), ERRORS.resultNotDefined);
  assert.equal(press(byte, "clear,1,op:rsh,6,4,equals"), ERRORS.resultNotDefined);
});

test("Lsh and Rsh under Arithmetic and Logical shift", () => {
  const arithmetic = defaults();
  assert.equal(press(arithmetic, "5,op:lsh,1,equals"), "10");
  assert.equal(press(arithmetic, "clear,2,5,unary:negate,op:rsh,1,equals"), "-13", "the sign bit fills");
  assert.equal(press(arithmetic, "clear,2,5,op:rsh,2,equals"), "6");
  assert.equal(press(arithmetic, "clear,1,op:lsh,6,3,equals"), "-9,223,372,036,854,775,808");

  const logical = defaults();
  press(logical, "shift:logical");
  assert.equal(press(logical, "1,6,unary:negate,op:rsh,1,equals"), "9,223,372,036,854,775,800",
    "logical fills with zeros");
  assert.equal(logical.expression, "-16 RshL 1=", "the key reads RshL in logical mode");
  assert.equal(press(logical, "clear,5,op:lsh,1,equals"), "10", "Lsh is unchanged");
  assert.equal(press(logical, "clear,1,op:lsh,6,4,equals"), ERRORS.resultNotDefined);

  const hex = defaults();
  press(hex, "base:hex,shift:logical");
  assert.equal(press(hex, "digit:f,unary:negate,op:rsh,1,equals"), "7FFF FFFF FFFF FFF8");
});

test("Rotate circular turns one bit, and the carry rotates thread the carry", () => {
  const circular = defaults();
  press(circular, "shift:rotate");
  assert.equal(press(circular, "1,unary:rol"), "2");
  assert.equal(circular.expression, "RoL(1)");
  assert.equal(press(circular, "clear,7,unary:rol"), "14");
  assert.equal(press(circular, "clear,1,unary:ror"), "-9,223,372,036,854,775,808",
    "the low bit comes back round to the top");
  assert.equal(press(circular, "clear,7,unary:ror"), "-9,223,372,036,854,775,805");
  assert.equal(press(circular, "clear,1,unary:rol,unary:rol"), "4", "the rotations stack");

  const oct = defaults();
  press(oct, "base:oct,shift:rotate");
  assert.equal(press(oct, "2,5,unary:rol"), "52");
  assert.equal(press(oct, "clear,2,5,unary:ror"), "1 000 000 000 000 000 000 012");

  const carry = defaults();
  press(carry, "shift:rotateCarry");
  assert.equal(carry.carry, 0);
  assert.equal(press(carry, "1,unary:rorc"), "0", "the zero carry fills the top bit");
  assert.equal(carry.carry, 1, "the bit shifted out becomes the carry");
  assert.equal(press(carry, "unary:rorc"), "-9,223,372,036,854,775,808");
  assert.equal(carry.expression, "RoR(RoR(1))", "the carry pair renders as RoR");
  assert.equal(press(carry, "clear"), "0");
  assert.equal(carry.carry, 0, "C clears the carry bit");
  assert.equal(press(carry, "clear,7,unary:negate,unary:rolc"), "-14");
  assert.equal(press(carry, "clear,1,7,unary:rorc"), "8");

  const hex = defaults();
  press(hex, "base:hex,shift:rotateCarry");
  assert.equal(press(hex, "1,0,1,0,unary:rolc"), "2020");
  assert.equal(press(hex, "clear,1,0,1,0,unary:rorc"), "808");
});

test("errors: divide and modulo by zero, and their recovery", () => {
  const calc = defaults();
  assert.equal(press(calc, "7,op:div,0,equals"), ERRORS.divideByZero);
  assert.equal(press(calc, "clear,0,op:div,0,equals"), ERRORS.undefined);
  assert.equal(press(calc, "clear,7,op:mod,0,equals"), ERRORS.undefined, "Mod 0 is undefined");
  assert.equal(press(calc, "clear,0,op:mod,0,equals"), ERRORS.undefined);

  // C recovers; a digit starts fresh.
  assert.equal(press(calc, "clear"), "0");
  assert.equal(press(calc, "4,op:add,1,equals"), "5");

  const digit = defaults();
  press(digit, "7,op:div,0,equals");
  assert.equal(press(digit, "9"), "9");

  const error = defaults();
  const message = press(error, "1,op:lsh,6,4,equals");
  assert.equal(message, ERRORS.resultNotDefined);
  assert.equal(press(error, "op:add"), message, "operators are inert in an error");
  assert.equal(press(error, "unary:not"), message);
  assert.equal(press(error, "clearEntry"), "0");
});

test("= repeats the last operation, and an operator pressed twice is replaced", () => {
  const calc = defaults();
  assert.equal(press(calc, "2,op:add,3,equals"), "5");
  assert.equal(press(calc, "equals"), "8");
  assert.equal(press(calc, "equals"), "11");
  assert.equal(press(calc, "1,0,equals"), "13");

  const replaced = defaults();
  assert.equal(press(replaced, "5,op:add,op:mul,3,equals"), "15");
  assert.equal(press(replaced, "clear,5,op:add,op:sub,3,equals"), "2");

  const dangling = defaults();
  assert.equal(press(dangling, "5,op:div,equals"), "1", "= uses the displayed value");
  assert.equal(press(dangling, "clear,2,op:add,equals"), "4");

  // An operator after "=" continues from the result.
  assert.equal(press(calc, "clear,6,op:mul,7,equals,op:add,1,equals"), "43");
});

test("CE clears the entry, C clears the expression, Backspace edits", () => {
  const calc = defaults();
  press(calc, "1,2,op:add,5");
  assert.equal(press(calc, "clearEntry"), "0");
  assert.equal(calc.expression, "12 + ", "the expression survives CE");
  assert.equal(press(calc, "6,equals"), "18");

  press(calc, "clear,1,2,3,backspace");
  assert.equal(calc.display, "12");
  assert.equal(press(calc, "backspace,backspace,backspace"), "0");

  press(calc, "clear,digit:a");
  assert.equal(calc.display, "0", "A is not a DEC digit at all");

  press(calc, "clear,base:hex,digit:a,digit:b,backspace");
  assert.equal(calc.display, "A");
  assert.equal(press(calc, "backspace"), "0");

  const result = defaults();
  press(result, "2,op:add,3,equals");
  assert.equal(press(result, "backspace"), "5", "results are not editable");

  const typed = defaults();
  press(typed, "5,unary:negate,3");
  assert.equal(typed.display, "-53", "+/- edits the entry");
  assert.equal(press(typed, "unary:negate"), "53");
});

test("memory and history work in Programmer", () => {
  const calc = defaults();
  assert.equal(calc.hasMemory, false);
  assert.equal(press(calc, "1,0,0,memory:store"), "100");
  assert.equal(calc.hasMemory, true);
  press(calc, "clear,5,memory:add");
  assert.equal(calc.display, "5", "M+ leaves the display alone");
  assert.equal(String(calc.memory), "105");
  press(calc, "clear,memory:recall");
  assert.equal(calc.display, "105");
  press(calc, "op:add,1,equals");
  assert.equal(calc.display, "106");

  press(calc, "memory:clear");
  assert.equal(calc.hasMemory, false);
  assert.equal(press(calc, "clear,9,memory:recall"), "9", "MR is inert with nothing stored");

  const history = defaults();
  press(history, "1,0,0,op:add,2,0,0,equals");
  assert.equal(history.history.length, 1);
  assert.equal(history.history[0].expression, "100 + 200=");
  assert.equal(history.history[0].result, "300");

  press(history, "equals");
  assert.equal(history.history.length, 2);

  const failed = defaults();
  press(failed, "1,op:div,0,equals");
  assert.equal(failed.history.length, 0, "a failed calculation is not history");

  const grouped = defaults();
  press(grouped, "1,0,0,0,op:mul,1,0,0,0,equals");
  assert.equal(grouped.history[0].result, "1,000,000");
  assert.equal(grouped.history[0].value, "1000000", "the exact value is kept for recall");

  // A history value recalled into Programmer stays exact.
  grouped.setValue(grouped.history[0].value);
  assert.equal(grouped.display, "1,000,000");
});

test("a history value round-trips whatever base recorded it", () => {
  // The recorded value must not depend on the base that happened to be
  // active: recall parses it as an integer, not as base-specific text.
  const cases = [
    { base: "hex", keys: "digit:f,digit:f,op:add,digit:1,equals", value: "256", display: "100" },
    { base: "dec", keys: "5,op:add,1,equals", value: "6", display: "6" },
    { base: "oct", keys: "7,op:add,1,equals", value: "8", display: "10" },
    { base: "bin", keys: "1,0,1,0,op:add,1,equals", value: "11", display: "1011" }
  ];
  for (const item of cases) {
    const calc = prog();
    press(calc, "base:" + item.base);
    press(calc, item.keys);
    assert.equal(calc.history.length, 1, item.base + " recorded one entry");
    assert.equal(calc.history[0].value, item.value,
      item.base + " stores the value, not the base's own text");

    // Recall with that base still active: the display comes straight back.
    calc.setValue(calc.history[0].value);
    assert.equal(calc.display, item.display, item.base + " recall");
  }

  // The same value recalled in a different base is the same number.
  const cross = prog();
  press(cross, "base:hex,digit:f,digit:f,op:add,digit:1,equals");
  cross.setValue(cross.history[0].value);
  cross.press("base:bin");
  assert.equal(cross.display, "0001 0000 0000", "256 read in binary");
  cross.press("base:dec");
  assert.equal(cross.display, "256");
});

test("a lettered or negative result recalls instead of throwing", () => {
  // "F" used to reach the integer parser as text and throw inside the click
  // path, so the history row did nothing.
  const letters = prog();
  press(letters, "base:hex,digit:f,op:and,digit:f,equals");
  assert.equal(letters.display, "F");
  assert.equal(letters.history[0].value, "15");
  letters.setValue(letters.history[0].value);
  assert.equal(letters.display, "F");

  const spelled = prog();
  press(spelled, "base:hex,digit:a,digit:b,digit:c,op:xor,digit:f,equals");
  assert.equal(spelled.display, "AB3");
  spelled.setValue(spelled.history[0].value);
  assert.equal(spelled.display, "AB3");

  const negative = prog();
  press(negative, "5,op:sub,9,equals");
  assert.equal(negative.display, "-4");
  assert.equal(negative.history[0].value, "-4");
  negative.setValue(negative.history[0].value);
  assert.equal(negative.display, "-4");

  // A QWORD value keeps every digit of its decimal text.
  const wide = prog();
  press(wide, "1,op:lsh,6,3,equals");
  assert.equal(wide.display, "-9,223,372,036,854,775,808");
  assert.equal(wide.history[0].value, "-9223372036854775808");
  wide.setValue(wide.history[0].value);
  assert.equal(wide.display, "-9,223,372,036,854,775,808");
  assert.equal(wide.baseValue("hex"), "8000 0000 0000 0000", "the bit pattern survives recall");
});

test("a repeated = records a history value that recalls", () => {
  const calc = prog();
  press(calc, "base:hex,digit:a,op:add,digit:1,equals");
  assert.equal(calc.display, "B");
  assert.equal(calc.history.length, 1);
  assert.equal(calc.history[0].value, "11");

  press(calc, "equals");
  assert.equal(calc.display, "C");
  assert.equal(calc.history.length, 2, "a repeated = records history");
  assert.equal(calc.history[1].value, "12");
  calc.setValue(calc.history[1].value);
  assert.equal(calc.display, "C");
});

test("a history value recorded by another mode lands exactly", () => {
  // History is shared with the other modes, so recall must cope with a
  // fractional or exponent-form value as well as a whole number.
  const standard = new Calculator();
  press(standard, "1,op:div,2,equals");
  assert.equal(standard.display, "0.5");

  const calc = prog();
  calc.setValue(standard.history[0].value);
  assert.equal(calc.display, "0", "integer mode takes the truncation");
  assert.equal(calc.value, 0n);

  const scientific = new Calculator();
  scientific.setMode("scientific");
  press(scientific, "1,op:div,1,0,0,0,0,equals");
  calc.setValue(scientific.history[0].value);
  assert.equal(calc.display, "0");

  // Standard and Scientific recall is untouched.
  standard.setValue(standard.history[0].value);
  assert.equal(standard.display, "0.5");
  scientific.setValue(scientific.history[0].value);
  assert.equal(scientific.display, "0.0001");
});

test("a Standard exponent-form result recalls into Programmer", () => {
  // 100,000,000,000 x 100,000,000,000 = 1e22, whose recorded value is a
  // Number and whose text is therefore exponent form: "1e+22".
  const standard = new Calculator();
  press(standard, "1" + ",0".repeat(11) + ",op:mul,1" + ",0".repeat(11) + ",equals");
  assert.equal(standard.display, "1.e+22");
  assert.equal(standard.history.length, 1);
  assert.equal(String(standard.history[0].value), "1e+22", "the recorded text is exponent form");

  // The history click hands the entry's value text to the engine.
  const calc = prog();
  calc.setValue(String(standard.history[0].value));
  assert.equal(calc.value, 1864712049423024128n, "the exponent expands exactly, then bounds to QWORD");
  assert.equal(calc.display, "1,864,712,049,423,024,128");
  assert.equal(calc.baseValue("hex"), "19E0 C9BA B240 0000");

  // A negative exponent-form value expands the same way and keeps the
  // two's-complement pattern the mode stores.
  const negative = prog();
  negative.setValue("-1e+22");
  assert.equal(negative.value, 16582032024286527488n, "the QWORD pattern of -1e22");
  assert.equal(negative.display, "-1,864,712,049,423,024,128");
  assert.equal(negative.baseValue("hex"), "E61F 3645 4DC0 0000");

  // A small exponent form is a fraction and truncates to zero.
  const small = prog();
  small.setValue("1e-7");
  assert.equal(small.value, 0n);
  assert.equal(small.display, "0");
});

test("recall never leaves the display and the engine disagreeing", () => {
  // Every shape here is text the app itself can put in a history entry, or
  // the display text of one: after recall the display must be a faithful
  // rendering of the engine's value, and the next operation must continue
  // from what is shown. Before the exponent fix these threw after the engine
  // had already been cleared, leaving the screen stale against a zero engine.
  const shapes = [
    "1e+22", "-1e+22", "1e+21", "100000000000000000000",
    "1.7976931348623157e+308", "0.5", "-0.5", "1e-7", "abc", ""
  ];
  for (const text of shapes) {
    const calc = prog();
    calc.setValue(text); // must not throw, whatever the text
    const before = BigInt(calc.display.replace(/,/g, ""));

    calc.press("op:add");
    calc.press("digit:1");
    calc.press("equals");
    const after = BigInt(calc.display.replace(/,/g, ""));
    assert.equal(after, before + 1n, JSON.stringify(text) + ": +1= continues from the display");
  }

  // The recalled display is the value's own rendering, not a stale one.
  const calc = prog();
  calc.setValue("1e+22");
  assert.equal(calc.value, 1864712049423024128n);
  assert.equal(calc.display, "1,864,712,049,423,024,128");
  assert.equal(calc.baseValue("oct"), "147 406 233 526 220 000 000");
  calc.press("clear");
  assert.equal(calc.display, "0");
});

test("history text the app cannot record still recalls to a defined value", () => {
  // The app records only finite results, so these cannot arrive from a
  // history row; a malformed value must still not throw.
  for (const text of ["Infinity", "-Infinity", "NaN", "null", " ", "1,000"]) {
    const calc = prog();
    calc.setValue(text);
    assert.equal(calc.display, "0", JSON.stringify(text));
    assert.equal(calc.value, 0n);
  }

  // A value that exceeds the widest word keeps the low bits of the pattern;
  // it never vanishes or throws. [INFERENCE] - see the receipt: the engine
  // masks on every display update and memory recall truncates, while the real
  // app's paste path reports "Invalid input" for an out-of-range value.
  const byte = prog();
  press(byte, "word:cycle,word:cycle,word:cycle");
  byte.setValue("1e+22");
  assert.equal(byte.value, 0n, "the low bits of 1e22 are zero");
  byte.press("word:cycle");
  assert.equal(byte.wordSize, "qword");

  const dword = prog();
  press(dword, "word:cycle");
  dword.setValue("1e+22");
  assert.equal(dword.value, 2990538752n, "0xB2400000 as an unsigned DWORD pattern");
  assert.equal(dword.display, "-1,304,428,544", "read signed in DEC");
  assert.equal(dword.baseValue("hex"), "B240 0000");

  const decimal = prog();
  decimal.setValue("12345678901234567890");
  assert.equal(decimal.display, "-6,101,065,172,474,983,726", "the high bit reads as the sign");
  assert.equal(decimal.baseValue("hex"), "AB54 A98C EB1F 0AD2");
  press(decimal, "word:cycle,word:cycle,word:cycle");
  assert.equal(decimal.wordSize, "byte");
  assert.equal(decimal.baseValue("hex"), "D2", "BYTE keeps the low bits");
  assert.equal(decimal.display, "-46", "and reads them signed in DEC");
});

test("switching modes leaves Standard and Scientific untouched", () => {
  const calc = new Calculator();
  assert.equal(press(calc, "1,op:add,2,op:mul,3,equals"), "9", "Standard stays left to right");

  calc.setMode("scientific");
  assert.equal(press(calc, "clear,1,op:add,2,op:mul,3,equals"), "7", "Scientific keeps precedence");

  calc.setMode("programmer");
  assert.equal(calc.base, "dec", "entering Programmer resets the base");
  assert.equal(calc.wordSize, "qword");
  assert.equal(calc.display, "0");
  assert.equal(calc.memory === 0 || calc.memory === 0n, true, "memory is empty");

  calc.press("digit:5");
  calc.press("memory:store");
  calc.press("base:hex");
  calc.press("word:cycle");
  calc.setMode("standard");
  assert.equal(calc.mode, "standard");
  assert.equal(calc.display, "5", "the value carries back as a number");
  assert.equal(press(calc, "clear,1,op:add,2,op:mul,3,equals"), "9");
  assert.equal(calc.base, "hex", "the base selection survives leaving the mode");
  assert.equal(calc.wordSize, "dword");

  calc.setMode("programmer");
  assert.equal(calc.display, "0");
  assert.equal(String(calc.memory), "5", "memory survives the switch");
});

test("the Programmer keypad is the real app's key set", () => {
  const keys = programmer.keypad.flat();
  assert.equal(programmer.columns, 5);
  assert.equal(programmer.keypad.length, 7);
  for (const row of programmer.keypad) assert.equal(row.length, 5);

  const labels = programmer.keypad.map((row) => row.map((key) => key.label));
  assert.deepEqual(labels[0], ["Lsh", "Rsh", "\u232b", "CE", "C"]);
  assert.deepEqual(labels[1].slice(1, 4), ["7", "8", "9"]);
  assert.deepEqual(labels.map((row) => row[0]), ["Lsh", "A", "B", "C", "D", "E", "F"]);
  assert.deepEqual(labels.map((row) => row[4]).slice(1), ["\u00f7", "\u00d7", "\u2212", "+", "=", "%"]);

  const hexLetters = keys.filter((key) => /^digit:[a-f]$/.test(key.action));
  assert.deepEqual(hexLetters.map((key) => key.label), ["A", "B", "C", "D", "E", "F"]);
  for (const digit of "0123456789") {
    assert.ok(keys.some((key) => key.action === "digit:" + digit), "digit " + digit + " is missing");
  }

  // Every AC-004 family is on the keypad.
  const actions = keys.map((key) => key.action);
  for (const family of [
    "base:hex", "base:dec", "base:oct", "base:bin",
    "op:and", "op:or", "op:xor", "unary:not", "op:nand", "op:nor",
    "op:lsh", "op:rsh",
    "op:add", "op:sub", "op:mul", "op:div", "op:mod", "unary:negate",
    "equals", "clear", "clearEntry", "backspace", "point"
  ]) {
    const from = family === "base:hex" ? "base" : family;
    if (family.indexOf("base:") === 0) continue; // the base rows are the readout, not the keypad
    assert.ok(actions.includes(from), family + " is missing from the Programmer keypad");
  }
  assert.equal(new Set(actions).size, actions.length, "duplicate action in the keypad");
  for (const action of actions) {
    assert.ok(Calculator.isAction(action), action + " is not an engine action");
  }
  assert.ok(keys.some((key) => key.action === "word:cycle") === false,
    "the word size lives in the display panel, not the keypad");
});

test("the shift keys carry the four modes' labels and actions", () => {
  const keys = programmer.keypad.flat();
  const left = keys.find((key) => key.action === "op:lsh");
  const right = keys.find((key) => key.action === "op:rsh");
  assert.ok(left && right, "the shift keys are missing");

  assert.deepEqual(Object.keys(left.variants).sort(),
    ["arithmetic", "logical", "rotate", "rotateCarry"]);
  assert.deepEqual(
    ["arithmetic", "logical", "rotate", "rotateCarry"].map((mode) => left.variants[mode].label),
    ["Lsh", "Lsh", "RoL", "RoLc"]);
  assert.deepEqual(
    ["arithmetic", "logical", "rotate", "rotateCarry"].map((mode) => right.variants[mode].label),
    ["Rsh", "RshL", "RoR", "RoRc"]);
  assert.deepEqual(
    ["arithmetic", "logical", "rotate", "rotateCarry"].map((mode) => right.variants[mode].action),
    ["op:rsh", "op:rsh", "unary:ror", "unary:rorc"]);
  for (const variant of [left.variants, right.variants]) {
    for (const mode of Object.keys(variant)) {
      assert.ok(Calculator.isAction(variant[mode].action), mode + "'s shift action is invalid");
    }
  }

  // The selector offers the real app's four modes, arithmetic first.
  assert.deepEqual(programmer.shifts.map((shift) => shift.id),
    ["arithmetic", "logical", "rotate", "rotateCarry"]);
  assert.equal(programmer.shifts[0].label, "Arithmetic");

  // The base readout lists all four bases, with DEC first as the default.
  assert.deepEqual(programmer.bases.map((base) => base.id), ["hex", "dec", "oct", "bin"]);
  assert.deepEqual(programmer.words.map((word) => word.label), ["QWORD", "DWORD", "WORD", "BYTE"]);
});

test("the keyboard map drives Programmer, digits gated by the base", () => {
  const calc = defaults();
  for (const key of ["1", "2", "3", "+", "4", "5", "Enter"]) {
    calc.press(programmer.resolveKey({ key }));
  }
  assert.equal(calc.display, "168");

  calc.press(programmer.resolveKey({ key: "Escape" }));
  assert.equal(calc.display, "0");

  // The hex letters reach the engine and the inactive ones are refused.
  for (const key of ["a", "f", "9"]) calc.press(programmer.resolveKey({ key }));
  assert.equal(calc.display, "9", "DEC refuses the letters");

  calc.press(programmer.resolveKey({ key: "Escape" }));
  calc.press(programmer.resolveKey({ key: "F5" }));
  for (const key of ["a", "f", "9"]) calc.press(programmer.resolveKey({ key }));
  assert.equal(calc.display, "AF9");
  assert.equal(calc.base, "hex");

  assert.equal(programmer.resolveKey({ key: "F6" }), "base:dec");
  assert.equal(programmer.resolveKey({ key: "Enter" }), "equals");
  assert.equal(programmer.resolveKey({ key: "^" }), "op:xor");
  assert.equal(programmer.resolveKey({ key: "%" }), "op:mod");
  assert.equal(programmer.resolveKey({ key: "F9" }), "unary:negate");
  assert.equal(programmer.resolveKey({ key: "l", ctrlKey: true }), "memory:clear");
  for (const event of [{ key: "F1" }, { key: "z" }, { key: " " }, { key: "7", altKey: true }, { key: "7", metaKey: true }, {}]) {
    assert.equal(programmer.resolveKey(event), null, JSON.stringify(event));
  }
  for (const action of Object.values(programmer.keymap)) {
    assert.ok(Calculator.isAction(action), action + " is not an engine action");
  }
});
