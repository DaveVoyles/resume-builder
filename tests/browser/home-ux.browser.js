"use strict";

// Headless browser checks for home page wording and layout: step count, numbered
// lists, salary confirmation, companion selects, and the draft note. Run with
// `npm run test:browser`. Not picked up by plain `node --test` (no *.test.js
// name). Self-skips when Playwright or Chromium is unavailable. The server and
// chromium helpers mirror tests/browser/home.browser.js.

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-browser-ux-"));
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

function seedRoles(root, count) {
  const workspace = path.join(root, "candidate");
  fs.mkdirSync(workspace, { recursive: true });
  const roles = Array.from({ length: count }, (_, i) => ({
    id: `role-${i + 1}`,
    company: `Example Co ${i + 1}`,
    title: "Operations Manager",
    status: "interested",
  }));
  fs.writeFileSync(path.join(workspace, "roles.tracked.json"), JSON.stringify(roles));
}

test("home-ux: step count text and numbered done steps", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    assert.match(await page.textContent("#homeStepCount"), /^2 of 6 steps done$/);
    const doneContent = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-home-step="downloadRb"]'), "::before").content,
    );
    // Computed content keeps the counter expression: the number stays beside the check.
    assert.match(doneContent, /counter\(s\)/);
    assert.match(doneContent, /✓/);
  } finally {
    await page.close();
  }
});

test("home-ux: jobs tab is a numbered ordered list", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url, root } = await startHome();
  seedRoles(root, 3);
  const page = await newPage(url);
  try {
    await page.click("#t-jobs");
    await page.locator("#jobsList").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.getElementById("jobsItems").tagName), "OL");
    assert.equal(await page.locator("#jobsItems li").count(), 3);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById("jobsItems")).listStyleType),
      "decimal",
    );
  } finally {
    await page.close();
  }
});

test("home-ux: changing a saved salary asks first and the saved card states the change", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#goal", "Support engineering manager");
    await page.fill("#salary", "100000");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });
    assert.equal(await page.locator("#savedSalaryNote").isVisible(), false);

    await page.click("#editAnswers");
    await page.fill("#salary", "$120k");
    const messages = [];
    page.once("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.dismiss();
    });
    await page.click("#intakeForm .btn.primary");
    await page.waitForTimeout(300);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /\$100,000 to \$120,000/);
    assert.equal(await page.locator("#saved").isVisible(), false);

    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });
    assert.match(await page.textContent("#savedSalaryNote"), /\$100,000 to \$120,000/);
  } finally {
    await page.close();
  }
});

test("home-ux: typing a value clears and disables its companion select", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.selectOption("#salaryChoice", "skip");
    await page.fill("#salary", "90000");
    assert.equal(await page.inputValue("#salaryChoice"), "");
    assert.equal(await page.isDisabled("#salaryChoice"), true);
    await page.fill("#salary", "");
    assert.equal(await page.isDisabled("#salaryChoice"), false);
  } finally {
    await page.close();
  }
});

test("home-ux: the draft note follows the save response", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#goal", "Support engineering manager");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });
    assert.match(await page.textContent("#draftNote"), /Ask your agent to read the files in my-documents/);
  } finally {
    await page.close();
  }
});
