#!/usr/bin/env node
/*
 * AC-009 live check — the `file://` surface (CON-001).
 *
 * Loads index.html over file:// in headless Chromium and fails on any console
 * error, page error, or failed request. It also fails when the app did not
 * boot (no #calc, no #value, no keypad), so a blank page cannot pass silently.
 *
 * Usage:   node tasks/T001/evidence/ac009-live-check.mjs [--page <url-or-path>]
 * Exit:    0 = clean · 1 = a problem was observed · 2 = environment failure
 *
 * Dependencies: none. Node >= 22 (global fetch + WebSocket). Chromium comes
 * from the host's Playwright cache; set CHROME_BIN to override.
 */
"use strict";

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const argv = process.argv.slice(2);

function option(name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] || null;
}

const pageOption = option("--page");
const PAGE = pageOption
  ? (pageOption.startsWith("file://") ? pageOption : "file://" + path.resolve(pageOption))
  : "file://" + path.join(REPO, "index.html");

const LOAD_TIMEOUT_MS = 30000;
const SETTLE_MS = 1500;

function stamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function line(label, value) {
  console.log(label.padEnd(19) + value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cache = path.join(os.homedir(), ".cache", "ms-playwright");
  const full = [];
  const shell = [];
  for (const entry of fs.readdirSync(cache)) {
    if (entry.startsWith("chromium-")) full.push(path.join(cache, entry, "chrome-linux64", "chrome"));
    if (entry.startsWith("chromium_headless_shell-")) shell.push(path.join(cache, entry, "chrome-headless-shell-linux64", "chrome-headless-shell"));
  }
  for (const candidate of [...full.sort(), ...shell.sort()]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("no Chromium binary found under " + cache + " (set CHROME_BIN)");
}

function launch(chrome, flags) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ac009-profile-"));
    const child = spawn(chrome, [...flags, "--user-data-dir=" + profile, "about:blank"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let settled = false;
    const finish = (err, wsUrl) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (wsUrl) resolve({ child, wsUrl, profile });
      else {
        try { child.kill("SIGKILL"); } catch (ignore) {}
        reject(err);
      }
    };
    const scan = (chunk) => {
      out += chunk;
      const m = out.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) finish(null, m[1]);
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("exit", (code, signal) =>
      finish(new Error("chromium exited early (code=" + code + " signal=" + signal + "): " + out.slice(-300))));
    const timer = setTimeout(() =>
      finish(new Error("chromium did not report a DevTools URL in 20s: " + out.slice(-300))), 20000);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const events = [];
    let seq = 0;
    const state = {
      events,
      send(method, params = {}) {
        const id = ++seq;
        return new Promise((res, rej) => {
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
    };
    ws.addEventListener("open", () => resolve(state));
    ws.addEventListener("error", () => reject(new Error("DevTools websocket error")));
    ws.addEventListener("message", (ev) => {
      const text = typeof ev.data === "string" ? ev.data : String(ev.data);
      let msg;
      try { msg = JSON.parse(text); } catch (ignore) { return; }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message || "CDP error"));
        else p.res(msg.result);
      } else if (msg.method) {
        events.push(msg);
      }
    });
  });
}

async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(100);
  }
  throw new Error("timeout waiting for " + what);
}

