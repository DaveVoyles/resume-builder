"use strict";

// Headless browser checks for the home page. Run with `npm run test:browser`.
// Not picked up by plain `node --test` (no *.test.js name). Self-skips when
// Playwright or Chromium is unavailable.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../../src/cli/commands/serve-home");

let chromium = null;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  chromium = null;
}

function fallbackExecutables() {
  const list = [process.env.CHROMIUM_EXECUTABLE_PATH].filter(Boolean);
  const base = "/opt/pw-browsers";
  try {
    for (const dir of fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      list.push(path.join(base, dir, "chrome-linux", "chrome"));
    }
  } catch (error) {
    // no local browsers directory
  }
  list.push(path.join(base, "chromium"));
  return list;
}

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    for (const executablePath of fallbackExecutables()) {
      try {
        if (fs.existsSync(executablePath) && fs.statSync(executablePath).isFile()) {
          return await chromium.launch({ headless: true, executablePath });
        }
      } catch (inner) {
        if (process.env.DEBUG_BROWSER) console.error(inner.message);
        // try next
      }
    }
    return null;
  }
}

let browser = null;
const cleanups = [];

before(async () => {
  if (chromium) browser = await launch();
});

after(async () => {
  if (browser) await browser.close();
  for (const fn of cleanups) fn();
});

function skipReason() {
  if (!chromium) return "playwright not installed";
  if (!browser) return "chromium not available";
  return null;
}

async function startHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-browser-"));
  fs.mkdirSync(path.join(root, "my-documents"));
  fs.mkdirSync(path.join(root, "output"));
  fs.writeFileSync(path.join(root, "my-documents", "START-HERE.txt"), "put files here\n");
  const server = await run({ root, port: 0, noOpen: true }, { rebuildTrackers: () => {} });
  const url = `http://localhost:${server.address().port}/`;
  cleanups.push(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { url, root, server };
}

async function newPage(url) {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  return page;
}

test("home: setup form and Go to setup are hidden/shown correctly", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.getByRole("button", { name: /Continue setup/ }).waitFor({ state: "visible" });
    assert.equal(await page.locator("#setup").isVisible(), false);
    assert.equal(await page.locator("#saved").isVisible(), false);

    await page.click("#continueBtn");
    assert.equal(await page.locator("#setup").isVisible(), true);
    assert.equal(await page.getAttribute("#continueBtn", "aria-expanded"), "true");

    // Jobs tab: empty state, Go to setup opens the form and focuses the first field.
    await page.click("#t-jobs");
    assert.equal(await page.locator("#jobsEmpty").isVisible(), true);
    assert.equal(await page.locator("#jobsList").isVisible(), false);
    await page.click("#jobsGoToSetup");
    assert.equal(await page.locator("#intro").isVisible(), true);
    assert.equal(await page.locator("#setup").isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "name");
  } finally {
    await page.close();
  }
});

test("home: save hides the form, shows Edit my answers, and reload prefills every field", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#name", "Jordan Sample");
    await page.fill("#loc", "Austin, TX");
    await page.fill("#hist", "Ten years in support engineering.");
    await page.fill("#goal", "Support engineering manager");
    await page.fill("#extra", "Career break in 2021.");
    await page.fill("#dealBreakers", "No night shifts");
    await page.fill("#education", "B.S. Computer Science");
    await page.fill("#salary", "120000");
    await page.click("#intakeForm button[type=submit], #intakeForm .btn.primary");

    await page.locator("#saved").waitFor({ state: "visible" });
    assert.equal(await page.locator("#setup").isVisible(), false);
    assert.equal(await page.locator("#savedHeading").textContent(), "Answers saved.");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => document.getElementById("goal").value !== "");
    assert.equal(await page.inputValue("#name"), "Jordan Sample");
    assert.equal(await page.inputValue("#loc"), "Austin, TX");
    assert.equal(await page.inputValue("#hist"), "Ten years in support engineering.");
    assert.equal(await page.inputValue("#goal"), "Support engineering manager");
    assert.equal(await page.inputValue("#extra"), "Career break in 2021.");
    assert.equal(await page.inputValue("#dealBreakers"), "No night shifts");
    assert.equal(await page.inputValue("#education"), "B.S. Computer Science");
    assert.equal(await page.inputValue("#salary"), "120000");
  } finally {
    await page.close();
  }
});

test("home: a changed goal persists across reload and blank optional fields clear", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#name", "Jordan Sample");
    await page.fill("#hist", "Old history");
    await page.fill("#extra", "Old extra");
    await page.fill("#goal", "Data analyst");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });

    // Edit my answers brings the form back with saved values.
    await page.click("#editAnswers");
    assert.equal(await page.locator("#setup").isVisible(), true);
    assert.equal(await page.locator("#saved").isVisible(), false);
    assert.equal(await page.inputValue("#goal"), "Data analyst");

    await page.fill("#goal", "Analytics engineer");
    await page.fill("#hist", "");
    await page.fill("#extra", "");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => document.getElementById("goal").value !== "");
    assert.equal(await page.inputValue("#goal"), "Analytics engineer");
    assert.equal(await page.inputValue("#hist"), "");
    assert.equal(await page.inputValue("#extra"), "");
    assert.equal(await page.inputValue("#name"), "Jordan Sample");
  } finally {
    await page.close();
  }
});

test("home: saving without a goal shows an error and keeps the form open", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#name", "Jordan Sample");
    await page.evaluate(() => document.getElementById("intakeForm").setAttribute("novalidate", ""));
    await page.click("#intakeForm .btn.primary");
    await page.locator("#formError").waitFor({ state: "visible" });
    assert.equal(await page.locator("#setup").isVisible(), true);
    assert.equal(await page.locator("#saved").isVisible(), false);
  } finally {
    await page.close();
  }
});
