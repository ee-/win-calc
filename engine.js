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
    div: { symbol: "\u00f7", apply: function (a, b) { return a / b; } }
  };

  var ERRORS = {
    divideByZero: "Cannot divide by zero",
    undefined: "Result is undefined",
    invalidInput: "Invalid input",
    overflow: "Overflow"
  };

  function Calculator() {
    // ponytail: one memory value, which is all MC/MR/M+/M-/MS need. The real
    // app keeps a list of stored values behind the memory dropdown; that needs
    // its own work order (engine array + memory-row dropdown UI).
    this.memory = 0;
    this.hasMemory = false;
    this.history = [];
    this.reset();
  }

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
  };

  Object.defineProperty(Calculator.prototype, "display", {
    get: function () {
      if (this.error) return this.error;
      if (this.entry !== null) return format.formatEntry(this.entry);
      return format.formatNumber(this.value);
    }
  });

  /* The pending operation, as the line above the display shows it. */
  Object.defineProperty(Calculator.prototype, "expression", {
    get: function () {
      if (this.error || this.pendingOp === null) return "";
      return format.formatNumber(this.accumulator) + " " + OPERATORS[this.pendingOp].symbol;
    }
  });

  Calculator.prototype.currentValue = function () {
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
    if (op === "div" && b === 0) {
      this.fail(a === 0 ? ERRORS.undefined : ERRORS.divideByZero);
      return null;
    }
    var result = OPERATORS[op].apply(a, b);
    if (!isFinite(result)) {
      this.fail(ERRORS.overflow);
      return null;
    }
    return result;
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

  /* Drop a value straight into the display (history recall). */
  Calculator.prototype.setValue = function (value) {
    this.reset();
    this.value = value;
    this.operandReady = true;
  };

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

  var SIMPLE_ACTIONS = ["point", "equals", "clear", "clearEntry", "backspace"];

  /* The actions every mode's keypad and keyboard map may name. */
  Calculator.isAction = function (action) {
    if (typeof action !== "string") return false;
    var parts = action.split(":");
    var kind = parts[0];
    if (SIMPLE_ACTIONS.indexOf(kind) !== -1) return parts.length === 1;
    if (kind === "digit") return /^[0-9]$/.test(parts[1]);
    if (kind === "op") return Object.prototype.hasOwnProperty.call(OPERATORS, parts[1]);
    if (kind === "unary") return ["negate", "percent", "reciprocal", "square", "sqrt"].indexOf(parts[1]) !== -1;
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
    this[HANDLERS[kind]](parts[1]);
  };

  NS.engine = {
    Calculator: Calculator,
    OPERATORS: OPERATORS,
    ERRORS: ERRORS
  };

  if (typeof module !== "undefined") module.exports = NS.engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
