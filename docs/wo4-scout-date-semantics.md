# WO-4 research slice — scout report (materialised fan-out output)

Saved verbatim by the WO-4 coder from the scout slice's returned report
(`DateCalcSemanticsScout`). The slice ran as the single read-only fan-out
worker named by the work order `/tmp/t001-wo4-research-brief.md`; it edited
nothing and ran no commands beyond reading/fetching. This file is the
materialised artifact the receipt's §8 cites as
`commit:docs/wo4-scout-date-semantics.md`.

---

# WO-4 Scout Report — Windows Calculator "Date Calculation" mode

All paths are repo-relative to `microsoft/calculator@main`. Fetch log at the bottom; every URL fetched succeeded.

---

## (a) FINDINGS

### 1. Difference between dates — exact algorithm

**Source:** `src/Calculator.ViewModels/Common/DateCalculator.cs`, `DateCalculationEngine.TryGetDateDifference` (starts line 133).

| # | Fact | Citation |
|---|------|----------|
| 1.1 | The engine itself ignores sign: if `date1 < date2` it sets `startDate=date1,endDate=date2`, else the reverse. Result is always a non-negative magnitude. | `DateCalculator.cs:137-145` |
| 1.2 | `pivotDate = startDate`; `daysDiff = (uint)GetDifferenceInDays(startDate,endDate)`. | `DateCalculator.cs:147-148` |
| 1.3 | Day difference is integer days of UTC ticks: `(date2.ToUniversalTime().Ticks - date1.ToUniversalTime().Ticks) / c_day`, `c_day = 24h`. Sub-day remainder is truncated. | `DateCalculator.cs:42, 235-238` |
| 1.4 | Multi-unit decomposition runs only when the requested format has any of Year/Month/Week: `if (((int)outputFormat & 7) != 0)`. `DateUnit.Day` = 0x08 so a Day-only request skips the whole greedy block and cannot fail. | `DateCalculator.cs:10-15, 151-152` |
| 1.5 | Unit estimates come from: `approximateDaysInYear = days in the **end** date's year`; `daysInMonth = days in the **start** date's month`; week = 7; day = 1. Array order is `{year, month, week, day}`. | `DateCalculator.cs:154-157` |
| 1.6 | Days-in-month = `_calendar.NumberOfDaysInThisMonth`; days-in-year = sum of `NumberOfDaysInThisMonth` across `NumberOfMonthsInThisYear`, walking from `FirstMonthInThisYear`. Either helper returns `false` on `-1`; if either fails the **whole multi-unit block is skipped** (Y/M/W stay 0, only Day is filled) — it does **not** return null. | `DateCalculator.cs:154-155, 243-274` |
| 1.7 | Greedy largest-unit-first: for `unitIndex` 0,1,2 (= Year, Month, Week) it computes `N = daysDiff / daysIn[unitIndex]`. | `DateCalculator.cs:159-167` |
| 1.8 | If `N != 0`, it tries `pivotDate = AdjustCalendarDate(tempPivotDate, unit, N)`; on `ArgumentException` (day-based estimate overshot the calendar upper bound) it decrements `N` and retries until success or `N == 0`. | `DateCalculator.cs:169-183` |
| 1.9 | Pivot-adjust loop: `tempDaysDiff = days(pivot, endDate)`. If `< 0`: **`if (N == 0) return null;`** (line 193), else decrement `N`, reset pivot to `tempPivotDate` adjusted by the new N, set `isEndDateHit = true`. If `> 0`: if `isEndDateHit` break; else try adjusting `tempPivotDate` by `N+1` and increment `N`, breaking on `ArgumentException` (“current pivot is valid; finish with smaller units”). Loop repeats while `tempDaysDiff != 0`. | `DateCalculator.cs:186-215` |
| 1.10 | After the loop, `signedDaysDiff = days(pivot,end)`; **`if (signedDaysDiff < 0) return null;`** (line 217); else `daysDiff = signedDaysDiff` and the next (smaller) unit continues from the new daysDiff. | `DateCalculator.cs:216-219` |
| 1.11 | The only two `return null` statements in `TryGetDateDifference` are lines 193 and 217 — both multi-unit paths. | `DateCalculator.cs:193, 217` |
| 1.12 | The leftover is stored in slot 3: `differenceInDates[3] = daysDiff` and returned as `Day`. Units not requested in the mask stay 0, and their remainder flows into `Day` (e.g. requesting `Week|Day` yields `{W, D}`; requesting `Year|Month` leaves `Day` = remaining days). | `DateCalculator.cs:224-232` |
| 1.13 | `AdjustCalendarDate` uses the engine's single shared `_calendar` (set to the configured calendar system, UTC), converts Japanese→Gregorian for math, and restores the system in a `finally` if it changed. | `DateCalculator.cs:67-70, 276-311` |
| 1.14 | `DateDifferenceUnknown` is the sentinel `{int.MinValue ×4}` compared by value elsewhere in the VM. | `DateCalculator.cs:53-56` |

**Output formats the UI passes** (`src/Calculator.ViewModels/DateCalculatorViewModel.cs`, `InitializeDateOutputFormats`, line 287):

