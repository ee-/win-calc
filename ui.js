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

  /* Scientific's 2nd key toggles the functions that carry an alt layer
   * (sin -> sin-1 and the rest); the active angle unit reads as pressed, as
   * the real app shows it. */
  function applyKeypadState(calculator) {
    var second = calculator.mode === "scientific" && calculator.second;
    for (var i = 0; i < keypadEntries.length; i++) {
      var entry = keypadEntries[i];
      var key = entry.key;
      var layer = second && key.alt ? key.alt : key;
      entry.button.textContent = layer.label;
      entry.button.dataset.action = layer.action;
      entry.button.dataset.role = layer.role || key.role;
      entry.button.setAttribute("aria-label", layer.ariaLabel || layer.label);
      if (key.action === "second") {
        entry.button.setAttribute("aria-pressed", second ? "true" : "false");
      } else if (key.action.indexOf("angle:") === 0) {
        entry.button.setAttribute("aria-pressed",
          calculator.angleUnit === key.action.slice(6).toUpperCase() ? "true" : "false");
      }
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
      refresh();
    }

    keypadEl.addEventListener("click", function (event) {
      var key = event.target.closest(".key");
      if (key) press(key.dataset.action);
    });

    historyListEl.addEventListener("click", function (event) {
      var item = event.target.closest(".history-item");
      if (item) {
        calculator.setValue(parseFloat(item.dataset.value));
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
