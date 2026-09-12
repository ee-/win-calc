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

  /* How a button reads its selected state: the active shift mode, the 2nd
   * toggle, and a set bit. The word-size control cycles rather than selecting
   * and the base rows mark the active base with aria-current (see
   * renderProgrammerReadout), so neither has a pressed state here. Actions
   * without one return null and the attribute is dropped. */
  function pressedState(action, calculator) {
    var parts = String(action).split(":");
    switch (parts[0]) {
      case "angle": return calculator.angleUnit === parts[1].toUpperCase();
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

  /* Date Calculation: the mode is a form, and the engine owns its calendar
   * arithmetic and live results. The shell renders the controls from the
   * mode's data and writes every change straight back to the engine, so a
   * result updates on each input (there is no Calculate button). */
  var DATE_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
  var datePanel = null;        // the element set start() wired up
  var dateCalendarMonth = null; // { year, month } the open calendar shows
  var dateCalendarField = null; // "from" | "to" the open calendar belongs to

  function renderDateOptions(select, mode) {
    select.textContent = "";
    for (var i = 0; i < mode.options.length; i++) {
      var option = document.createElement("option");
      option.value = mode.options[i].id;
      option.textContent = mode.options[i].label;
      select.appendChild(option);
    }
  }

  function renderDateDirections(container, mode) {
    container.textContent = "";
    for (var i = 0; i < mode.directions.length; i++) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "date-direction";
      button.textContent = mode.directions[i].label;
      button.dataset.action = "direction:" + mode.directions[i].id;
      container.appendChild(button);
    }
  }

  function renderDateUnits(container, mode) {
    container.textContent = "";
    for (var i = 0; i < mode.units.length; i++) {
      var unit = mode.units[i];
      var label = document.createElement("label");
      label.className = "date-unit";
      label.setAttribute("for", "date-unit-" + unit.id);
      var caption = document.createElement("span");
      caption.className = "date-unit-label";
      caption.textContent = unit.label;
      var input = document.createElement("input");
      input.type = "number";
      input.className = "date-unit-input";
      input.id = "date-unit-" + unit.id;
      input.min = "0";
      input.max = String(NS.engine.DATE_MAX_OFFSET);
      input.value = "0";
      input.dataset.unit = unit.id;
      label.appendChild(caption);
      label.appendChild(input);
      container.appendChild(label);
    }
  }

  /* The calendar: a month grid that appears from the field, navigates by
   * month, picks a date and clamps at the mode's bounds. */
  function renderDateCalendar(calculator) {
    var month = dateCalendarMonth;
    datePanel.calendarTitle.textContent =
      NS.engine.dateFormatMonthYear(NS.engine.dateMake(month.year, month.month, 1));
    datePanel.calendarPrev.disabled = month.year === NS.engine.DATE_MIN_YEAR && month.month === 1;
    datePanel.calendarNext.disabled = month.year === NS.engine.DATE_MAX_YEAR && month.month === 12;

    datePanel.calendarGrid.textContent = "";
    var first = NS.engine.dateMake(month.year, month.month, 1);
    var lead = NS.engine.dateWeekday(first);
    for (var blank = 0; blank < lead; blank++) {
      var spacer = document.createElement("span");
      spacer.className = "date-calendar-day is-blank";
      datePanel.calendarGrid.appendChild(spacer);
    }
    var days = NS.engine.dateDaysInMonth(month.year, month.month);
    var selected = dateCalendarField === "to" ? calculator.to : calculator.from;
    for (var day = 1; day <= days; day++) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "date-calendar-day";
      button.textContent = String(day);
      button.dataset.action = "pick:" + month.year + "-" + month.month + "-" + day;
      if (selected.year === month.year && selected.month === month.month && selected.day === day) {
        button.setAttribute("aria-selected", "true");
      }
      datePanel.calendarGrid.appendChild(button);
    }
  }

  function openDateCalendar(calculator, field) {
    var date = field === "to" ? calculator.to : calculator.from;
    dateCalendarField = field;
    dateCalendarMonth = { year: date.year, month: date.month };
    datePanel.calendar.hidden = false;
    datePanel.fromButton.setAttribute("aria-expanded", field === "from" ? "true" : "false");
    datePanel.toButton.setAttribute("aria-expanded", field === "to" ? "true" : "false");
    renderDateCalendar(calculator);
  }

  function closeDateCalendar() {
    if (!datePanel) return;
    dateCalendarField = null;
    dateCalendarMonth = null;
    datePanel.calendar.hidden = true;
    datePanel.fromButton.setAttribute("aria-expanded", "false");
    datePanel.toButton.setAttribute("aria-expanded", "false");
  }

  function shiftDateCalendar(calculator, months) {
    var month = dateCalendarMonth.month - 1 + months;
    var year = dateCalendarMonth.year + Math.floor(month / 12);
    var normalized = month - Math.floor(month / 12) * 12;
    if (year < NS.engine.DATE_MIN_YEAR || year > NS.engine.DATE_MAX_YEAR) return;
    dateCalendarMonth = { year: year, month: normalized + 1 };
    renderDateCalendar(calculator);
  }

  function refreshDate(calculator, mode) {
    datePanel.option.value = calculator.option;
    var isDifference = calculator.option === "difference";

    datePanel.fieldTo.hidden = !isDifference;
    datePanel.directions.hidden = isDifference;
    datePanel.units.hidden = isDifference;
    datePanel.resultLabel.textContent = isDifference
      ? mode.strings.difference
      : mode.strings.date;

    // Typed text belongs to the field the user is in; every other path (the
    // picker, the option switch) writes the engine's own rendering.
    if (document.activeElement !== datePanel.from) datePanel.from.value = calculator.fromText;
    if (document.activeElement !== datePanel.to) datePanel.to.value = calculator.toText;
    if (isDifference) {
      datePanel.fromButton.hidden = false;
      datePanel.toButton.hidden = false;
    } else {
      datePanel.fromButton.hidden = false;
      datePanel.toButton.hidden = true;
    }

    var directionButtons = datePanel.directions.querySelectorAll(".date-direction");
    for (var i = 0; i < directionButtons.length; i++) {
      var id = directionButtons[i].dataset.action.slice("direction:".length);
      directionButtons[i].setAttribute("aria-pressed", calculator.direction === id ? "true" : "false");
    }

    var unitInputs = datePanel.units.querySelectorAll(".date-unit-input");
    for (var j = 0; j < unitInputs.length; j++) {
      var unit = unitInputs[j].dataset.unit;
      if (document.activeElement !== unitInputs[j]) unitInputs[j].value = String(calculator.offset(unit));
    }

    datePanel.resultValue.textContent = calculator.result;
    datePanel.resultDays.textContent = calculator.resultInDays;
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

    /* Date Calculation's own state: the engine's date calculator, created once
     * so the From date survives switching between the two calculators. */
    var dateCalculator = new NS.engine.DateCalculator();
    datePanel = {
      panel: element("date-panel"),
      option: element("date-option"),
      settings: element("date-settings"),
      fieldTo: element("date-field-to"),
      fieldFrom: element("date-field-from"),
      from: element("date-from"),
      to: element("date-to"),
      fromButton: element("date-from-button"),
      toButton: element("date-to-button"),
      directions: element("date-directions"),
      units: element("date-units"),
      resultLabel: element("date-result-label"),
      resultValue: element("date-result-value"),
      resultDays: element("date-result-days"),
      calendar: element("date-calendar"),
      calendarTitle: element("date-calendar-title"),
      calendarPrev: element("date-calendar-prev"),
      calendarNext: element("date-calendar-next"),
      calendarGrid: element("date-calendar-grid"),
      calendarWeekdays: element("date-calendar-weekdays")
    };
    renderDateOptions(datePanel.option, NS.modes.date);
    renderDateDirections(datePanel.directions, NS.modes.date);
    renderDateUnits(datePanel.units, NS.modes.date);
    for (var weekday = 0; weekday < DATE_WEEKDAYS.length; weekday++) {
      var caption = document.createElement("span");
      caption.className = "date-calendar-weekday";
      caption.textContent = DATE_WEEKDAYS[weekday];
      datePanel.calendarWeekdays.appendChild(caption);
    }

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
      refreshDate(dateCalculator, NS.modes.date);
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
      // Date Calculation is a form, not a keypad: it replaces the display and
      // the keypad, and the reference's date view carries no memory row and
      // disables history, so both go away with it.
      var isDate = Boolean(definition && definition.options);
      datePanel.panel.hidden = !isDate;
      historyButton.hidden = isDate;
      if (isDate) {
        historyEl.hidden = true;
        historyButton.setAttribute("aria-pressed", "false");
        calculatorEl.classList.remove("history-open");
      }
      closeDateCalendar();
      if (isDate) {
        keypadEntries = [];
        keypadEl.hidden = true;
        keypadEl.textContent = "";
        placeholderEl.hidden = true;
      } else if (definition && definition.keypad) {
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

    /* The date form's own controls: every change goes to the engine and the
     * result is redrawn from it, which is what makes the update live. */
    function refreshDateOnly() {
      refreshDate(dateCalculator, NS.modes.date);
    }

    datePanel.option.addEventListener("change", function () {
      dateCalculator.setOption(datePanel.option.value);
      closeDateCalendar();
      refreshDateOnly();
    });

    datePanel.directions.addEventListener("click", function (event) {
      var button = event.target.closest(".date-direction");
      if (!button) return;
      dateCalculator.setDirection(button.dataset.action.slice("direction:".length));
      refreshDateOnly();
    });

    function bindDateField(field, input) {
      input.addEventListener("input", function () {
        if (dateCalculator.setDateText(field, input.value)) input.removeAttribute("aria-invalid");
        else input.setAttribute("aria-invalid", "true");
        refreshDateOnly();
      });
      // An unparsable entry reverts to the date the engine still holds, which
      // is the reference picker's reselect behaviour.
      input.addEventListener("blur", function () {
        input.removeAttribute("aria-invalid");
        input.value = field === "to" ? dateCalculator.toText : dateCalculator.fromText;
      });
    }
    bindDateField("from", datePanel.from);
    bindDateField("to", datePanel.to);

    datePanel.units.addEventListener("input", function (event) {
      var input = event.target.closest(".date-unit-input");
      if (!input) return;
      if (dateCalculator.setOffset(input.dataset.unit, input.value)) {
        input.removeAttribute("aria-invalid");
      } else {
        input.setAttribute("aria-invalid", "true");
      }
      refreshDateOnly();
    });
    datePanel.units.addEventListener("blur", function (event) {
      var input = event.target.closest(".date-unit-input");
      if (!input) return;
      input.removeAttribute("aria-invalid");
      input.value = String(dateCalculator.offset(input.dataset.unit));
    }, true);

    datePanel.fromButton.addEventListener("click", function () {
      if (dateCalendarField === "from") closeDateCalendar();
      else openDateCalendar(dateCalculator, "from");
    });
    datePanel.toButton.addEventListener("click", function () {
      if (dateCalendarField === "to") closeDateCalendar();
      else openDateCalendar(dateCalculator, "to");
    });

    datePanel.calendarPrev.addEventListener("click", function () {
      shiftDateCalendar(dateCalculator, -1);
    });
    datePanel.calendarNext.addEventListener("click", function () {
      shiftDateCalendar(dateCalculator, 1);
    });

    datePanel.calendarGrid.addEventListener("click", function (event) {
      var button = event.target.closest(".date-calendar-day");
      if (!button || !button.dataset.action) return;
      var parts = button.dataset.action.slice("pick:".length).split("-");
      var picked = NS.engine.dateMake(Number(parts[0]), Number(parts[1]), Number(parts[2]));
      dateCalculator.setDate(dateCalendarField, picked);
      closeDateCalendar();
      refreshDateOnly();
    });

    /* The calendar is a popup: a click outside it closes it. */
    document.addEventListener("click", function (event) {
      if (!dateCalendarField || datePanel.panel.hidden) return;
      if (event.target.closest("#date-calendar") ||
          event.target.closest("#date-from-button") ||
          event.target.closest("#date-to-button")) return;
      closeDateCalendar();
    });

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
        if (historyButton.hidden) return; // date view has no history
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