| Fact | Citation |
|------|----------|
| `_allDateUnitsOutputFormat = Year | Month | Week | Day` — the UI **does** ask for weeks in the breakdown line. | `DateCalculatorViewModel.cs:289` |
| `_daysOutputFormat = Day` — used for the secondary total-days line. | `DateCalculatorViewModel.cs:290` |
| Difference path calls `TryGetDateDifference(clippedFrom, clippedTo, _daysOutputFormat)` first, then `…_allDateUnitsOutputFormat`; the all-units result falls back to the day-only result via `??`. | `DateCalculatorViewModel.cs:186-194` |
| Inputs are `ClipTime(...)`d (midnight, offset `TimeSpan.Zero`) before diffing, so time-of-day and original offset are discarded for difference. | `DateCalculatorViewModel.cs:186-187, 334-341` |
| If the day call has no value, both results become `DateDifferenceUnknown`; but with `_daysOutputFormat == Day` the engine returns a value unconditionally (1.4), so this is a defensive path (see not-settled #7). | `DateCalculatorViewModel.cs:196-200` |

### 2. Difference result strings

**Source:** `DateCalculatorViewModel.UpdateDisplayResult` (line 229), `GetDateDiffString` (300), `GetDateDiffStringInDays` (320).

| Fact | Citation |
|------|----------|
| Branch order: (1) `_dateDiffResultInDays == Unknown` → `IsDiffInDays=false`, secondary empty, main = `"Calculation failed"`; (2) `_dateDiffResultInDays.Day == 0` → `IsDiffInDays=true`, secondary empty, main = `"Same dates"`; (3) `_dateDiffResult == Unknown` **or** `Year==0 && Month==0 && Week==0` → `IsDiffInDays=true`, secondary empty, main = day-only string; (4) otherwise `IsDiffInDays=false`, main = `GetDateDiffString()`, secondary = `GetDateDiffStringInDays()`. | `DateCalculatorViewModel.cs:231-257` |
| Units are emitted only when `> 0` (zero units omitted); singular when the value is exactly 1 (`Date_Year/Month/Week/Day`), plural otherwise (`Date_Years/Months/Weeks/Days`). | `DateCalculatorViewModel.cs:304-315` |
| Day is emitted when `Day > 0 || parts.Count == 0` — the `parts.Count == 0` escape is unreachable from branch (4) (that case is caught by branch 3). | `DateCalculatorViewModel.cs:313-315, 239-251` |
| Join separator is exactly `LocalizationSettings.GetListSeparator() + " "` (i.e. `", "` for en-US: locale list separator plus a space). | `DateCalculatorViewModel.cs:98, 317`; `LocalizationSettings.cs:72, 150, 451-456` |
| Numbers are localized via `LocalizeDisplayValue` (no-op for en-US digits). | `DateCalculatorViewModel.cs:326-331`; `LocalizationSettings.cs:377-380` |
| Secondary line string is always `<N> day|days`. | `DateCalculatorViewModel.cs:320-324` |
| `IsDiffInDays` means “the result is expressible purely in days”, so the secondary total-days line is **hidden** when true. XAML: secondary TextBlock uses `BooleanToVisibilityNegationConverter` on `IsDiffInDays`. | `DateCalculatorViewModel.cs:111-115`; `DateCalculator.xaml:1094-1099` |
| Automation name for the difference result = resource `Date_DifferenceResultAutomationName` (`"Difference %1"`) with `%1` = main string. | `DateCalculatorViewModel.cs:276-279`; `Resources.resw:2990-2993` |
| en-US resources: `Date_Year`=year, `Date_Years`=years, `Date_Month`=month, `Date_Months`=months, `Date_Week`=week, `Date_Weeks`=weeks, `Date_Day`=day, `Date_Days`=days, `Date_SameDates`=Same dates, `CalculationFailed`=Calculation failed, `Date_DifferenceLabel`=Difference, `DateLabel`=Date. | `Resources.resw:2935-2938, 2963-2989, 3522-3525, 2923-2926` |

### 3. Add / subtract — exact algorithm

**Source:** `DateCalculator.cs:73-98` (`AddDuration`), `:100-131` (`SubtractDuration`).

| Fact | Citation |
|------|----------|
| Both call `_calendar.SetDateTime(startDate)`. The calendar was created with `ChangeTimeZone("UTC")`, so the date math is done on the **UTC** representation of the instant. | `DateCalculator.cs:67-70, 78, 105` |
| Add applies **larger units first**: `AddYears`, then `AddMonths`, then `AddDays` (each skipped when 0). | `DateCalculator.cs:86-88` |
| Subtract applies **smaller units first**: `AddDays(-Day)`, then `AddMonths(-Month)`, then `AddYears(-Year)`; the code comments this explicitly. | `DateCalculator.cs:112-115` |
| Add returns `_calendar.GetDateTime()` with no lower-bound check (only the calendar's own range applies). | `DateCalculator.cs:90-91` |
| Subtract returns the date only if `dateTime.ToUniversalTime() >= s_minSupportedDate` where `s_minSupportedDate = 1601-01-01T00:00:00Z` (comment: Windows.Foundation.DateTime/FILETIME epoch floor, distinct from `DateTimeOffset.MinValue` = year 1); otherwise `null`. | `DateCalculator.cs:48-51, 119-124` |
| Both wrap the body in `try { … } catch (ArgumentException) { _calendar = CreateCalendar(currentCalendarSystem); return null; }` — this is the out-of-range/overflow path, and it also resets the shared calendar so the engine stays usable. | `DateCalculator.cs:76-97, 103-130` |
| Japanese calendar: both convert to Gregorian before the arithmetic and back afterwards. | `DateCalculator.cs:80-84, 107-111` |
| Engine `DateDifference` supports `Week` (`DateUnit.Week`) but `AddDuration`/`SubtractDuration` **never apply it**; only `AdjustCalendarDate` (difference path) handles weeks. | `DateCalculator.cs:14, 86-88, 113-115, 300` |
| UI offsets are `YearsOffset`, `MonthsOffset`, `DaysOffset` only; no week offset. ViewModel order passed to the engine is `{Year=YearsOffset, Month=MonthsOffset, Day=DaysOffset}`. | `DateCalculatorViewModel.cs:205-214`; `DateCalculator.xaml:1175-1213` |
| Direction radio: `IsAddMode` picks `AddDuration` vs `SubtractDuration`. | `DateCalculatorViewModel.cs:212-214` |
| Out-of-bound condition: on `null` result the VM sets `_isOutOfBound = true` (reset to false at the start of every add/sub recompute) and `StrDateResult` = `Date_OutOfBoundMessage` (`"Date out of Bound"`); otherwise `StrDateResult` = longdate-formatted result. | `DateCalculatorViewModel.cs:204, 216-224, 262-270`; `Resources.resw:2959-2962` |
| Result automation name = `Date_ResultingDateAutomationName` (`"Resulting date %1"`) even when the message is the out-of-bound text. | `DateCalculatorViewModel.cs:283-286`; `Resources.resw:2994-2997` |
| Offsets are combo boxes 0..999 (`MaxOffsetValue = 999`, list `0..999` localized), bound two-way to `SelectedIndex` — there are no negative offsets; direction comes only from the radio. | `DateCalculatorViewModel.cs:17, 102-109, 117`; `DateCalculator.xaml:1181, 1197, 1212` |
| Labels: `YearsLabel`=Years, `MonthsLabel`=Months, `DaysLabel`=Days, `AddOption`=Add, `SubtractOption`=Subtract, `AddSubtract_Date_FromHeader`=From. | `Resources.resw:2931-2934, 2943-2950, 2955-2958, 3510-3513`; `DateCalculator.xaml:1170-1213, 1137-1152, 1129` |

**Reference's own month-end/leap clamping vectors** (see vectors section): `2008-01-31 + 1 month = 2008-02-29` (`DateCalculatorTests.cs:62-64, 97`), `2008-03-31 + (1 month, 10 days) = 2008-05-10` (`:98`), `2008-03-31 − 1 month = 2008-02-29` (`:102`), `2008-03-10 − (1 month, 10 days) = 2008-01-29` (`:103`).

### 4. The reference's own test vectors and UI tests

**`src/Calculator.Tests/DateCalculatorTests.cs`** — the same fixture is duplicated in `DateCalculatorUnitTests` (table setup lines 44-104) and `DateCalculatorViewModelTests` (lines 270-330).

| Fact | Citation |
|------|----------|
| `UnitsPresentIn(DateDifference)` builds the request mask from **which fields of the expected struct are non-zero**, so each difference case is asserted with exactly the units its expectation names. | `DateCalculatorTests.cs:173-182` |
| `TestDateDiff` normalizes the pair itself (`earlier`/`later`) before calling the engine and asserts all four fields. | `DateCalculatorTests.cs:108-127` |
| `TestAddOob` / `TestSubtractOob` assert `null`. | `DateCalculatorTests.cs:184-209` |
| `TestAddition` / `TestSubtraction` assert the exact resulting `DateTimeOffset` (midnight, offset zero). | `DateCalculatorTests.cs:212-240` |
| VM tests assert display strings in en-US: `"Same dates"`, `"1 month, 2 days"` + `"31 days"`, `"1 day"`, `"1 week"`, `"10 months"` + `"305 days"`, `"7991 years, 11 months"` + `"2918987 days"`, `"Date out of Bound"`, and automation strings. | `DateCalculatorTests.cs:350, 393-394, 401, 406, 478, 525-526, 546-552, 568, 599, 614, 630` |
| Defaults asserted: `IsDateDiffMode`, `IsAddMode`, non-default From/To/Start, offsets 0, `IsDiffInDays`, `StrDateDiffResult == "Same dates"`, secondary empty, `StrDateResult` empty (diff mode) / non-empty (add mode). | `DateCalculatorTests.cs:334-378` |
| Non-Gregorian/era cases exist (Japanese era transitions, UmAlQura at its range limit, calendar-system recovery). | `DateCalculatorTests.cs:634-720` |

**UI tests / framework (`src/CalculatorUITests`, `src/CalculatorUITestFramework`)** — there is **no** Date Calculation page object and **no** dedicated Date Calculation functional test:

| Fact | Citation |
|------|----------|
| Directory listings contain no `*Date*` files. | GitHub tree listings for both dirs |
| `NavigationMenu` can switch to `CalculatorMode.DateCalculator` via accessibility id `"Date"`. | `NavigationMenu.cs:15, 49, 74-81` |
| `CalculatorApp` exposes only `Header`/`AppName`/focus helpers; no date-specific accessors. | `CalculatorApp.cs` (whole file) |
| The only date-mode assertion is `ChangeCalculatorMode(DateCalculator)` → `GetCalculatorHeaderText() == "Date calculation"` plus `IsKeepOnTopButtonPresent() == false`. | `StandardModeFunctionalTests.cs:733-736` |
| Greps for `DateCalc|Date calculation` in Scientific/Programmer/History/Memory UI tests: no matches. | per-file greps (see fetch log) |

So: defaults-to-today, live update, picker behaviour and label assertions are **not** covered by the reference's UI tests; they are covered (partly) by the VM unit tests above.

### 5. Date pickers

**Source:** `src/Calculator/Views/DateCalculator.xaml.cs` and `DateCalculator.xaml`; Windows docs.

| Fact | Citation |
|------|----------|
| Min date = 1 Jan **1601**, built by setting the Gregorian calendar to `c_minYear`; applied to `DateDiff_FromDate.MinDate` and `DateDiff_ToDate.MinDate`. | `DateCalculator.xaml.cs:60-68` |
| Max date = 31 Dec **`c_maxYear` = 2550**; applied to both diff pickers. The code comment says they would like 9999 but `CalendarDatePicker` clips “just after 2558”, pending MSFT-9273247. | `DateCalculator.xaml.cs:70-75, 263-267` |
| The inline comment on line 73 is stale/incorrect: `var maxYear = calendar.GetDateTime(); // 31st December, 9878` while `c_maxYear` is 2550. | `DateCalculator.xaml.cs:72-73, 267` |
| `DateFormat = "day month year"` on both diff pickers, and again on the add/sub picker in its `Loaded` handler. | `DateCalculator.xaml.cs:83-84, 216` |
| Placeholder text = the same formatter output for **today**: `GetRegionalSettingsAwareDateTimeFormatter("day month year", calendarIdentifier, TwentyFourHour).Format(today)`, assigned to both diff pickers; the add/sub picker copies it on `Loaded`. | `DateCalculator.xaml.cs:77-89, 207-209` |
| Both diff pickers get `CalendarIdentifier`, `FirstDayOfWeek`, `Language` (explicit `Language` documented in-code as a workaround for non-Gregorian display). | `DateCalculator.xaml.cs:38-56` |
| The add/sub picker is created lazily (`x:DeferLoadStrategy="Lazy"`); `DateCalcOption_Changed` calls `FindName("AddSubtractDateGrid")` to force loading before it touches it. | `DateCalculator.xaml:1103-1105`; `DateCalculator.xaml.cs:183` |
| Calendar flyout structure (custom `CalendarDatePicker` template): a `Flyout` with `CalendarView` bound to the picker's `CalendarIdentifier`/`DisplayMode`/`FirstDayOfWeek`/`IsGroupLabelVisible`/`IsOutOfScopeEnabled`/`IsTodayHighlighted`/**`MaxDate`**/**`MinDate`**; the `CalendarView` template contains a header `Button` (`HasMoreViews`), `PreviousButton`/`NextButton` (`HasMoreContentBefore`), weekday-name row (`WeekDay1..7`), and `MonthView`/`YearView`/`DecadeView` each with a `CalendarPanel`. | `DateCalculator.xaml:257-271, 807-941` |
| Date text element is `DateText`, template-initially `Text="{TemplateBinding PlaceholderText}"`; the design doc states the entry point shows the placeholder when no date is set and the chosen date otherwise. | `DateCalculator.xaml:297-305`; [calendar date picker design doc] |
| Setting `Date` in code is clamped: smaller than MinDate → MinDate; greater than MaxDate → MaxDate. Applies to the `DateCalcOption_Changed` copy. | [CalendarDatePicker class docs, "Selecting dates"] |
| Null/unparsable path: each `DateChanged` handler with `e.NewDate == null` calls `ReselectCalendarDate(sender, e.OldDate.Value)`, which re-sets `calendarDatePicker.Date = oldDate` and closes the flyout — i.e. the picker is forced back to its previous value, never left null. (`e.OldDate.Value` would throw if OldDate were also null; not guarded.) | `DateCalculator.xaml.cs:118-158, 226-231` |
| Docs attribute a null `Date` to the user **deselecting** the current date in the calendar view, not to typed garbage. | [CalendarDatePicker class docs, "Selecting dates"] |
| `Closed` on every picker raises a live-region automation event on the result label (`IsDateDiffMode` selects which label). | `DateCalculator.xaml:1066, 1076, 1128`; `DateCalculator.xaml.cs:240-260` |
| Typed-format acceptance: `DateFormat` is documented only as “the display format for the date value in the picker's text box”; the calculator source sets it and nothing else. | [CalendarDatePicker.DateFormat docs]; see not-settled #2 |

### 6. Mode structure and behaviour

| Fact | Citation |
|------|----------|
| Option combo `DateCalculationOption`, default `SelectedIndex="0"`, two items `MinWidth=276`: item 0 = `Date_DifferenceOption/Content` ("Difference between dates") two-way bound to `IsDateDiffMode`; item 1 = `Date_AddSubtractOption/Content` ("Add or subtract days") bound to its negation. | `DateCalculator.xaml:1004-1043`; `Resources.resw:2919-2930` |
| The combo's automation name is the resource `DateCalculationOption.[…]AutomationProperties.Name` = **"Calculation mode"**. | `DateCalculator.xaml:1009`; `Resources.resw:2911-2913` |
| Two mutually exclusive panes: `DateDiffGrid` visible when `IsDateDiffMode` (converter), `AddSubtractDateGrid` visible when not (negated converter); the latter is defer-loaded. | `DateCalculator.xaml:1046-1048, 1103-1106` |
| Difference pane controls: `CalendarDatePicker` From (`DateDiff_FromDate`, Header "From"), To (`DateDiff_ToDate`, Header "To"), caption "Difference", result TextBlock `DateDiffAllUnitsResultLabel`, secondary TextBlock. | `DateCalculator.xaml:1062-1099`; `Resources.resw:2935-2938, 2939-2942, 2951-2954` |
| Add/subtract pane controls: `CalendarDatePicker` From (`AddSubtract_FromDate`, Header "From"), two `RadioButton`s `AddOption`/`SubtractOption` (MinWidth 80/MaxWidth 160, no `GroupName` → same-parent default group), `YearsValue`/`MonthsValue`/`DaysValue` combos with labels Years/Months/Days, caption "Date", result `DateResultLabel`. | `DateCalculator.xaml:1122-1230`; `Resources.resw:2915-2918, 2923-2926, 2931-2934, 2943-2950, 2955-2958, 3510-3513` |
| **No Calculate button anywhere.** Every input property change triggers recompute: `OnPropertyChanged` → `HandlePropertySideEffects` → `OnInputsChanged()` for `IsDateDiffMode`, `IsAddMode`, `DaysOffset`, `MonthsOffset`, `YearsOffset`, `FromDate`, `ToDate`, `StartDate`. | `DateCalculatorViewModel.cs:165-227` |
| Defaults: `IsDateDiffMode = true`, `IsAddMode = true`, all offsets 0; `From = To = ClipTime(today)`, `StartDate = today` (unclipped), `_dateResult = today`; initial `UpdateDisplayResult()` produces "Same dates". | `DateCalculatorViewModel.cs:69-74, 91-100` |
| From-date persistence across option switches: `DateCalcOption_Changed` (also wired manually in the ctor) returns early when the source picker's `Date` is null; switching **to** Difference copies `AddSubtract_FromDate.Date → DateDiff_FromDate.Date`; switching **away** copies `DateDiff_FromDate.Date → AddSubtract_FromDate.Date`. | `DateCalculator.xaml.cs:92, 181-205` |
| Resulting-date formatting: `DateTimeFormatter("longdate", [Language.CurrentInputMethodLanguageTag], GeographicRegion().CodeTwoLetter ?? "US", calendarIdentifier, ClockIdentifiers.TwentyFourHour)`; rendered with `_dateTimeFormatter?.Format(_dateResult) ?? _dateResult.ToString()`. | `DateCalculatorViewModel.cs:287-297, 269` |
| en-US `longdate` renders like `Monday, September 2, 2013` (equivalent pattern `{dayofweek.full}, {month.full} {day.integer}, {year.full}`); the clock identifier only affects time parts and `longdate` has none, so 24-hour is irrelevant to this output. | [DateTimeFormatter docs, template sample table] |
| Scroll/flyout helpers: `CloseCalendarFlyout()` closes any open picker; `SetDefaultFocus()` focuses the option combo. | `DateCalculator.xaml.cs:95-116` |
| Copy affordance is menu-only: a `MenuFlyout` resource `ResultsContextMenu` with one `MenuFlyoutItem` `CopyMenuItem` (`Content` from `copyMenuItem` = "Copy", `Icon="Copy"`) is the `ContextFlyout` of the result TextBlocks; click copies `((TextBlock)ResultsContextMenu.Target).Text`. A `RelayCommand OnCopy` also exists on the VM but is not what the XAML menu invokes. | `DateCalculator.xaml:950-955, 1091, 1096, 1228`; `DateCalculator.xaml.cs:161-166`; `DateCalculatorViewModel.cs:149-158`; `Resources.resw:164-166` |
| Live-region announcements on picker close / radio check / offset dropdown close. | `DateCalculator.xaml.cs:207-260` |
| Mode entry: nav accelerator Alt+5 (`VirtualKey = Number5`, `AccessKey = "5"`) and a Ctrl+E accelerator set on the NavigationView. | `NavCategory.cs:251, 361`; `MainPage.xaml.cs:367-368` |

### 7. Memory / history in the mode

| Fact | Citation |
|------|----------|
| The Date Calculation view tree contains **no** memory or history controls (no `Memory`/`History` identifiers anywhere in `DateCalculator.xaml`). | grep over `DateCalculator.xaml` |
| Memory and History UI live entirely inside the `Calculator` control (memory buttons `ClearMemoryButton`/`MemRecall`/`MemPlus`/`MemMinus`/`MemoryButton`, docked History/Memory pivot). | `Calculator.xaml:739-807, 1385-1401`; `Calculator.xaml.cs:317-348, 864-874` |
| In Date mode MainPage sets `m_calculator.Visibility = Collapsed` **and** `m_calculator.IsEnabled = false` (and the inverse for `m_dateCalculator`). | `MainPage.xaml.cs:459-478` |
| On entering a date-calc mode MainPage sets `CalculatorViewModel.HistoryVM.AreHistoryShortcutsEnabled = false` (if the VM exists) and `EnsureDateCalculator()` closes both the history and memory flyouts. | `MainPage.xaml.cs:305-311, 613-628` |
| History flag is consumed by history operations (`ClearHistory`/clear items and return-to-history behaviour guard on it). | `HistoryViewModel.cs:40, 93-96` |
| Memory shortcuts are attached chords on the Calculator control's buttons (`VirtualKeyControlChord` on `ClearMemoryButton` etc.) and `KeyboardShortcutManager` invokes a chord only when `button.Target is ButtonBase btn && btn.IsEnabled`; with the Calculator control disabled in Date mode those targets are disabled. | `Calculator.xaml:741`; `KeyboardShortcutManager.cs:30-33, 80-95` |
| Nav shortcuts are cleared/restored by mode switches via `KeyboardShortcutManager.DisableShortcuts(false)` at the top of `OnAppPropertyChanged`; converters hidden+disabled. | `MainPage.xaml.cs:272-273, 313-321` |
| Result of the mode switch is testable: the only UI test for Date mode additionally asserts the Keep-On-Top button is absent. | `StandardModeFunctionalTests.cs:735-736` |

### 8. Mode title and labels (en-US)

| Resource | en-US value | Citation |
|---|---|---|
| `DateCalculationModeText` | **Date calculation** — nav/mode title (`NavCategory` CategoryManifest `ViewMode.Date` uses `NameResourceKey = "DateCalculationMode"`, and `GetNameResourceKey` appends `"Text"`) | `Resources.resw:2908-2910`; `NavCategory.cs:251, 350-353` |
| `HeaderAutomationName_Date` | **Date calculation mode** — used as the header automation name when the mode header is focused | `Resources.resw:3006-3008`; `MainPage.xaml.cs:137-139` |
| `DateCalculationOption.[…]AutomationProperties.Name` | **Calculation mode** (combo automation label; users hear "Calculation mode combobox") | `Resources.resw:2911-2913` |
| `Date_DifferenceOption.Content` | Difference between dates | `Resources.resw:2927-2929` |
| `Date_AddSubtractOption.Content` | Add or subtract days | `Resources.resw:2919-2921` |
| `DateDiff_FromHeader.Header` / `DateDiff_ToHeader.Header` | From / To | `Resources.resw:2939-2942, 2951-2954` |
| `AddSubtract_Date_FromHeader.Header` | From | `Resources.resw:3510-3513` |
| `Date_DifferenceLabel.Text` / `DateLabel.Text` | Difference / Date | `Resources.resw:2935-2938, 2923-2926` |
| `YearsLabel` / `MonthsLabel` / `DaysLabel` | Years / Months / Days | `Resources.resw:2955-2958, 2943-2946, 2931-2934` |
| `AddOption.Content` / `SubtractOption.Content` | Add / Subtract | `Resources.resw:2915-2918, 2947-2950` |
| `Date_OutOfBoundMessage` | Date out of Bound | `Resources.resw:2959-2962` |
| `Date_SameDates` / `CalculationFailed` / `copyMenuItem` | Same dates / Calculation failed / Copy | `Resources.resw:2975-2977, 3522-3525, 164-166` |
| `Date_DifferenceResultAutomationName` / `Date_ResultingDateAutomationName` | Difference %1 / Resulting date %1 | `Resources.resw:2990-2997` |
| `Date_Year(s)`, `Date_Month(s)`, `Date_Week(s)`, `Date_Day(s)` | year(s), month(s), week(s), day(s) | `Resources.resw:2963-2989` |

---

## (b) VECTORS (copy-ready; each states its output format)

### B1. Engine difference — output format: `{ Year, Month, Week, Day }` (all other fields 0 unless stated). Request mask = units named by the reference's `UnitsPresentIn`.

| # | earlier → later | requested mask | expected fields | Citation |
|---|---|---|---|---|
| E1 | 1601-01-01 → 9999-12-31 | `Year|Month|Day` | `{Year:8398, Month:11, Week:0, Day:30}` | `DateCalculatorTests.cs:78, 144-155` |
| E2 | 1601-01-01 → 9998-12-31 | `Year|Month|Day` | `{Year:8397, Month:11, Week:0, Day:30}` | `DateCalculatorTests.cs:158-170` |
| E3 | 9998-12-31 → 9999-12-31 | `Day` | `{Year:0, Month:0, Week:0, Day:365}` | `DateCalculatorTests.cs:79, 62-65` |
| E4 | 9998-12-31 → 9999-12-31 | `Year` | `{Year:1, Month:0, Week:0, Day:0}` | `DateCalculatorTests.cs:80, 131-141` |
| E5 | 9998-12-31 → 9999-12-31 | `Week|Day` | `{Year:0, Month:0, Week:52, Day:1}` | `DateCalculatorTests.cs:81, 64` |
| E6 | 2008-02-29 → 2008-03-31 | `Month|Day` | `{Year:0, Month:1, Week:0, Day:2}` | `DateCalculatorTests.cs:82, 63` |
| E7 | 2008-02-29 → 2008-03-31 | `Day` | `{Year:0, Month:0, Week:0, Day:31}` | `DateCalculatorTests.cs:83, 66` |
| E8 | 2007-02-28 → 2008-01-29 | `Month|Day` | `{Year:0, Month:11, Week:0, Day:1}` | `DateCalculatorTests.cs:84, 67` |
| E9 | 2008-01-31 → 9999-12-31 | `Year|Month` | `{Year:7991, Month:11, Week:0, Day:0}` | `DateCalculatorTests.cs:85, 68` |
| E10 | 2008-01-31 → 9999-12-31 | `Week|Day` | `{Year:0, Month:0, Week:416998, Day:1}` | `DateCalculatorTests.cs:86, 69` |
| E11 | 1989-01-07 → 1989-01-08, JapaneseCalendar | `Day` | `{Day:1}` | `DateCalculatorTests.cs:657-671` |
| E12 | 2019-04-30 → 2019-05-01, JapaneseCalendar | `Day` | `{Day:1}` | `DateCalculatorTests.cs:668-671` |
| E13 | 2075-01-01 → 2077-11-16, UmAlQuraCalendar | `Year|Month|Day` | `{Year:2, Month:11, Week:0, Day:16}` | `DateCalculatorTests.cs:690-703` |

### B2. Engine add/subtract — output format: `DateTimeOffset` (midnight, offset `+00:00`) or `null`.

| # | op | start | duration | expected | Citation |
|---|---|---|---|---|---|
| A1 | add | 2008-01-31 | `{Month:1}` | 2008-02-29 | `DateCalculatorTests.cs:97, 62-64` |
| A2 | add | 2008-03-31 | `{Month:1, Day:10}` | 2008-05-10 | `DateCalculatorTests.cs:98, 63` |
| A3 | add | 2008-01-31 | `{Month:1, Day:10}` | 2008-03-10 | `DateCalculatorTests.cs:99, 63` |
| A4 | add | 1989-01-07, JapaneseCalendar | `{Day:1}` | 1989-01-08 | `DateCalculatorTests.cs:634-643` |
| S1 | subtract | 2008-03-31 | `{Month:1}` | 2008-02-29 | `DateCalculatorTests.cs:102, 62-64` |
| S2 | subtract | 2008-03-10 | `{Month:1, Day:10}` | 2008-01-29 (proves day-before-month order) | `DateCalculatorTests.cs:103, 63` |
| S3 | subtract | 2007-03-10 | `{Month:1, Day:10}` | 2007-01-28 | `DateCalculatorTests.cs:104, 63` |
| S4 | subtract | 1989-01-08, JapaneseCalendar | `{Day:1}` | 1989-01-07 | `DateCalculatorTests.cs:646-654` |
| O1 | add | 9999-12-30 | `{Day:2}` | `null` | `DateCalculatorTests.cs:89, 64, 184-194` |
| O2 | add | 9998-12-31 | `{Year:2008}` | `null` | `DateCalculatorTests.cs:90, 68, 184-194` |
| O3 | subtract | 1601-01-01 | `{Day:2}` | `null` (below the 1601-01-01 floor) | `DateCalculatorTests.cs:93, 64, 197-209` |
| O4 | subtract | 2008-03-31 | `{Year:2008}` | `null` | `DateCalculatorTests.cs:94, 68, 197-209` |
| O5 | subtract | 1900-01-01, JapaneseCalendar | `{Year:100}` | `null`, and a second identical call after the failure also returns `null` (calendar recovers) | `DateCalculatorTests.cs:674-687` |

### B3. ViewModel display strings — output format: en-US string for `StrDateDiffResult` (main), `StrDateDiffResultInDays` (secondary, `""` = intentionally empty/hidden), `IsDiffInDays`.

| # | From → To | `StrDateDiffResult` | `StrDateDiffResultInDays` | `IsDiffInDays` | Citation |
|---|---|---|---|---|---|
| V1 | today → today (default ctor) | `"Same dates"` | `""` | `true` | `DateCalculatorTests.cs:350-351` |
| V2 | 2008-02-29 → 2008-03-31 | `"1 month, 2 days"` | `"31 days"` | `false` | `DateCalculatorTests.cs:393-394` |
| V3 | 2019-03-10 → 2019-03-11 (DST forward) | `"1 day"` | `""` | `true` | `DateCalculatorTests.cs:400-401` |
| V4 | 2019-03-10 → 2019-03-17 | `"1 week"` | `"7 days"` [INFERENCE: secondary shown because IsDiffInDays false; value from algorithm] | `false` | `DateCalculatorTests.cs:404-406` |
| V5 | 2019-11-03 → 2019-11-04 (DST back) | `"1 day"` | `""` | `true` | `DateCalculatorTests.cs:411-413` |
| V6 | 2007-05-10 → 2008-03-10 | `"10 months"` | `"305 days"` | `false` | `DateCalculatorTests.cs:524-526` |
| V7 | 2008-03-10 → 2007-05-10 (reversed) | `"10 months"` | `"305 days"` | `false` | `DateCalculatorTests.cs:531-533` |
| V8 | 2008-01-31 → 9999-12-31 | `"7991 years, 11 months"` | `"2918987 days"` | `false` | `DateCalculatorTests.cs:546-554` |
| V9 | 9999-12-30 → 9999-12-31 | `"1 day"` | `""` | `true` | `DateCalculatorTests.cs:567-569` |
| V10 | 9999-12-31 → 9999-12-30 (reversed) | `"1 day"` | `""` | `true` | `DateCalculatorTests.cs:598-600` |
| V11 | 2024-03-01T00:00+02:00 → 2024-04-01T00:00+02:00 | `"1 month"` | `"31 days"` [INFERENCE: secondary shown] | `false` | `DateCalculatorTests.cs:604-614` |
| V12 | automation name, any diff | `StrDateDiffResultAutomationName == "Difference " + StrDateDiffResult` | — | — | `DateCalculatorTests.cs:582-585` |

Pluralization rule to encode: `1` → `day|month|week|year`; `>1` → `days|months|weeks|years`; zero-valued units omitted; separator `", "`.

### B4. ViewModel add/subtract result — output format: en-US longdate string (`{dayofweek.full}, {month.full} {day.integer}, {year.full}`), from `StrDateResult`.

| start | offset | direction | `StrDateResult` | Citation for the date / for the format |
|---|---|---|---|---|
| 2008-01-31 | 1 month | Add | `"Friday, February 29, 2008"` | date `DateCalculatorTests.cs:417-437, 97`; format [DateTimeFormatter docs sample] |
| 2008-03-31 | 1 month + 10 days | Add | `"Saturday, May 10, 2008"` | `DateCalculatorTests.cs:98, 323-325` |
| 2008-01-31 | 1 month + 10 days | Add | `"Monday, March 10, 2008"` | `DateCalculatorTests.cs:99` |
| 2008-03-31 | 1 month | Subtract | `"Friday, February 29, 2008"` | `DateCalculatorTests.cs:439-457, 102` |
| 2008-03-10 | 1 month + 10 days | Subtract | `"Tuesday, January 29, 2008"` | `DateCalculatorTests.cs:103, 329` |
| 2007-03-10 | 1 month + 10 days | Subtract | `"Sunday, January 28, 2007"` | `DateCalculatorTests.cs:104, 330` |
| 9999-12-30 | 2 days | Add | `"Date out of Bound"` (not a date) | `DateCalculatorTests.cs:478`; `Resources.resw:2959-2962` |
| 2008-03-31 | 2008 years | Subtract | `"Date out of Bound"` | `DateCalculatorTests.cs:509` |

Clock rendering: the app builds the formatter with `ClockIdentifiers.TwentyFourHour`, but `longdate` contains no time components, so the date-only output is unchanged ([DateTimeFormatter template grammar: `<longdate>` is a `<specific-date>`]). Result automation name for any add/sub result (including the out-of-bound message): `"Resulting date " + StrDateResult` (`DateCalculatorTests.cs:630`).

### B5. Defaults and mode-surface expectations (en-US)

| Expectation | Value | Citation |
|---|---|---|
| Option combo labels, in order | `["Difference between dates", "Add or subtract days"]`, index 0 selected | `Resources.resw:2919-2929`; `DateCalculator.xaml:1010, 1035-1042` |
| Add/Subtract radios | `["Add", "Subtract"]`, Add checked by default | `Resources.resw:2915-2918, 2947-2950`; `DateCalculatorViewModel.cs:70` |
| Picker headers | From / To (diff), From (add/sub) | `Resources.resw:2939-2954, 3510-3513` |
| Offset combo items | 1000 entries, displayed `0` … `999`, two-way bound to `SelectedIndex`; all default 0 | `DateCalculatorViewModel.cs:17, 72-74, 102-109`; `DateCalculator.xaml:1181, 1197, 1212` |
| Picker range | min 1601-01-01, max 2550-12-31 | `DateCalculator.xaml.cs:60-75, 267-268` |
| Picker DateFormat | `"day month year"` (en-US shortdate pattern ⇒ e.g. `"9/2/2013"`-style; docs sample is for `shortdate`, and the grammar places `day month year` under `<shortdate>`) | `DateCalculator.xaml.cs:83-84`; [DateTimeFormatter docs grammar + sample] — see not-settled #1 |
| Placeholder | today's date rendered with the same `"day month year"` template, shown while `Date == null` | `DateCalculator.xaml.cs:77-89`; `DateCalculator.xaml:297-305`; [design doc] |
| No Calculate button; recompute on every input change | triggers listed in §6 | `DateCalculatorViewModel.cs:165-227` |
| Nav title / header automation | `"Date calculation"` / `"Date calculation mode"` | `Resources.resw:2908-2910, 3006-3008`; `NavCategory.cs:251, 350-353` |

---

## (c) NOT SETTLED BY THE SOURCE

1. **Exact en-US output of the literal template `"day month year"`.** The docs grammar places `day month year` inside `<shortdate>` and the only en-US sample is `shortdate → "9/2/2013"`; no docs sample renders `day month year` directly. The calculator source only assigns the string. (So: placeholder/picker text == en-US short date is a grammar-derived inference, not a directly sampled fact.)
2. **Which typed strings the picker accepts, and whether unparsable typed input yields `null`.** `DateFormat` is documented only as the text-box display format; the class docs attribute a null/cleared `Date` to the user deselecting the selected day, not to typing. The app's `ReselectCalendarDate` (restore OldDate, close flyout) is the only null-handling path visible in the calculator source. Also: whether the platform control overwrites the custom template's `DateText` (template-bound to `PlaceholderText`) with the selected date is not shown in the calculator source — only the design doc states the entry point shows placeholder vs chosen date.
3. **Which conditions make `Windows.Globalization.Calendar.AddYears/AddMonths/AddDays/GetDateTime` throw `ArgumentException`.** The WinRT docs for `AddDays` list no exceptions; the calculator source only catches `ArgumentException` and the tests establish the observed null outcomes for the listed vectors. `s_minSupportedDate`'s 1601 floor is explained in-code but its exact interaction with each Calendar API's own limits is not.
4. **Per-locale `GetListSeparator()` runtime values.** The source shows it reads `LOCALE_SLIST` and falls back to `","` for the default settings; en-US `", "` is derived from that fallback + the appended space, not hard-coded for en-US.
5. **Add/subtract with a non-UTC picker offset.** `StartDate` is *not* `ClipTime`d (unlike diff inputs) and the engine sets the calendar to UTC; no test covers a picking user whose local offset ≠ 0, so the resulting displayed date in such a zone is not settled by the source (the diff-mode case *is* covered by `DateCalcViewModelPreservesCalendarDateForOffsetPickerValues`).
6. **Why 2550 (not 2558/9999) and the stale comment.** The comment says clipping appears “just after 2558” and the max would ideally be 9999 pending MSFT-9273247; the code comment `// 31st December, 9878` at `DateCalculator.xaml.cs:73` contradicts `c_maxYear = 2550`. The actual platform clipping threshold is not settled here.
7. **Reachability of the `CalculationFailed` branch.** Because `_daysOutputFormat` is `Day` (mask `& 7 == 0`), the day-only engine call has no `return null` path, so `_dateDiffResultInDays == DateDifferenceUnknown` should be unreachable; no test exercises it. (Reasoning from the code, not observed at runtime.)
8. **Reachability of `GetDateDiffString`'s `parts.Count == 0` fallback.** Branch (3) in `UpdateDisplayResult` intercepts all-Y/M/W-zero results, so the `"0 days"`-only path appears unreachable; not asserted by any test.
9. **Weeks as an add/subtract offset.** The engine's `DateDifference.Week` is never applied by `AddDuration`/`SubtractDuration` and the UI has no week combo; that weeks are ignored is source-evident, but no test pins `{Week:n}` being ignored by add/subtract.
10. **Memory shortcut behaviour in Date mode.** The source disables the whole Calculator control and `KeyboardShortcutManager` only dispatches a chord to an enabled `ButtonBase`, which makes memory chords inert; there is no test for memory keys while in Date mode, and no app-level `AreMemoryShortcutsEnabled`-style flag exists in the source.
11. **The nav item's own visible label.** `GetNameResourceKey(ViewMode.Date)` → `DateCalculationModeText` is derived from `NavCategory`'s manifest (`NameResourceKey = "DateCalculationMode"` + `"Text"`), not directly asserted by any test; the only UI-test-verified string is the page header `"Date calculation"`.
12. **Time-of-day / offset identity of add/subtract results in general.** The formatter hides time (date-only `longdate`), and tests assert midnight-UTC values only; the exact `DateTimeOffset` offset retained by `AddDuration`/`SubtractDuration` for non-midnight inputs is not pinned by tests.
13. **The `MaxOffsetValue = 999` cap's rationale** is not commented anywhere in the source.

---

## Fetch log (all attempted; 0 failures)

| URL | Outcome |
|---|---|
| `https://raw.githubusercontent.com/microsoft/calculator/main/src/Calculator.ViewModels/Common/DateCalculator.cs` | OK (320 lines; read in full) |
| `…/src/Calculator.ViewModels/DateCalculatorViewModel.cs` | OK (353 lines; read in full) |
| `…/src/Calculator/Views/DateCalculator.xaml.cs` | OK (271 lines; read in full) |
| `…/src/Calculator/Views/DateCalculator.xaml` | OK (1239 lines; read in ranges + targeted greps) |
| `…/src/Calculator/Resources/en-US/Resources.resw` | OK (grepped for date/copy/label resource names) |
| `…/src/Calculator.Tests/DateCalculatorTests.cs` | OK (726 lines; read in full) |
| `…/src/Calculator/Views/MainPage.xaml.cs` | OK (greps + range reads) |
| `…/src/Calculator/Views/MainPage.xaml` | OK |
| `…/src/Calculator/Views/Calculator.xaml.cs` | OK (greps) |
| `…/src/Calculator/Views/Calculator.xaml` | OK (greps) |
| `…/src/Calculator.ViewModels/Common/LocalizationSettings.cs` | OK (greps) |
| `…/src/Calculator.ViewModels/Common/NavCategory.cs` | OK (greps) |
| `…/src/Calculator.ViewModels/HistoryViewModel.cs` | OK (greps) |
| `…/src/Calculator/Common/KeyboardShortcutManager.cs` | OK (greps) |
| `…/src/CalculatorUITestFramework/NavigationMenu.cs` | OK (full) |
| `…/src/CalculatorUITestFramework/CalculatorApp.cs` | OK (full) |
| `…/src/CalculatorUITests/StandardModeFunctionalTests.cs` | OK (grep + range read) |
| `…/src/CalculatorUITests/{Scientific,Programmer,History,Memory,CurrencyConverter}*FunctionalTests.cs` | OK — no `DateCalc|Date calculation` matches |
| `https://github.com/microsoft/calculator/tree/main/src/{CalculatorUITests,CalculatorUITestFramework,Calculator,Calculator/Common,Calculator/Views,Calculator.ViewModels,Calculator.ViewModels/Common}` | OK (dir listings) |
| `https://learn.microsoft.com/en-us/uwp/api/windows.globalization.datetimeformatting.datetimeformatter` | OK (`longdate` en-US sample + template/pattern grammar) |
| `https://learn.microsoft.com/en-us/uwp/api/windows.ui.xaml.controls.calendardatepicker` (+ `.date`, `.dateformat`, `.datechanged`) | OK |
| `https://learn.microsoft.com/en-us/uwp/api/windows.ui.xaml.controls.calendarview.mindate` | OK |
| `https://learn.microsoft.com/en-us/uwp/api/windows.globalization.calendar.adddays` | OK (no exception docs — see not-settled #3) |
| `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/calendar-date-picker` | OK (placeholder-vs-date behaviour) |

One tooling note, not a fetch failure: a single multi-URL grep across six UI-test files returned only one file's cached content; that search was re-run per file, and the per-file results are what is cited above.
