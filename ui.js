/*
 * UI shell: renders the mode switcher, keypad, display, memory row and history
 * panel, and translates clicks and keystrokes into engine actions.
 *
 * Everything visual comes from data (the mode's keypad definition); the shell
 * hard-codes no per-mode behaviour so later work orders only add mode files.
 */
(function (global) {
  "use strict";

  var NS = global.WinCalc || (global.WinCalc = {});

  /* Modes the switcher lists. Only Standard is implemented in WO-1; the rest
   * render the placeholder panel until their work order lands. */
  var MODES = [
    { id: "standard", label: "Standard", shortcut: "Alt+1" },
    { id: "scientific", label: "Scientific", shortcut: "Alt+2" },
    { id: "graphing", label: "Graphing", shortcut: "Alt+3" },
    { id: "programmer", label: "Programmer", shortcut: "Alt+4" },
    { id: "date", label: "Date Calculation", shortcut: "Alt+5" },
    { id: "converter", label: "Converter", shortcut: "Alt+6" }
  ];

  var MEMORY_KEYS = [
    { label: "MC", action: "memory:clear" },
    { label: "MR", action: "memory:recall" },
    { label: "M+", action: "memory:add" },
    { label: "M\u2212", action: "memory:subtract" },
    { label: "MS", action: "memory:store" }
  ];

  /* MC and MR are dimmed until something is stored, as in the real app. */
  var MEMORY_NEEDS_VALUE = { "memory:clear": true, "memory:recall": true };

  function element(id) {
    return document.getElementById(id);
  }

  function renderMemoryRow(container) {
    container.textContent = "";
    for (var i = 0; i < MEMORY_KEYS.length; i++) {
      var key = MEMORY_KEYS[i];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "memory-key";
      button.textContent = key.label;
      button.dataset.action = key.action;
      button.disabled = Boolean(MEMORY_NEEDS_VALUE[key.action]);
      container.appendChild(button);
    }
  }

  /* Keys auto-place into the mode's grid; the order in the mode's keypad
   * definition is the layout. `keypadEntries` pairs each button with its key
   * data so the 2nd layer can swap labels and actions. */
  var keypadEntries = [];

  function buildKey(key) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "key";
    button.textContent = key.label;
    button.dataset.action = key.action;
    button.dataset.role = key.role;
    button.setAttribute("aria-label", key.ariaLabel || key.label);
    return button;
  }

  function renderKeypad(container, mode) {
    container.textContent = "";
    container.hidden = false;
    container.style.gridTemplateColumns = "repeat(" + (mode.columns || 4) + ", 1fr)";
    keypadEntries = [];
    for (var i = 0; i < mode.keypad.length; i++) {
      var row = mode.keypad[i];
      for (var j = 0; j < row.length; j++) {
        var button = buildKey(row[j]);
        container.appendChild(button);
        keypadEntries.push({ button: button, key: row[j] });
      }
    }
  }

  /* A key may carry extra layers: Scientific's `alt` (the 2nd toggle) and
   * Programmer's `variants`, selected by the engine's shift mode. */
  function keyLayer(key, calculator) {
    if (calculator.mode === "scientific" && calculator.second && key.alt) return key.alt;
    if (key.variants) {
      var variant = key.variants[calculator.shiftMode];
      if (variant) return variant;
    }
    return key;
  }

  /* How a button reads its selected state: the active angle unit, base and
   * shift mode, the 2nd toggle, and a set bit. The word-size control cycles
   * rather than selecting (word:cycle), so it has no pressed state; actions
   * without one return null and the attribute is dropped. */
  function pressedState(action, calculator) {
    var parts = String(action).split(":");
    switch (parts[0]) {
      case "angle": return calculator.angleUnit === parts[1].toUpperCase();
      case "base": return calculator.base === parts[1];
      case "shift": return calculator.shiftMode === parts[1];
      case "second": return Boolean(calculator.second);
      case "bit": return calculator.bitValue(Number(parts[1])) === 1;
      default: return null;
    }
  }

  function applyPressed(button, action, calculator) {
    var pressed = pressedState(action, calculator);
    if (pressed === null) button.removeAttribute("aria-pressed");
    else button.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  /* Scientific's 2nd key toggles the functions that carry an alt layer
   * (sin -> sin-1 and the rest); the active angle unit, base, word size and
   * shift mode read as pressed, as the real app shows them. */
  function applyKeypadState(calculator) {
    for (var i = 0; i < keypadEntries.length; i++) {
      var entry = keypadEntries[i];
      var key = entry.key;
      var layer = keyLayer(key, calculator);
      entry.button.textContent = layer.label;
      entry.button.dataset.action = layer.action;
      entry.button.dataset.role = layer.role || key.role;
      entry.button.setAttribute("aria-label", layer.ariaLabel || layer.label);
      // Base-restricted input: the real app dims the digits the active base
      // does not accept (BIN gates 2-9 and A-F, OCT gates 8-9 and A-F, ...).
      if (layer.action.indexOf("digit:") === 0) {
        entry.button.disabled = !calculator.acceptsDigit(layer.action.slice(6));
      }
      applyPressed(entry.button, layer.action, calculator);
    }
  }

  /* Programmer mode's own display: the word-size and shift-mode selectors,
   * the four live base readouts (each row selects its base) and the bit-toggle
   * panel for the selected width. The values come from the engine, which owns
   * the integer semantics. */
  var programmerRows = [];  // { base, button, valueEl }
  var programmerBits = [];  // { index, button }

  /* The word-size and shift-mode selectors: the word size is one cycling
   * button (the real app's shape), the shift mode a row of keys. The base
   * readout rows double as the base selector. */
  function renderProgrammerSelectors(container, items, prefix) {
    container.textContent = "";
    for (var i = 0; i < items.length; i++) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "memory-key";
      button.textContent = items[i].label;
      button.dataset.action = prefix + ":" + items[i].id;
      container.appendChild(button);
    }
  }

  function renderProgrammerWordButton(container) {
    container.textContent = "";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "memory-key";
    button.dataset.action = "word:cycle";
    button.setAttribute("aria-label", "Word size");
    container.appendChild(button);
  }

  function renderProgrammerReadout(container, bases) {
    programmerRows = [];
    container.textContent = "";
    for (var i = 0; i < bases.length; i++) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "programmer-row";
      row.dataset.action = "base:" + bases[i].id;
      var label = document.createElement("span");
      label.className = "programmer-label";
      label.textContent = bases[i].label;
      var value = document.createElement("span");
      value.className = "programmer-value";
      row.appendChild(label);
      row.appendChild(value);
      container.appendChild(row);
      programmerRows.push({ base: bases[i].id, button: row, valueEl: value });
    }
  }

  /* Most significant bit first, as the real app's bit panel reads. */
  function renderProgrammerBits(container, width) {
    programmerBits = [];
    container.textContent = "";
    for (var index = width - 1; index >= 0; index--) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "bit-key";
      button.dataset.action = "bit:" + index;
      button.setAttribute("aria-label", "Bit " + index);
      container.appendChild(button);
      programmerBits.push({ index: index, button: button });
    }
  }

  function updateProgrammerPanel(container, calculator) {
    for (var i = 0; i < programmerRows.length; i++) {
      var row = programmerRows[i];
      row.valueEl.textContent = calculator.baseValue(row.base);
      row.button.setAttribute("aria-current", calculator.base === row.base ? "true" : "false");
    }
    for (var j = 0; j < programmerBits.length; j++) {
      var bit = programmerBits[j];
      var on = calculator.bitValue(bit.index) === 1;
      bit.button.textContent = on ? "1" : "0";
      bit.button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    var selectors = container.querySelectorAll(".memory-key");
    for (var k = 0; k < selectors.length; k++) {
      var action = selectors[k].dataset.action;
      // The word-size button shows the size it will move on to, as the real
      // app's single cycling button shows the current one.
      if (action === "word:cycle") selectors[k].textContent = calculator.wordLabel();
      applyPressed(selectors[k], action, calculator);
    }
  }

  function renderHistoryList(container, calculator) {
    container.textContent = "";
    var items = calculator.history.slice().reverse();
    for (var i = 0; i < items.length; i++) {
      var entry = items[i];
      var item = document.createElement("li");
      item.className = "history-item";
      item.dataset.value = String(entry.value);
      item.tabIndex = 0;
      var expression = document.createElement("div");
      expression.className = "history-expression";
      expression.textContent = entry.expression;
      var result = document.createElement("div");
      result.className = "history-result";
      result.textContent = entry.result;
      item.appendChild(expression);
      item.appendChild(result);
      container.appendChild(item);
    }
  }

  function renderModes(container, currentId, onSelect) {
    container.textContent = "";
    for (var i = 0; i < MODES.length; i++) {
      var mode = MODES[i];
      var item = document.createElement("li");
      item.className = "mode-item";
      item.dataset.mode = mode.id;
      item.setAttribute("aria-current", mode.id === currentId ? "true" : "false");
      item.tabIndex = 0;
      var label = document.createElement("span");
      label.className = "mode-label";
      label.textContent = mode.label;
      var shortcut = document.createElement("span");
      shortcut.className = "mode-shortcut";
      shortcut.textContent = mode.shortcut;
      item.appendChild(label);
      item.appendChild(shortcut);
      item.addEventListener("click", function (event) {
        onSelect(event.currentTarget.dataset.mode);
      });
      container.appendChild(item);
    }
  }

  function modeById(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return null;
  }

  function modeTitle(id) {
    var mode = modeById(id);
    return mode ? mode.label : id;
  }

  /* The real app shrinks the display font until the value fits the window. */
  var DISPLAY_FONT_MAX = 40;
  var DISPLAY_FONT_MIN = 18;

  function fitDisplay(valueEl) {
    var available = valueEl.clientWidth;
    if (!available) return;
    valueEl.style.fontSize = DISPLAY_FONT_MAX + "px";
    // Font metrics scale with the font size, so one measurement is enough.
    var width = valueEl.scrollWidth;
    if (width <= available) return;
    var size = Math.floor((DISPLAY_FONT_MAX * (available - 2)) / width / 2) * 2;
    valueEl.style.fontSize = Math.max(DISPLAY_FONT_MIN, size) + "px";
  }

  function start() {
    var calculator = new NS.engine.Calculator();
    var calculatorEl = element("calc");
    var keypadEl = element("keypad");
    var placeholderEl = element("placeholder-panel");
    var placeholderTitleEl = element("placeholder-title");
    var drawerEl = element("mode-drawer");
    var modeListEl = element("mode-list");
    var historyEl = element("history-panel");
    var historyListEl = element("history-list");
    var valueEl = element("value");
    var expressionEl = element("expression");
    var modeTitleEl = element("mode-title");
    var navButton = element("nav-button");
    var historyButton = element("history-button");
    var programmerPanelEl = element("programmer-panel");
    var programmerWordsEl = element("programmer-words");
    var programmerShiftsEl = element("programmer-shifts");
    var programmerReadoutEl = element("programmer-readout");
    var programmerBitsEl = element("programmer-bits");
    var programmerBitWidth = 0;

    /* The panel is part of the Programmer mode only; the shell renders it from
     * the mode's data and keeps the engine as the single source of values. */
    function refreshProgrammer() {
      var active = calculator.mode === "programmer";
      programmerPanelEl.hidden = !active;
      if (!active) {
        programmerRows = [];
        programmerBits = [];
        programmerBitWidth = 0;
        return;
      }
      if (programmerBitWidth !== calculator.wordWidth()) {
        programmerBitWidth = calculator.wordWidth();
        renderProgrammerBits(programmerBitsEl, programmerBitWidth);
      }
      updateProgrammerPanel(programmerPanelEl, calculator);
    }

    var currentMode = "standard";
    var mode = NS.modes.standard;
    var historySignature = "";
    var memoryRowEl = element("memory-row");
    renderMemoryRow(memoryRowEl);
    var memoryButtons = memoryRowEl.querySelectorAll(".memory-key");

    function setMemoryButtons() {
      for (var i = 0; i < memoryButtons.length; i++) {
        var action = memoryButtons[i].dataset.action;
        memoryButtons[i].disabled = Boolean(MEMORY_NEEDS_VALUE[action]) && !calculator.hasMemory;
      }
    }

    function refresh() {
      valueEl.textContent = calculator.display;
      expressionEl.textContent = calculator.expression;
      fitDisplay(valueEl);
      applyKeypadState(calculator);
      refreshProgrammer();
      var signature = calculator.history.length + ":" + calculator.memory + ":" + calculator.hasMemory;
      if (signature !== historySignature) {
        historySignature = signature;
        renderHistoryList(historyListEl, calculator);
      }
      setMemoryButtons();
    }

    function press(action) {
      calculator.press(action);
      refresh();
    }

    function selectMode(id) {
      var definition = NS.modes[id];
      currentMode = id;
      mode = definition;
      calculator.setMode(id);
      calculatorEl.dataset.mode = id;
      modeTitleEl.textContent = modeTitle(id);
      drawerEl.hidden = true;
      navButton.setAttribute("aria-expanded", "false");
      if (definition && definition.keypad) {
        placeholderEl.hidden = true;
        renderKeypad(keypadEl, definition);
      } else {
        keypadEntries = [];
        keypadEl.hidden = true;
        keypadEl.textContent = "";
        placeholderEl.hidden = false;
        placeholderTitleEl.textContent = modeTitle(id);
      }
      if (definition && definition.words) {
        renderProgrammerWordButton(programmerWordsEl);
        renderProgrammerSelectors(programmerShiftsEl, definition.shifts, "shift");
        renderProgrammerReadout(programmerReadoutEl, definition.bases);
      }
      refresh();
    }

    keypadEl.addEventListener("click", function (event) {
      var key = event.target.closest(".key");
      if (key) press(key.dataset.action);
    });

    /* The programmer panel's selectors, readout rows and bit keys carry
     * engine actions too; they live outside the keypad grid. */
    programmerPanelEl.addEventListener("click", function (event) {
      var control = event.target.closest("[data-action]");
      if (control && !control.disabled) press(control.dataset.action);
    });

    historyListEl.addEventListener("click", function (event) {
      var item = event.target.closest(".history-item");
      if (item) {
        calculator.setValue(item.dataset.value);
        refresh();
      }
    });

    for (var i = 0; i < memoryButtons.length; i++) {
      memoryButtons[i].addEventListener("click", function (event) {
        press(event.currentTarget.dataset.action);
      });
    }

    element("history-clear").addEventListener("click", function () {
      calculator.clearHistory();
      refresh();
    });

    navButton.addEventListener("click", function () {
      drawerEl.hidden = !drawerEl.hidden;
      navButton.setAttribute("aria-expanded", drawerEl.hidden ? "false" : "true");
      historyEl.hidden = true;
      historyButton.setAttribute("aria-pressed", "false");
      calculatorEl.classList.remove("history-open");
      if (!drawerEl.hidden) renderModes(modeListEl, currentMode, selectMode);
    });

    historyButton.addEventListener("click", function () {
      historyEl.hidden = !historyEl.hidden;
      historyButton.setAttribute("aria-pressed", historyEl.hidden ? "false" : "true");
      calculatorEl.classList.toggle("history-open", !historyEl.hidden);
      drawerEl.hidden = true;
      navButton.setAttribute("aria-expanded", "false");
      if (!historyEl.hidden) renderHistoryList(historyListEl, calculator);
    });

    document.addEventListener("keydown", function (event) {
      if (event.ctrlKey && event.key === "h") {
        event.preventDefault();
        historyButton.click();
        return;
      }
      if (event.altKey && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        selectMode(MODES[Number(event.key) - 1].id);
        return;
      }
      if (event.key === "Escape" && !drawerEl.hidden) {
        drawerEl.hidden = true;
        navButton.setAttribute("aria-expanded", "false");
        return;
      }
      var action = mode && mode.resolveKey ? mode.resolveKey(event) : null;
      if (!action) return;
      event.preventDefault();
      press(action);
    });

    renderModes(modeListEl, currentMode, selectMode);
    selectMode("standard");
  }

  NS.ui = { start: start };

  if (typeof module !== "undefined") module.exports = NS.ui;
  else if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
