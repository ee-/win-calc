/*
 * Shared calculator engine: the pending-operation state machine used by every
 * mode, plus the arithmetic and error semantics of Windows Calculator.
 *
 * Semantics (Standard mode, matching the real application):
 *   - strictly left to right, no operator precedence
 *   - "=" repeats the last operation with the last operand
 *   - pressing an operator twice replaces the pending operator
 *   - C clears everything but memory and history, CE clears the current entry
 *     only (the pending operation survives), Backspace edits the entry and is
 *     inert once the display holds a computed result
 *   - unary +/- % 1/x x^2 sqrt; % is relative to the pending + or - operand
 *   - errors display "Cannot divide by zero" / "Result is undefined" /
 *     "Invalid input" / "Overflow"; C, CE, Backspace or a digit recover
 *
 * No DOM access: the UI layer drives this through press(action).
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});
  // index.html loads format.js first; in Node a bare require of engine.js
  // pulls it in so the module is usable on its own.
  if (!NS.format && typeof require === "function") NS.format = require("./format.js");
  var format = NS.format;

  var OPERATORS = {
    add: { symbol: "+", apply: function (a, b) { return a + b; } },
    sub: { symbol: "\u2212", apply: function (a, b) { return a - b; } },
    mul: { symbol: "\u00d7", apply: function (a, b) { return a * b; } },
    div: { symbol: "\u00f7", apply: function (a, b) { return a / b; } },
    // Scientific-only operators. Standard's keypad never names them, but the
    // keys carry the same shape so both modes share the expression rendering.
    mod: { symbol: "mod", apply: function (a, b) { return a % b; } },
    pow: { symbol: "^", apply: function (a, b) { return Math.pow(a, b); } },
    root: { symbol: "\u02b8\u221a", apply: function (a, b) { return Math.pow(a, 1 / b); } },
    logy: { symbol: "log\u1d67", apply: function (a, b) { return Math.log(a) / Math.log(b); } }
  };

  var ERRORS = {
    divideByZero: "Cannot divide by zero",
    undefined: "Result is undefined",
    invalidInput: "Invalid input",
    overflow: "Overflow",
    // Programmer: a shift by the whole word width (CALC_E_NORESULT).
    resultNotDefined: "Result not defined"
  };

  function Calculator() {
    // ponytail: one memory value, which is all MC/MR/M+/M-/MS need. The real
    // app keeps a list of stored values behind the memory dropdown; that needs
    // its own work order (engine array + memory-row dropdown UI).
    this.memory = 0;
    this.hasMemory = false;
    this.history = [];
    this.mode = "standard"; // "standard" | "scientific" | "programmer" - see setMode
    this.second = false;    // Scientific's 2nd toggle (inverse labels)
    this.base = "dec";      // Programmer's active base: hex | dec | oct | bin
    this.wordSize = "qword"; // Programmer's width: qword | dword | word | byte
    this.shiftMode = "arithmetic"; // Programmer's Lsh/Rsh behaviour
    this.reset();
  }

  /* Switch evaluation machinery. Memory and history survive the switch, as
   * they do in the real app. Scientific keeps the displayed value; entering
   * Programmer resets the base, the word size and the display, which is what
   * the real app's SetProgrammerMode does (DEC + Clear, QWORD). */
  Calculator.prototype.setMode = function (mode) {
    var next = mode === "scientific" ? "scientific"
      : mode === "programmer" ? "programmer"
      : "standard";
    if (next === this.mode) return;
    var value = this.currentValue();
    this.mode = next;
    this.second = false;
    if (next === "programmer") {
      this.base = "dec";
      this.wordSize = "qword";
      this.shiftMode = "arithmetic";
      this.reset();
      return;
    }
    this.reset();
    this.value = typeof value === "bigint" ? Number(value) : value;
  };

  /* C: the whole pending operation goes, memory and history stay. */
  Calculator.prototype.reset = function () {
    this.entry = null;        // in-progress typed text, or null when the value is computed
    this.value = 0;           // value shown when entry is null
    this.accumulator = 0;     // left operand of the pending operation
    this.pendingOp = null;    // "add" | "sub" | "mul" | "div" | null
    this.operandReady = false; // true once the pending op has an operand to consume
    this.lastOp = null;       // for repeated "="
    this.lastOperand = null;
    this.error = null;
    if (this.mode === "scientific") sciReset(this);
    else if (this.mode === "programmer") progReset(this);
  };

  Object.defineProperty(Calculator.prototype, "display", {
    get: function () {
      if (this.error) return this.error;
      if (this.mode === "programmer") return progDisplay(this, this.base, this.value);
      if (this.entry !== null) {
        return this.mode === "scientific" ? sciEntryText(this.entry) : format.formatEntry(this.entry);
      }
      return format.formatNumber(this.value);
    }
  });

  /* The pending operation, as the line above the display shows it. */
  Object.defineProperty(Calculator.prototype, "expression", {
    get: function () {
      if (this.error) return "";
      if (this.mode === "scientific") return sciExpression(this);
      if (this.mode === "programmer") return progExpression(this);
      if (this.pendingOp === null) return "";
      return format.formatNumber(this.accumulator) + " " + OPERATORS[this.pendingOp].symbol;
    }
  });

  Calculator.prototype.currentValue = function () {
    if (this.mode === "programmer") return this.value;
    return this.entry === null ? this.value : parseFloat(this.entry);
  };

  /* Accept a computed value, or raise Overflow when it left the double range. */
  Calculator.prototype.setResult = function (result) {
    if (!isFinite(result)) {
      this.fail(ERRORS.overflow);
      return;
    }
    this.value = result;
    this.entry = null;
    this.operandReady = true;
  };

  Calculator.prototype.fail = function (message) {
    this.error = message;
    this.entry = null;
    this.pendingOp = null;
    this.operandReady = false;
    this.lastOp = null;
  };

  Calculator.prototype.inputDigit = function (digit) {
    var negative = false;
    var body;
    if (this.entry === null) {
      body = "";
    } else {
      negative = this.entry.charAt(0) === "-";
      body = negative ? this.entry.slice(1) : this.entry;
    }
    if (format.digitCount(body) >= format.MAX_INPUT_DIGITS) return;
    body = body === "0" ? digit : body + digit;
    this.entry = (negative ? "-" : "") + body;
    this.operandReady = true;
  };

  Calculator.prototype.inputPoint = function () {
    if (this.entry === null) this.entry = "0.";
    else if (this.entry.indexOf(".") === -1) this.entry += ".";
    this.operandReady = true;
  };

  /* Apply a binary operator, or raise the matching error and return null. */
  Calculator.prototype.binary = function (op, a, b) {
    var outcome = applyBinary(op, a, b);
    if (outcome.error) {
      this.fail(outcome.error);
      return null;
    }
    return outcome.value;
  };

  Calculator.prototype.setOperator = function (op) {
    var operand = this.currentValue();
    if (this.pendingOp !== null && this.operandReady) {
      var result = this.binary(this.pendingOp, this.accumulator, operand);
      if (result === null) return;
      this.accumulator = result;
    } else if (this.pendingOp === null) {
      this.accumulator = operand;
    } // else: operator pressed twice in a row - the previous one is replaced
    this.pendingOp = op;
    this.operandReady = false;
    this.value = this.accumulator;
    this.entry = null;
  };

  Calculator.prototype.equals = function () {
    var op, operand, base;
    if (this.pendingOp !== null) {
      op = this.pendingOp;
      operand = this.currentValue();
      base = this.accumulator;
    } else if (this.lastOp !== null) {
      op = this.lastOp;
      operand = this.lastOperand;
      base = this.currentValue();
    } else {
      return;
    }
    var left = format.formatNumber(base);
    var operator = OPERATORS[op].symbol;
    var right = format.formatNumber(operand);
    var result = this.binary(op, base, operand);
    if (result === null) return;

    this.lastOp = op;
    this.lastOperand = operand;
    this.pendingOp = null;
    this.value = result;
    this.entry = null;
    this.operandReady = true;
    this.history.push({
      expression: left + " " + operator + " " + right + " =",
      result: format.formatNumber(result),
      value: result
    });
  };

  Calculator.prototype.applyUnary = function (kind) {
    var x = this.currentValue();
    switch (kind) {
      case "negate":
        this.negate();
        return;
      case "percent":
        // Windows: for + and - the percentage is taken of the first operand.
        this.setResult(this.pendingOp === "add" || this.pendingOp === "sub"
          ? this.accumulator * x / 100
          : x / 100);
        return;
      case "reciprocal":
        if (x === 0) this.fail(ERRORS.divideByZero);
        else this.setResult(1 / x);
        return;
      case "square":
        this.setResult(x * x);
        return;
      case "sqrt":
        if (x < 0) this.fail(ERRORS.invalidInput);
        else this.setResult(Math.sqrt(x));
        return;
      default:
        return;
    }
  };

  /* +/- keeps the entry editable ("5" +/= "-5", then digits keep appending). */
  Calculator.prototype.negate = function () {
    if (this.entry !== null) {
      this.entry = this.entry.charAt(0) === "-" ? this.entry.slice(1) : "-" + this.entry;
    } else {
      this.value = -this.value;
      this.operandReady = true;
    }
  };

  Calculator.prototype.clearEntry = function () {
    this.entry = null;
    this.value = 0;
    this.operandReady = false;
  };

  Calculator.prototype.backspace = function () {
    if (this.entry === null) return; // results are not editable
    var next = this.entry.slice(0, -1);
    if (next === "" || next === "-") {
      this.entry = null;
      this.value = 0;
      this.operandReady = false;
      return;
    }
    this.entry = next;
  };

  Calculator.prototype.memoryAction = function (kind) {
    var x = this.currentValue();
    switch (kind) {
      case "store":
        this.memory = x;
        this.hasMemory = true;
        return;
      case "clear":
        this.memory = 0;
        this.hasMemory = false;
        return;
      case "recall":
        if (!this.hasMemory) return; // MR is inert until something is stored
        this.value = this.memory;
        this.entry = null;
        this.operandReady = true;
        return;
      case "add":
        this.memory += x;
        this.hasMemory = true;
        return;
      case "subtract":
        this.memory -= x;
        this.hasMemory = true;
        return;
      default:
        return;
    }
  };

  Calculator.prototype.clearHistory = function () {
    this.history.length = 0;
  };

  /* Drop a value straight into the display (history recall). The value may
   * arrive as a number or as the exact decimal text history stored, so a
   * QWORD survives the round trip. */
  Calculator.prototype.setValue = function (value) {
    var text = String(value);
    this.reset();
    if (this.mode === "programmer") this.value = progTrunc(this, progParse(10, text));
    else this.value = Number(text);
    this.operandReady = true;
  };

  /* --- Scientific mode ----------------------------------------------------
   * Scientific types an expression and evaluates it on "=", with standard
   * operator precedence and parentheses (CON-003). The machine mirrors the
   * real app:
   *   - the value line shows the operand being typed; the expression line
   *     shows the expression up to (not including) that operand
   *   - a unary function applies to the current operand immediately and the
   *     operand's text wraps ("9" then "sin" shows sin(9) and 0.156...)
   *   - ")" folds the innermost group into one operand
   *   - "=" evaluates and records history; an operator afterwards continues
   *     from the result, a digit starts a new expression, and a further "="
   *     repeats the last operation (as Standard does)
   *   - "exp" types the real app's times-ten-to-the-n exponent entry
   */

  var ANGLE_UNITS = ["DEG", "RAD", "GRAD"];

  /* Math.PI is a hair above pi (by 1.2246e-16), so 90 degrees lands at
   * 1.5707963267948966 and cos(90) shows 6.1e-17 instead of 0. Splitting the
   * angle into the high product and the pi remainder, then applying the angle
   * sum identity, keeps quadrant and half-quadrant angles exact without
   * changing the general cases. */
  var PI_REMAINDER = 1.2246467991473532e-16;

  function applyTrig(fn, value, unit) {
    if (unit === "RAD") return fn(value);
    var turns = unit === "GRAD" ? 200 : 180;
    var high = value * Math.PI / turns;
    var low = value * PI_REMAINDER / turns;
    var sine = Math.sin(high) + low * Math.cos(high);
    var cosine = Math.cos(high) - low * Math.sin(high);
    if (fn === Math.tan) return sine / cosine;
    return fn === Math.sin ? sine : cosine;
  }

  function fromRadians(value, unit) {
    if (unit === "DEG") return value * 180 / Math.PI;
    if (unit === "GRAD") return value * 200 / Math.PI;
    return value;
  }

  /* Lanczos approximation: the real app's n! is Gamma(n + 1), so non-integers
   * work (0.5! = 0.886...) and negative integers are undefined. */
  var GAMMA_COEFFICIENTS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];

  function gamma(x) {
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
    x -= 1;
    var sum = GAMMA_COEFFICIENTS[0];
    var t = x + 7.5;
    for (var i = 1; i < GAMMA_COEFFICIENTS.length; i++) sum += GAMMA_COEFFICIENTS[i] / (x + i);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * sum;
  }

  /* n!: exact products for non-negative integers (the real app's 19! is
   * 121645100408832000, which a product loop gets and Gamma almost gets);
   * Gamma for fractions, as the real app's 0.5! = 0.886... shows. */
  function factorial(x) {
    if (x === Math.floor(x)) {
      var product = 1;
      for (var i = 2; i <= x && isFinite(product); i++) product *= i;
      return product;
    }
    return gamma(x + 1);
  }

  function roundHalfAwayFromZero(x) {
    return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
  }

  /* Trigonometry in degrees and gradians ends its last bit or two in noise
   * (asin 0.5 = 30.000000000000004, acos 0.5 = 60.00000000000001, sin 30 =
   * 0.49999999999999994). When a short form of the result sits within a bit
   * and a half of it, that form is the value the real app shows; anything
   * further away keeps its full double precision. Radians are untouched:
   * there the raw double is already the answer. */
  var TRIG_SHORT_DIGITS = 12;

  function cleanTrigResult(value) {
    if (value === 0) return value; // keep the sign of zero
    var short = Number(value.toPrecision(TRIG_SHORT_DIGITS));
    return Math.abs(short - value) <= 1.5 * Number.EPSILON * Math.abs(value) ? short : value;
  }

  /* Unary functions, with the text their operand takes in the expression
   * line ("x²" on 9 renders as sqr(9)). `valid` rejects out-of-domain input;
   * `trig` marks the angle-unit conversions. +/- has its own behaviour (it
   * edits the entry) and is handled by sciNegate, not by this table. */
  var FUNCTIONS = {
    percent: { text: "/100", apply: function (x) { return x / 100; } },
    reciprocal: {
      text: "1/", apply: function (x) { return 1 / x; },
      valid: function (x) { return x !== 0; }, error: ERRORS.divideByZero
    },
    square: { text: "sqr", apply: function (x) { return x * x; } },
    cube: { text: "cube", apply: function (x) { return x * x * x; } },
    sqrt: { text: "\u221a", apply: Math.sqrt, valid: function (x) { return x >= 0; } },
    cbrt: { text: "\u221b", apply: Math.cbrt },
    abs: { text: "abs", apply: Math.abs },
    factorial: {
      text: "fact", apply: factorial,
      valid: function (x) { return x >= 0; }
    },
    floor: { text: "floor", apply: Math.floor },
    ceil: { text: "ceil", apply: Math.ceil },
    round: { text: "round", apply: roundHalfAwayFromZero },
    sin: { text: "sin", apply: Math.sin, trig: "in" },
    cos: { text: "cos", apply: Math.cos, trig: "in" },
    tan: { text: "tan", apply: Math.tan, trig: "in", error: ERRORS.undefined },
    asin: { text: "asin", apply: Math.asin, trig: "out", valid: function (x) { return x >= -1 && x <= 1; } },
    acos: { text: "acos", apply: Math.acos, trig: "out", valid: function (x) { return x >= -1 && x <= 1; } },
    atan: { text: "atan", apply: Math.atan, trig: "out" },
    log: { text: "log", apply: Math.log10, valid: function (x) { return x > 0; } },
    ln: { text: "ln", apply: Math.log, valid: function (x) { return x > 0; } },
    exp: { text: "e^", apply: Math.exp },
    tenpow: { text: "10^", apply: function (x) { return Math.pow(10, x); } },
    twopow: { text: "2^", apply: function (x) { return Math.pow(2, x); } }
  };

  var PRECEDENCE = { add: 1, sub: 1, mul: 2, div: 2, mod: 2, pow: 4, root: 4, logy: 4 };
  var RIGHT_ASSOCIATIVE = { pow: true, root: true, logy: true };

  /* One binary operation, with the error semantics of the real app. */
  function applyBinary(op, a, b) {
    if (op === "div" && b === 0) {
      return { error: a === 0 ? ERRORS.undefined : ERRORS.divideByZero };
    }
    if (op === "mod" && b === 0) return { error: ERRORS.undefined };
    var result = OPERATORS[op].apply(a, b);
    if (isNaN(result)) return { error: ERRORS.invalidInput };
    if (!isFinite(result)) return { error: ERRORS.overflow };
    return { value: result };
  }

  /* Shunting-yard over committed tokens: {type:"num"|"op"|"open"|"close"}.
   * Unclosed groups are closed implicitly, so "2 x ( 3 + 4 =" evaluates. */
  function evaluateTokens(tokens) {
    var values = [];
    var operators = [];
    var outcome;
    var i;

    function reduce() {
      var op = operators.pop();
      var right = values.pop();
      var left = values.pop();
      return applyBinary(op, left, right);
    }

    for (i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type === "num") {
        values.push(token.value);
        continue;
      }
      if (token.type === "open") {
        operators.push("(");
        continue;
      }
      if (token.type === "close") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          outcome = reduce();
          if (outcome.error) return outcome;
          values.push(outcome.value);
        }
        if (operators.length) operators.pop();
        continue;
      }
      while (operators.length && operators[operators.length - 1] !== "(") {
        var top = operators[operators.length - 1];
        var binds = PRECEDENCE[top] > PRECEDENCE[token.op] ||
          (PRECEDENCE[top] === PRECEDENCE[token.op] && !RIGHT_ASSOCIATIVE[token.op]);
        if (!binds) break;
        outcome = reduce();
        if (outcome.error) return outcome;
        values.push(outcome.value);
      }
      operators.push(token.op);
    }

    while (operators.length) {
      if (operators[operators.length - 1] === "(") {
        operators.pop();
        continue;
      }
      outcome = reduce();
      if (outcome.error) return outcome;
      values.push(outcome.value);
    }
    if (!values.length) return { error: ERRORS.invalidInput };
    var result = values[values.length - 1];
    if (isNaN(result)) return { error: ERRORS.invalidInput };
    if (!isFinite(result)) return { error: ERRORS.overflow };
    return { value: result };
  }

  /* The expression line's text for a token list: "(2 + 3) x 4". */
  function renderTokens(tokens) {
    var text = "";
    var afterOpen = false;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var piece;
      if (token.type === "num") piece = token.text;
      else if (token.type === "op") piece = OPERATORS[token.op].symbol;
      else piece = token.type === "open" ? "(" : ")";
      if (i > 0 && !afterOpen && piece !== ")") text += " ";
      text += piece;
      afterOpen = token.type === "open";
    }
    return text;
  }

  /* Split a typed exponent entry: "2e+3" -> mantissa "2", sign "+", "3". */
  function exponentParts(entry) {
    var match = /[eE]([+-]?)(\d*)$/.exec(entry);
    if (!match) return null;
    return { mantissa: entry.slice(0, match.index), sign: match[1], exponent: match[2] };
  }

  function sciEntryText(entry) {
    var parts = exponentParts(entry);
    if (!parts) return format.formatEntry(entry);
    return format.formatEntry(parts.mantissa) + "e" + parts.sign + parts.exponent;
  }

  /* The mode-specific half of reset(): C clears the expression only. */
  function sciReset(calc) {
    calc.tokens = [];
    calc.operandText = null; // text of a computed operand, e.g. "sqr(9)"
    calc.lastExpr = "";      // the expression line after "="
    calc.completed = false;  // true between "=" and the next digit
  }

  function sciExpression(calc) {
    if (calc.completed) return calc.lastExpr;
    var text = renderTokens(calc.tokens);
    if (calc.operandText !== null) {
      var glue = text === "" || text.charAt(text.length - 1) === "(" ? "" : " ";
      text += glue + calc.operandText;
    }
    return text;
  }

  /* The operand the expression is waiting for: the typed entry, a computed
   * operand, or the value on the display. */
  function sciOperand(calc) {
    if (calc.entry !== null) return { text: calc.entry, value: parseFloat(calc.entry) };
    if (calc.operandText !== null) return { text: calc.operandText, value: calc.value };
    return { text: format.formatNumber(calc.value), value: calc.value };
  }

  function sciFail(calc, message) {
    calc.fail(message);
    calc.operandText = null;
    calc.lastExpr = "";
    calc.completed = false;
  }

  /* After "=" a digit starts a new expression; the result stays on display. */
  function sciStartExpression(calc) {
    calc.tokens = [];
    calc.operandText = null;
    calc.lastExpr = "";
    calc.completed = false;
  }

  function sciInputDigit(calc, digit) {
    if (calc.completed) sciStartExpression(calc);
    var entry = calc.entry;
    if (entry === null) {
      calc.entry = digit;
      calc.operandText = null;
      return;
    }
    var parts = exponentParts(entry);
    if (parts) {
      if (parts.exponent.length >= 3) return;
      calc.entry = parts.mantissa + "e" + parts.sign +
        (parts.exponent === "0" ? digit : parts.exponent + digit);
      return;
    }
    if (format.digitCount(entry) >= format.MAX_INPUT_DIGITS) return;
    calc.entry = entry === "0" ? digit : entry + digit;
  }

  function sciInputPoint(calc) {
    if (calc.completed) sciStartExpression(calc);
    if (calc.entry === null) {
      calc.entry = "0.";
      calc.operandText = null;
    } else if (calc.entry.indexOf(".") === -1 && !exponentParts(calc.entry)) {
      calc.entry += ".";
    }
  }

  /* The exp key: times-ten-to-the-n entry ("2 exp 3" types 2e+3). */
  function sciExponent(calc) {
    if (calc.completed) sciStartExpression(calc);
    var entry = calc.entry === null ? "1" : calc.entry;
    if (exponentParts(entry)) return;
    calc.entry = entry + "e+";
    calc.operandText = null;
  }

  function sciFunction(calc, name) {
    if (name === "negate") {
      sciNegate(calc);
      return;
    }
    var fn = FUNCTIONS[name];
    if (!fn) return;
    if (calc.completed) sciStartExpression(calc);
    var operand = sciOperand(calc);
    if (fn.valid && !fn.valid(operand.value)) {
      sciFail(calc, fn.error || ERRORS.invalidInput);
      return;
    }
    var result;
    if (fn.trig === "in") result = applyTrig(fn.apply, operand.value, calc.angleUnit);
    else if (fn.trig === "out") result = fromRadians(fn.apply(operand.value), calc.angleUnit);
    else result = fn.apply(operand.value);
    if (fn.trig && calc.angleUnit !== "RAD") result = cleanTrigResult(result);
    if (isNaN(result)) {
      sciFail(calc, fn.error || ERRORS.invalidInput);
      return;
    }
    if (!isFinite(result)) {
      sciFail(calc, fn.error || ERRORS.overflow);
      return;
    }
    calc.entry = null;
    calc.value = result;
    // A parenthesised group already carries its brackets: √(9 + 7), not
    // √((9 + 7)).
    calc.operandText = /^\(.*\)$/.test(operand.text)
      ? fn.text + operand.text
      : fn.text + "(" + operand.text + ")";
  }

  /* +/- edits a typed entry (as Standard does) and toggles a computed one.
   * Inside an exponent entry it flips the exponent's sign, as the real app's
   * "5 exp +/- 2" = 0.05 shows. */
  function sciNegate(calc) {
    if (calc.entry !== null) {
      var parts = exponentParts(calc.entry);
      if (parts) {
        calc.entry = parts.mantissa + "e" + (parts.sign === "-" ? "+" : "-") + parts.exponent;
        return;
      }
      calc.entry = calc.entry.charAt(0) === "-" ? calc.entry.slice(1) : "-" + calc.entry;
      return;
    }
    calc.value = -calc.value;
    if (calc.operandText !== null) {
      calc.operandText = calc.operandText.charAt(0) === "-"
        ? calc.operandText.slice(1)
        : "-" + calc.operandText;
    }
  }

  function sciConstant(calc, name) {
    if (calc.completed) sciStartExpression(calc);
    calc.entry = null;
    calc.operandText = name === "pi" ? "\u03c0" : "e";
    calc.value = name === "pi" ? Math.PI : Math.E;
  }

  function sciOperator(calc, op) {
    calc.completed = false;
    calc.lastExpr = "";
    var tokens = calc.tokens;
    var last = tokens.length ? tokens[tokens.length - 1] : null;
    // Pressing an operator twice in a row replaces the pending one; an
    // operand entered in between commits first.
    if (last && last.type === "op" && calc.entry === null && calc.operandText === null) {
      last.op = op;
      return;
    }
    var operand = sciOperand(calc);
    tokens.push({ type: "num", text: operand.text, value: operand.value });
    tokens.push({ type: "op", op: op });
    calc.entry = null;
    calc.operandText = null;
    calc.value = operand.value;
  }

  function sciParen(calc, which) {
    calc.completed = false;
    calc.lastExpr = "";
    var tokens = calc.tokens;
    if (which === "open") {
      // An operand directly before "(" reads as an implicit multiplication.
      if (calc.entry !== null || calc.operandText !== null) {
        var next = sciOperand(calc);
        tokens.push({ type: "num", text: next.text, value: next.value });
        tokens.push({ type: "op", op: "mul" });
        calc.value = next.value;
      }
      tokens.push({ type: "open" });
      calc.entry = null;
      calc.operandText = null;
      return;
    }
    var open = -1;
    for (var i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].type === "open") {
        open = i;
        break;
      }
    }
    if (open === -1) return; // ")" with no group open
    var group = tokens.slice(open + 1);
    var operand = sciOperand(calc);
    group.push({ type: "num", text: operand.text, value: operand.value });
    var outcome = evaluateTokens(group);
    if (outcome.error) {
      sciFail(calc, outcome.error);
      return;
    }
    tokens.length = open;
    calc.entry = null;
    calc.value = outcome.value;
    calc.operandText = "(" + renderTokens(group) + ")";
  }

  function sciEquals(calc) {
    var tokens = calc.tokens;
    var outcome;
    var i;

    if (tokens.length === 0) {
      // Nothing to evaluate: repeat the last operation, as Standard does.
      if (calc.lastOp === null) return;
      var base = calc.currentValue();
      outcome = applyBinary(calc.lastOp, base, calc.lastOperand);
      if (outcome.error) {
        sciFail(calc, outcome.error);
        return;
      }
      var left = format.formatNumber(base);
      var right = format.formatNumber(calc.lastOperand);
      var repeatText = left + " " + OPERATORS[calc.lastOp].symbol + " " + right + " =";
      calc.entry = null;
      calc.operandText = null;
      calc.value = outcome.value;
      calc.lastExpr = repeatText;
      calc.completed = true;
      calc.history.push({
        expression: repeatText,
        result: format.formatNumber(outcome.value),
        value: outcome.value
      });
      return;
    }

    var expression = tokens.slice();
    var last = expression[expression.length - 1];
    if (calc.entry !== null || calc.operandText !== null || last.type === "op") {
      var operand = sciOperand(calc);
      expression.push({ type: "num", text: operand.text, value: operand.value });
    }
    outcome = evaluateTokens(expression);
    if (outcome.error) {
      sciFail(calc, outcome.error);
      return;
    }
    // Remember the trailing operation so a further "=" can repeat it.
    var repeatOp = null;
    var repeatOperand = null;
    for (i = expression.length - 1; i >= 0; i--) {
      if (expression[i].type === "num") repeatOperand = expression[i].value;
      else if (expression[i].type === "op") {
        repeatOp = expression[i].op;
        break;
      }
    }
    var text = renderTokens(expression) + " =";
    calc.tokens = [];
    calc.entry = null;
    calc.operandText = null;
    calc.value = outcome.value;
    calc.lastOp = repeatOp;
    calc.lastOperand = repeatOperand;
    calc.lastExpr = text;
    calc.completed = true;
    calc.history.push({
      expression: text,
      result: format.formatNumber(outcome.value),
      value: outcome.value
    });
  }

  function sciClearEntry(calc) {
    calc.entry = null;
    calc.value = 0;
    calc.operandText = null;
  }

  function sciBackspace(calc) {
    if (calc.entry === null) return; // results are not editable
    var next = calc.entry.slice(0, -1);
    while (/[eE][+-]?$/.test(next)) next = next.slice(0, -1);
    if (next === "" || next === "-") {
      calc.entry = null;
      calc.value = 0;
      return;
    }
    calc.entry = next;
  }

  function sciPress(calc, kind, arg) {
    switch (kind) {
      case "digit": sciInputDigit(calc, arg); return;
      case "point": sciInputPoint(calc); return;
      case "op": sciOperator(calc, arg); return;
      case "equals": sciEquals(calc); return;
      case "clear": calc.reset(); return;
      case "clearEntry": sciClearEntry(calc); return;
      case "backspace": sciBackspace(calc); return;
      case "unary": sciFunction(calc, arg); return;
      case "const": sciConstant(calc, arg); return;
      case "paren": sciParen(calc, arg); return;
      case "entry": sciExponent(calc); return;
      case "angle": calc.angleUnit = arg.toUpperCase(); return;
      case "second": calc.second = !calc.second; return;
      case "memory":
        calc.memoryAction(arg);
        if (arg === "recall") calc.operandText = null;
        return;
      default: return;
    }
  }

  var HANDLERS = {
    digit: "inputDigit",
    point: "inputPoint",
    op: "setOperator",
    equals: "equals",
    clear: "reset",
    clearEntry: "clearEntry",
    backspace: "backspace",
    unary: "applyUnary",
    memory: "memoryAction"
  };

  var SIMPLE_ACTIONS = ["point", "equals", "clear", "clearEntry", "backspace", "second"];

  /* The actions every mode's keypad and keyboard map may name. */
  Calculator.isAction = function (action) {
    if (typeof action !== "string") return false;
    var parts = action.split(":");
    var kind = parts[0];
    if (SIMPLE_ACTIONS.indexOf(kind) !== -1) return parts.length === 1;
    if (kind === "digit") return /^[0-9a-fA-F]$/.test(parts[1]);
    if (kind === "op") {
      return Object.prototype.hasOwnProperty.call(OPERATORS, parts[1]) ||
        Object.prototype.hasOwnProperty.call(PROGRAMMER_APPLY, parts[1]);
    }
    if (kind === "unary") {
      return parts[1] === "negate" || parts[1] === "not" ||
        Object.prototype.hasOwnProperty.call(ROTATES, parts[1]) ||
        Object.prototype.hasOwnProperty.call(FUNCTIONS, parts[1]);
    }
    if (kind === "const") return parts[1] === "pi" || parts[1] === "e";
    if (kind === "paren") return parts[1] === "open" || parts[1] === "close";
    if (kind === "entry") return parts[1] === "exp";
    if (kind === "angle") return ANGLE_UNITS.indexOf(String(parts[1]).toUpperCase()) !== -1;
    if (kind === "base") return Object.prototype.hasOwnProperty.call(BASE_RADIX, parts[1]);
    if (kind === "word") return parts[1] === "cycle";
    if (kind === "shift") return SHIFT_MODES.indexOf(parts[1]) !== -1;
    if (kind === "bit") return /^\d{1,2}$/.test(parts[1]) && Number(parts[1]) < 64;
    if (kind === "memory") return ["clear", "recall", "add", "subtract", "store"].indexOf(parts[1]) !== -1;
    return false;
  };

  Calculator.prototype.press = function (action) {
    if (!Calculator.isAction(action)) return;
    var parts = String(action).split(":");
    var kind = parts[0];
    if (this.error) {
      // Only the clearing keys and a fresh digit leave an error state.
      if (SIMPLE_ACTIONS.indexOf(kind) === -1 && kind !== "digit") return;
      this.reset();
    }
    if (this.mode === "programmer") {
      progPress(this, kind, parts[1]);
      return;
    }
    if (this.mode === "scientific") {
      sciPress(this, kind, parts[1]);
      return;
    }
    var handler = HANDLERS[kind];
    if (handler) this[handler](parts[1]);
  };

  Calculator.prototype.angleUnit = "DEG";

  /* --- Programmer mode ----------------------------------------------------
   * The real app's Programmer mode, following its public source
   * (github.com/microsoft/calculator; the receipt's Source / Semantic
   * Evidence section carries the citations):
   *   - the value is the width-bounded two's-complement bit pattern, held as
   *     BigInt so QWORD stays exact; HEX, OCT and BIN read the pattern raw,
   *     DEC reads it signed (scicomm.cpp GetStringForDisplay)
   *   - immediate execution under the engine's precedence table: OR/XOR 0,
   *     AND/NAND/NOR 1, + and - 2, the shifts, Mod, x and / 3
   *     (scicomm.cpp NPrecedenceOfOp)
   *   - a shift by the whole word width is the "Result not defined" error
   *     (CALC_E_NORESULT, scioper.cpp)
   *   - the four rotate keys rotate exactly one bit; the through-carry pair
   *     keeps a carry bit that only C clears (scifunc.cpp, scicomm.cpp)
   *   - DEC input stops at the signed maximum, the other bases at the
   *     pattern's limit (sciset.cpp UpdateMaxIntDigits, CalcInput.cpp)
   *   - digits group every 3 (DEC, OCT) or 4 (HEX, BIN), and the binary
   *     readout is padded to a whole nibble (scidisp.cpp GroupDigitsPerRadix,
   *     StandardCalculatorViewModel.AddPadding)
   */

  var WORD_BITS = { qword: 64, dword: 32, word: 16, byte: 8 };
  var WORD_ORDER = ["qword", "dword", "word", "byte"];
  var BASE_RADIX = { hex: 16, dec: 10, oct: 8, bin: 2 };
  var SHIFT_MODES = ["arithmetic", "logical", "rotate", "rotateCarry"];

  /* The programmer operators and the precedence the real engine gives them
   * (scicomm.cpp NPrecedenceOfOp); all of them bind left to right. */
  var PROGRAMMER_SYMBOLS = {
    add: "+", sub: "\u2212", mul: "\u00d7", div: "\u00f7", mod: "%",
    and: "AND", or: "OR", xor: "XOR", nand: "NAND", nor: "NOR",
    lsh: "Lsh", rsh: "Rsh"
  };

  var PROGRAMMER_PRECEDENCE = {
    or: 0, xor: 0, and: 1, nand: 1, nor: 1,
    add: 2, sub: 2, mul: 3, div: 3, mod: 3, lsh: 3, rsh: 3
  };

  /* The one-bit rotations are unary keys, not operators. The real engine
   * renders the through-carry pair with the same symbol as the circular pair
   * in its expression string ("RoR(RoR(1))" for two Rorc presses). */
  var ROTATES = {
    rol: { symbol: "RoL", left: true },
    ror: { symbol: "RoR", left: false },
    rolc: { symbol: "RoL", left: true },
    rorc: { symbol: "RoR", left: false }
  };

  function progWidth(calc) { return WORD_BITS[calc.wordSize]; }
  function progMask(calc) { return (1n << BigInt(progWidth(calc))) - 1n; }
  function progTrunc(calc, value) { return value & progMask(calc); }

  /* The signed reading of the pattern: what DEC displays, and what division,
   * modulo and the arithmetic shift operate on. */
  function progSigned(calc, value) {
    var width = BigInt(progWidth(calc));
    return (value & (1n << (width - 1n))) ? value - (1n << width) : value;
  }

  function progParse(radix, text) {
    if (text === "") return 0n;
    if (radix === 16) return BigInt("0x" + text);
    if (radix === 8) return BigInt("0o" + text);
    if (radix === 2) return BigInt("0b" + text);
    return BigInt(text);
  }

  /* The value of a typed entry, sign included. */
  function progEntryValue(calc, text) {
    var negative = text.charAt(0) === "-";
    var body = negative ? text.slice(1) : text;
    if (body === "") return 0n;
    var value = progParse(BASE_RADIX[calc.base], body);
    return negative ? progTrunc(calc, -value) : value;
  }

  function progRawTextFor(calc, base, value) {
    if (base === "dec") return progSigned(calc, value).toString(10);
    return value.toString(BASE_RADIX[base]).toUpperCase();
  }

  function progRawText(calc, value) {
    return progRawTextFor(calc, calc.base, value);
  }

  /* Digits group from the right: DEC and OCT every 3, HEX and BIN every 4,
   * separated by a space. */
  function progGroupDigits(text, size) {
    var parts = [];
    for (var end = text.length; end > 0; end -= size) {
      parts.unshift(text.slice(Math.max(0, end - size), end));
    }
    return parts.join(" ");
  }

  /* The display text for a base: DEC keeps the sign and groups with commas;
   * the binary row is padded to a whole nibble first. */
  function progDisplay(calc, base, value) {
    var text = progRawTextFor(calc, base, value);
    if (base === "dec") return format.groupIntegerPart(text);
    if (base === "bin" && value > 0n) {
      while (text.length % 4 !== 0) text = "0" + text;
      return progGroupDigits(text, 4);
    }
    return progGroupDigits(text, base === "hex" ? 4 : 3);
  }

  /* A digit this base accepts: BIN takes 0-1, OCT 0-7, DEC 0-9, HEX 0-9 and
   * A-F. The shell dims the keys the same rule rejects. */
  function progDigitValue(calc, digit) {
    var value = parseInt(digit, 16);
    return value < BASE_RADIX[calc.base] ? value : -1;
  }

  /* DEC input stops at the signed maximum (2^(w-1)-1, or 2^(w-1) for a
   * negative entry); every other base stops at the pattern's limit. */
  function progInputLimit(calc) {
    if (calc.base !== "dec") return progMask(calc);
    var half = 1n << BigInt(progWidth(calc) - 1);
    return calc.entry !== null && calc.entry.charAt(0) === "-" ? half : half - 1n;
  }

  function progReset(calc) {
    calc.value = 0n;
    calc.entry = null;
    calc.operandText = null;
    calc.tokens = [];      // the expression line's record
    calc.opStack = [];     // pending operators, resolved by precedence
    calc.valStack = [];    // committed operands
    calc.lastExpr = "";
    calc.lastOp = null;
    calc.lastOperand = null;
    calc.lastCommitted = null;
    calc.completed = false;
    calc.carry = 0;        // only C clears the rotate carry, as in the real app
    // The cleared display holds 0, which the next operator takes as its
    // operand - as the real app does after C.
    calc.operandReady = true;
  }

  function progFail(calc, message) {
    var carry = calc.carry;
    calc.fail(message);
    progReset(calc);
    calc.carry = carry;    // an error is not C, so the carry survives
  }

  /* --- the integer operations --- */

  function progDivide(calc, a, b) {
    if (b === 0n) return { error: a === 0n ? ERRORS.undefined : ERRORS.divideByZero };
    // C#'s integer division truncates toward zero, and so does BigInt.
    return { value: progTrunc(calc, progSigned(calc, a) / progSigned(calc, b)) };
  }

  function progModulo(calc, a, b) {
    if (b === 0n) return { error: ERRORS.undefined };
    // C#'s remainder takes the sign of the dividend, and so does BigInt.
    return { value: progTrunc(calc, progSigned(calc, a) % progSigned(calc, b)) };
  }

  /* Lsh / Rsh. The count is the operator's right operand; a shift by the
   * whole word width is the real app's "Result not defined" error. Logical
   * mode fills with zeros, otherwise the sign bit propagates. */
  function progShift(calc, left, value, count) {
    var width = BigInt(progWidth(calc));
    var distance = count < 0n ? -count : count;
    if (distance >= width) return { error: ERRORS.resultNotDefined };
    if (left) return { value: progTrunc(calc, value << distance) };
    if (calc.shiftMode === "logical") return { value: value >> distance };
    return { value: progTrunc(calc, progSigned(calc, value) >> distance) };
  }

  var PROGRAMMER_APPLY = {
    add: function (calc, a, b) { return { value: progTrunc(calc, a + b) }; },
    sub: function (calc, a, b) { return { value: progTrunc(calc, a - b) }; },
    mul: function (calc, a, b) { return { value: progTrunc(calc, a * b) }; },
    div: progDivide,
    mod: progModulo,
    and: function (calc, a, b) { return { value: a & b }; },
    or: function (calc, a, b) { return { value: a | b }; },
    xor: function (calc, a, b) { return { value: a ^ b }; },
    nand: function (calc, a, b) { return { value: progTrunc(calc, ~(a & b)) }; },
    nor: function (calc, a, b) { return { value: progTrunc(calc, ~(a | b)) }; },
    lsh: function (calc, a, b) { return progShift(calc, true, a, b); },
    rsh: function (calc, a, b) { return progShift(calc, false, a, b); }
  };

  function progApply(calc, op, a, b) {
    var apply = PROGRAMMER_APPLY[op];
    return apply ? apply(calc, a, b) : { error: ERRORS.invalidInput };
  }

  /* The real app's logical right shift is its own key, RshL. */
  function progSymbol(calc, op) {
    if (op === "rsh" && calc.shiftMode === "logical") return "RshL";
    return PROGRAMMER_SYMBOLS[op] || op;
  }

  /* --- the expression: a token list for display, stacks for evaluation --- */

  function progIsOperator(token) {
    return PROGRAMMER_PRECEDENCE[token] !== undefined;
  }

  function progRender(calc) {
    var text = "";
    for (var i = 0; i < calc.tokens.length; i++) {
      if (i > 0) text += " ";
      text += progIsOperator(calc.tokens[i]) ? progSymbol(calc, calc.tokens[i]) : calc.tokens[i];
    }
    // A dangling operator keeps its trailing space, as the real app shows.
    if (text !== "" && progIsOperator(calc.tokens[calc.tokens.length - 1])) text += " ";
    return text;
  }

  /* The expression line: the committed tokens, plus a computed operand the
   * current key is about to consume ("RoL(1)"). A typed entry stays off this
   * line, as it does in the real app. */
  function progExpression(calc) {
    if (calc.completed) return calc.lastExpr;
    var text = progRender(calc);
    if (calc.operandText !== null) {
      text += text === "" || text.charAt(text.length - 1) === " " ? "" : " ";
      text += calc.operandText;
    }
    return text;
  }

  /* The operand the expression is waiting for: the typed entry, a computed
   * value's text, or the displayed value. */
  function progOperand(calc) {
    if (calc.entry !== null) return calc.entry;
    if (calc.operandText !== null) return calc.operandText;
    return progRawText(calc, calc.value);
  }

  /* Whether the display holds an operand the next operator can consume. It is
   * false only right after an operator (or a clear), when the display still
   * shows the operand that operator was given. */
  function progHasOperand(calc) {
    return calc.operandReady;
  }

  function progReduce(calc) {
    var op = calc.opStack.pop();
    var right = calc.valStack.pop();
    var left = calc.valStack.pop();
    var outcome = progApply(calc, op, left, right);
    if (outcome.error) return outcome;
    calc.valStack.push(outcome.value);
    calc.value = outcome.value;
    return outcome;
  }

  /* Commit the operand being typed, if any, and its expression text. */
  function progCommit(calc) {
    if (!progHasOperand(calc)) return;
    calc.valStack.push(calc.value);
    calc.tokens.push(progOperand(calc));
    calc.lastCommitted = calc.value;
    calc.entry = null;
    calc.operandText = null;
    calc.operandReady = false;
  }

  function progSetOperator(calc, op) {
    calc.completed = false;
    calc.lastExpr = "";
    if (!progHasOperand(calc) && progIsOperator(calc.tokens[calc.tokens.length - 1])) {
      // An operator pressed twice replaces the pending one.
      calc.tokens.pop();
      calc.opStack.pop();
    } else {
      progCommit(calc);
    }
    while (calc.opStack.length &&
      PROGRAMMER_PRECEDENCE[calc.opStack[calc.opStack.length - 1]] >= PROGRAMMER_PRECEDENCE[op]) {
      var outcome = progReduce(calc);
      if (outcome.error) {
        progFail(calc, outcome.error);
        return;
      }
    }
    calc.opStack.push(op);
    calc.tokens.push(op);
    calc.operandReady = false;
  }

  function progRecord(calc, text) {
    calc.history.push({
      expression: text,
      result: progDisplay(calc, calc.base, calc.value),
      value: progRawText(calc, calc.value)
    });
  }

  function progEquals(calc) {
    if (!calc.tokens.length) {
      // Nothing pending: repeat the last operation on the displayed value,
      // as Standard does after a fresh number.
      if (calc.lastOp === null) return;
      var baseText = progRawText(calc, calc.value);
      var operandText = progRawText(calc, calc.lastOperand);
      var repeat = progApply(calc, calc.lastOp, calc.value, calc.lastOperand);
      if (repeat.error) {
        progFail(calc, repeat.error);
        return;
      }
      calc.value = repeat.value;
      calc.lastExpr = baseText + " " + progSymbol(calc, calc.lastOp) + " " + operandText + "=";
      calc.entry = null;
      calc.operandText = null;
      calc.completed = true;
      calc.operandReady = true;
      progRecord(calc, calc.lastExpr);
      return;
    }
    if (!progHasOperand(calc) && progIsOperator(calc.tokens[calc.tokens.length - 1])) {
      // "2 + =" uses the displayed value as the right operand.
      calc.entry = progRawText(calc, calc.value);
      calc.operandReady = true;
    }
    progCommit(calc);
    while (calc.opStack.length) {
      var outcome = progReduce(calc);
      if (outcome.error) {
        progFail(calc, outcome.error);
        return;
      }
    }
    var lastOp = null;
    for (var i = calc.tokens.length - 1; i >= 0; i--) {
      if (progIsOperator(calc.tokens[i])) {
        lastOp = calc.tokens[i];
        break;
      }
    }
    var text = progRender(calc) + "=";
    calc.lastOp = lastOp;
    calc.lastOperand = lastOp === null ? null : calc.lastCommitted;
    calc.lastExpr = text;
    calc.tokens = [];
    calc.opStack = [];
    calc.valStack = [];
    calc.entry = null;
    calc.operandText = null;
    calc.completed = true;
    calc.operandReady = true;
    progRecord(calc, text);
  }

  /* --- entry, unary keys and the mode's selectors --- */

  function progStartExpression(calc) {
    calc.tokens = [];
    calc.opStack = [];
    calc.valStack = [];
    calc.lastExpr = "";
    calc.completed = false;
  }

  function progInputDigit(calc, digit) {
    if (calc.completed) progStartExpression(calc);
    if (progDigitValue(calc, digit) === -1) return;
    var negative = calc.entry !== null && calc.entry.charAt(0) === "-";
    var body = calc.entry === null ? "" : (negative ? calc.entry.slice(1) : calc.entry);
    body = body === "0" ? "" : body;
    var candidate = body + digit.toUpperCase();
    if (progParse(BASE_RADIX[calc.base], candidate) > progInputLimit(calc)) return;
    calc.entry = (negative ? "-" : "") + candidate;
    calc.value = progEntryValue(calc, calc.entry);
    calc.operandText = null;
    calc.operandReady = true;
  }

  function progBackspace(calc) {
    if (calc.entry === null) return; // results are not editable
    var next = calc.entry.slice(0, -1);
    if (next === "" || next === "-") {
      calc.entry = null;
      calc.value = 0n;
      return;
    }
    calc.entry = next;
    calc.value = progEntryValue(calc, next);
  }

  function progClearEntry(calc) {
    calc.entry = null;
    calc.operandText = null;
    calc.value = 0n;
    calc.operandReady = true; // the cleared 0 is an operand, as after C
  }

  /* +/- toggles a typed entry's sign (the real app's TryToggleSign) and
   * negates a computed value. */
  function progNegate(calc) {
    if (calc.entry !== null) {
      calc.entry = calc.entry.charAt(0) === "-" ? calc.entry.slice(1) : "-" + calc.entry;
      calc.value = progEntryValue(calc, calc.entry);
      return;
    }
    calc.value = progTrunc(calc, -calc.value);
    calc.operandText = null;
    calc.operandReady = true;
  }

  /* NOT is the width-bounded complement (IDC_COM). */
  function progNot(calc) {
    var text = progOperand(calc);
    calc.value = progTrunc(calc, ~calc.value);
    calc.entry = null;
    calc.operandText = "Not(" + text + ")";
    calc.operandReady = true;
  }

  /* The rotate keys turn the value by exactly one bit; the through-carry pair
   * threads the sticky carry bit through the vacated end. */
  function progRotate(calc, kind) {
    var rotate = ROTATES[kind];
    var width = BigInt(progWidth(calc));
    var text = progOperand(calc);
    var bit;
    if (rotate.left) {
      bit = Number((calc.value >> (width - 1n)) & 1n);
      calc.value = progTrunc(calc, (calc.value << 1n) | BigInt(kind === "rolc" ? calc.carry : bit));
    } else {
      bit = Number(calc.value & 1n);
      calc.value = (calc.value >> 1n) |
        (BigInt(kind === "rorc" ? calc.carry : bit) << (width - 1n));
    }
    if (kind === "rolc" || kind === "rorc") calc.carry = bit;
    calc.entry = null;
    calc.operandText = rotate.symbol + "(" + text + ")";
    calc.operandReady = true;
  }

  function progSetBase(calc, base) {
    if (!Object.prototype.hasOwnProperty.call(BASE_RADIX, base)) return;
    calc.base = base;
    calc.entry = null;     // the typed text was in the old base; the value stands
    calc.operandText = null;
  }

  /* The word-size button cycles QWORD -> DWORD -> WORD -> BYTE -> QWORD, as
   * the real app's single button does. The value keeps its low bits. */
  function progCycleWordSize(calc) {
    calc.wordSize = WORD_ORDER[(WORD_ORDER.indexOf(calc.wordSize) + 1) % WORD_ORDER.length];
    calc.entry = null;
    calc.operandText = null;
    calc.value = progTrunc(calc, calc.value);
    for (var i = 0; i < calc.valStack.length; i++) calc.valStack[i] = progTrunc(calc, calc.valStack[i]);
  }

  function progSetShiftMode(calc, mode) {
    if (SHIFT_MODES.indexOf(mode) === -1) return;
    calc.shiftMode = mode;
  }

  function progToggleBit(calc, index) {
    if (!(index >= 0 && index < progWidth(calc))) return;
    calc.entry = null;
    calc.operandText = null;
    calc.value = progTrunc(calc, calc.value ^ (1n << BigInt(index)));
    calc.operandReady = true;
  }

  /* Memory is shared with the other modes, so it may hold a plain number. */
  function progMemoryValue(calc) {
    if (typeof calc.memory === "bigint") return calc.memory;
    var number = Number(calc.memory) || 0;
    var magnitude = progParse(10, String(Math.abs(Math.trunc(number))));
    return number < 0 ? -magnitude : magnitude;
  }

  function progMemory(calc, kind) {
    switch (kind) {
      case "store":
        calc.memory = calc.value;
        calc.hasMemory = true;
        return;
      case "clear":
        calc.memory = 0n;
        calc.hasMemory = false;
        return;
      case "recall":
        if (!calc.hasMemory) return;
        calc.entry = null;
        calc.operandText = null;
        calc.value = progTrunc(calc, progMemoryValue(calc));
        calc.operandReady = true;
        return;
      case "add":
        calc.memory = progTrunc(calc, progMemoryValue(calc) + calc.value);
        calc.hasMemory = true;
        return;
      case "subtract":
        calc.memory = progTrunc(calc, progMemoryValue(calc) - calc.value);
        calc.hasMemory = true;
        return;
      default:
        return;
    }
  }

  function progPress(calc, kind, arg) {
    switch (kind) {
      case "digit": progInputDigit(calc, arg); return;
      case "op": progSetOperator(calc, arg); return;
      case "equals": progEquals(calc); return;
      case "clear": calc.reset(); return;
      case "clearEntry": progClearEntry(calc); return;
      case "backspace": progBackspace(calc); return;
      case "unary":
        if (arg === "negate") progNegate(calc);
        else if (arg === "not") progNot(calc);
        else if (ROTATES[arg]) progRotate(calc, arg);
        return;
      case "base": progSetBase(calc, arg); return;
      case "word": if (arg === "cycle") progCycleWordSize(calc); return;
      case "shift": progSetShiftMode(calc, arg); return;
      case "bit": progToggleBit(calc, Number(arg)); return;
      case "memory": progMemory(calc, arg); return;
      default: return; // point, percent, paren and the rest do not apply here
    }
  }

  /* The four live base readouts; every base shows the value at once. */
  Calculator.prototype.baseValue = function (base) {
    if (this.error) return this.error;
    return progDisplay(this, base, this.value);
  };

  Calculator.prototype.wordWidth = function () { return progWidth(this); };
  Calculator.prototype.wordLabel = function () { return this.wordSize.toUpperCase(); };

  Calculator.prototype.bitValue = function (index) {
    if (!(index >= 0 && index < progWidth(this))) return 0;
    return Number((this.value >> BigInt(index)) & 1n);
  };

  /* Whether the active base accepts this digit; the shell dims the rest. */
  Calculator.prototype.acceptsDigit = function (digit) {
    if (this.mode !== "programmer") return true;
    return progDigitValue(this, digit) !== -1;
  };

  NS.engine = {

    Calculator: Calculator,
    OPERATORS: OPERATORS,
    ERRORS: ERRORS
  };

  if (typeof module !== "undefined") module.exports = NS.engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