async function main() {
  const startedAt = Date.now();
  console.log("AC-009 live check — file:// (headless Chromium)");
  console.log("policy:            fail on any console error, page error, or failed request; pass requires the app to boot");
  console.log("=================================================");
  line("date:", stamp());
  line("command:", "node tasks/T001/evidence/ac009-live-check.mjs");
  line("repo:", REPO);
  const head = spawnSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const status = spawnSync("git", ["-C", REPO, "status", "--porcelain"], { encoding: "utf8" }).stdout.trim();
  line("git head:", head || "(unknown)");
  line("git status:", status ? "DIRTY:" : "clean");
  if (status) console.log(status);
  line("page:", PAGE);
  line("checker:", "tasks/T001/evidence/ac009-live-check.mjs · node " + process.version);

  const chrome = findChrome();
  const version = (spawnSync(chrome, ["--version"], { encoding: "utf8" }).stdout || "").trim();
  line("browser:", version + " — " + chrome);

  const base = [
    "--headless=new",
    "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update",
    "--disable-sync", "--disable-extensions", "--disable-default-apps",
    "--mute-audio",
  ];
  const sets = [
    { label: "default sandbox", flags: [] },
    { label: "fallback", flags: ["--no-sandbox", "--disable-setuid-sandbox"] },
  ];
  let launched = null;
  let launchNote = sets[0].label;
  for (const set of sets) {
    try {
      launched = await launch(chrome, [...base, ...set.flags]);
      launchNote = set.label + (set.flags.length ? " (" + set.flags.join(" ") + ")" : "");
      break;
    } catch (err) {
      if (set === sets[sets.length - 1]) throw err;
    }
  }
  const { child, wsUrl, profile } = launched;
  line("flags:", "headless · " + launchNote);

  let cdp;
  try {
    const port = new URL(wsUrl).port;
    const targets = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
    const pageTarget = targets.find((t) => t.type === "page");
    if (!pageTarget) throw new Error("no page target available");

    cdp = await connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    try { await cdp.send("Log.enable"); } catch (ignore) {}

    cdp.events.length = 0; // drop anything from about:blank
    await cdp.send("Page.navigate", { url: PAGE });

    await waitFor(async () => {
      try {
        const r = await cdp.send("Runtime.evaluate", {
          expression: "JSON.stringify({ href: location.href, ready: document.readyState })",
          returnByValue: true,
        });
        const state = JSON.parse(r.result.value);
        return state.href === PAGE && state.ready === "complete";
      } catch (ignore) {
        return false; // mid-navigation execution contexts come and go
      }
    }, LOAD_TIMEOUT_MS, "page load over file://");

    await sleep(SETTLE_MS);

    const smoke = JSON.parse((await cdp.send("Runtime.evaluate", {
      expression: "JSON.stringify({ title: document.title, calc: !!document.getElementById('calc'), value: (document.getElementById('value') || {}).textContent || null, keys: document.querySelectorAll('#keypad .key').length })",
      returnByValue: true,
    })).result.value);

    const urls = new Map();
    for (const e of cdp.events) {
      if (e.method === "Network.requestWillBeSent") urls.set(e.params.requestId, e.params.request.url);
    }
    const consoleErrors = cdp.events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error");
    const consoleWarnings = cdp.events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "warning");
    const pageErrors = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
    const failedRequests = cdp.events.filter((e) => e.method === "Network.loadingFailed" && !e.params.canceled);
    const logErrors = cdp.events.filter((e) => e.method === "Log.entryAdded" && e.params.entry.level === "error");
    const requests = [...urls.values()];

    console.log("-------------------------------------------------");
    line("app:", 'title="' + smoke.title + '" · #calc present · #value "' + smoke.value + '" · keypad keys ' + smoke.keys);
    line("requests:", requests.length + " seen" + (requests.length ? ": " + requests.map((u) => u.replace("file://" + REPO + "/", "")).join(", ") : " (none reported)"));
    line("console errors:", String(consoleErrors.length) + (consoleWarnings.length ? " (warnings: " + consoleWarnings.length + ")" : ""));
    line("page errors:", String(pageErrors.length));
    line("failed requests:", String(failedRequests.length));
    line("browser-log errors:", String(logErrors.length));

    const print = (label, list, fmt) => {
      if (!list.length) return;
      console.log(label + ":");
      for (const item of list.slice(0, 10)) console.log("  " + fmt(item));
    };
    print("console error detail", consoleErrors, (e) =>
      e.params.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
    print("page error detail", pageErrors, (e) => {
      const d = e.params.exceptionDetails || {};
      return (d.text || "") + " " + ((d.exception && (d.exception.description || d.exception.value)) || "");
    });
    print("failed request detail", failedRequests, (e) =>
      (urls.get(e.params.requestId) || e.params.requestId) + " — " + e.params.errorText);
    print("browser-log detail", logErrors, (e) => (e.params.entry.source || "") + ": " + (e.params.entry.text || ""));

    console.log("-------------------------------------------------");
    const problems = [];
    if (!smoke.calc || smoke.value !== "0" || smoke.keys < 24) problems.push("app boot marker missing or unexpected");
    if (consoleErrors.length) problems.push(consoleErrors.length + " console error(s)");
    if (pageErrors.length) problems.push(pageErrors.length + " page error(s)");
    if (failedRequests.length) problems.push(failedRequests.length + " failed request(s)");
    if (logErrors.length) problems.push(logErrors.length + " browser-log error(s)");

    line("finished:", stamp() + " (" + ((Date.now() - startedAt) / 1000).toFixed(1) + "s)");
    if (problems.length === 0) {
      console.log("result: PASS");
      console.log("EXIT_CODE=0");
      return 0;
    }
    console.log("result: FAIL — " + problems.join("; "));
    console.log("EXIT_CODE=1");
    return 1;
  } finally {
    try { child.kill("SIGKILL"); } catch (ignore) {}
    await sleep(250);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.log("result: FATAL — " + err.message);
    console.log("EXIT_CODE=2");
    process.exit(2);
  });
