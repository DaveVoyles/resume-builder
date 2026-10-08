"use strict";

// Persona-driven browser flow. Fills the real home form from each persona's
// answers.json, then adds the pieces the home page does not do (ingest and a
// tailored role, which the agent runs) and checks setup reaches 10/10.
// Run with `npm run test:browser`. Not picked up by plain `node --test`
// (no *.test.js name). Self-skips when Playwright or Chromium is unavailable.
// Nothing here submits an application.

process.env.RESUME_BUILDER_PAGE_CHECK = process.env.RESUME_BUILDER_PAGE_CHECK || "off";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../../src/cli/commands/serve-home");
const init = require("../../src/cli/commands/init");
const ingest = require("../../src/cli/commands/ingest");
const tailor = require("../../src/cli/commands/tailor");
const { listPersonas } = require("../../scripts/e2e-persona");

const personasDir = path.join(__dirname, "..", "..", "examples", "personas");

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

async function quietly(fn) {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

function copyFiles(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) fs.copyFileSync(path.join(from, name), path.join(to, name));
}

async function startHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-persona-"));
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

async function selectIfSet(page, selector, value) {
  if (value) await page.selectOption(selector, { label: value });
}

// The form has one "Skip this" checkbox per optional field; any saved choice
// ("skip" or "none") means tick it.
async function skipIfSet(page, selector, value) {
  if (value) await page.check(selector);
}

for (const persona of listPersonas()) {
  test(`persona ${persona}: home form from answers.json, then setup reaches 10/10`, async (t) => {
    if (skipReason()) return t.skip(skipReason());
    const personaDir = path.join(personasDir, persona);
    const answers = JSON.parse(fs.readFileSync(path.join(personaDir, "answers.json"), "utf8"));
    const expected = JSON.parse(fs.readFileSync(path.join(personaDir, "expected.json"), "utf8"));

    const { url, root } = await startHome();
    const workspace = path.join(root, "candidate");

    // The agent's part before the person opens the form: workspace + files read in.
    await quietly(async () => {
      await init.run({ workspace, noServe: true });
      copyFiles(path.join(personaDir, "inputs", "resumes"), path.join(workspace, "inputs", "resumes"));
      copyFiles(path.join(personaDir, "inputs", "notes"), path.join(workspace, "inputs", "notes"));
      await ingest.run({ workspace });
    });

    const page = await browser.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    try {
      await page.goto(url);
      await page.waitForLoadState("networkidle");

      await page.click("#continueBtn");
      await page.fill("#name", answers.name);
      await page.fill("#loc", answers.location);
      await page.fill("#hist", answers.history);
      await page.fill("#goal", answers.goal);
      await selectIfSet(page, "#where", answers.where);
      await selectIfSet(page, "#when", answers.when);
      await page.fill("#extra", answers.extra || "");
      await page.fill("#dealBreakers", answers.dealBreakers || "");
      await skipIfSet(page, "#dealBreakersSkip", answers.dealBreakersChoice);
      await page.fill("#education", answers.education || "");
      await skipIfSet(page, "#educationSkip", answers.educationChoice);
      await page.fill("#salary", answers.salary || "");
      await skipIfSet(page, "#salarySkip", answers.salaryChoice);
      await page.click("#intakeForm button[type=submit]");

      await page.locator("#saved").waitFor({ state: "visible" });
      assert.equal(await page.locator("#setup").isVisible(), false);
      assert.equal(await page.locator("#formError").isVisible(), false);

      // Every section the form covers is done; the agent steps are not yet.
      let payload = await (await fetch(`${url}api/onboarding-state`)).json();
      const byKey = Object.fromEntries(payload.trackerSteps.map((step) => [step.key, step.done]));
      for (const key of ["basicInfo", "workHistory", "education", "targetRole", "location", "compensation", "dealBreakers", "materialIngested"]) {
        assert.equal(byKey[key], true, `${persona}: ${key} should be done after saving the form`);
      }
      assert.equal(byKey.firstRoleAdded, false, "no role yet");

      // Reload prefills what the person typed.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => document.getElementById("goal").value !== "");
      assert.equal(await page.inputValue("#name"), answers.name);
      assert.equal(await page.inputValue("#goal"), answers.goal);

      // The agent adds the first role from the persona's posting and resume config.
      const posting = expected.postings[0];
      const configPath = path.join(workspace, "resume-configs", path.basename(posting.config));
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.copyFileSync(path.join(personaDir, posting.config), configPath);
      await quietly(() => tailor.run({ workspace, config: configPath, url: posting.url, title: posting.title, company: posting.company }));

      await page.reload();
      await page.waitForLoadState("networkidle");
      payload = await (await fetch(`${url}api/onboarding-state`)).json();
      const done = payload.trackerSteps.filter((step) => step.done).length;
      assert.equal(done, payload.trackerSteps.length, `${persona}: setup should be ${payload.trackerSteps.length}/${payload.trackerSteps.length}`);
      assert.equal(payload.trackerSteps.length, 10);
      assert.ok(payload.homeSteps.every((step) => step.done), `${persona}: every home step done`);
    } finally {
      await page.close();
    }
  });
}
