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

async function startHome(deps = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-browser-ux-"));
  fs.mkdirSync(path.join(root, "my-documents"));
  fs.mkdirSync(path.join(root, "output"));
  fs.writeFileSync(path.join(root, "my-documents", "START-HERE.txt"), "put files here\n");
  const server = await run({ root, port: 0, noOpen: true }, { rebuildTrackers: () => {}, ...deps });
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

test("home-ux: Skip this disables its field, is sent as the existing choice, and is remembered on reload", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url, root } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    await page.fill("#goal", "Support engineering manager");
    await page.fill("#salary", "90000");
    await page.check("#salarySkip");
    assert.equal(await page.isDisabled("#salary"), true);
    await page.uncheck("#salarySkip");
    assert.equal(await page.isDisabled("#salary"), false);
    await page.check("#salarySkip");
    await page.check("#educationSkip");
    await page.check("#dealBreakersSkip");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });

    const answers = JSON.parse(fs.readFileSync(path.join(root, "candidate", "home-answers.json"), "utf8"));
    assert.equal(answers.salaryChoice, "skip");
    assert.equal(answers.educationChoice, "skip");
    assert.equal(answers.dealBreakersChoice, "skip");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => document.getElementById("goal").value !== "");
    await page.click("#continueBtn");
    for (const id of ["salary", "education", "dealBreakers"]) {
      assert.equal(await page.isChecked(`#${id}Skip`), true, `${id} skip remembered`);
      assert.equal(await page.isDisabled(`#${id}`), true, `${id} disabled`);
    }
    // Unticking and typing replaces the skip.
    await page.uncheck("#salarySkip");
    await page.fill("#salary", "$100k");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });
    const after = JSON.parse(fs.readFileSync(path.join(root, "candidate", "home-answers.json"), "utf8"));
    assert.equal(after.salaryChoice, "");
  } finally {
    await page.close();
  }
});

test("home-ux: an empty goal shows an inline error at the field and focuses it", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.click("#continueBtn");
    assert.equal(await page.getAttribute("#intakeForm", "novalidate"), "");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#goalError").waitFor({ state: "visible" });
    assert.equal(await page.getAttribute("#goalError", "aria-live"), "polite");
    assert.equal(await page.getAttribute("#goal", "aria-invalid"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.id), "goal");
    await page.fill("#goal", "x");
    assert.equal(await page.locator("#goalError").isVisible(), false);
  } finally {
    await page.close();
  }
});

test("home-ux: no failed requests or console errors on first load (favicon included)", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  try {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(problems, []);
  } finally {
    await page.close();
  }
});

test("home-ux: Welcome card sizes to its content and the Ready? card has no duplicate tracker link", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  try {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const heights = await page.evaluate(() => ({
      hero: document.querySelector(".hero").getBoundingClientRect().height,
      docs: document.querySelector(".docs").getBoundingClientRect().height,
    }));
    assert.ok(heights.hero < heights.docs - 100, `hero ${heights.hero} should be shorter than docs ${heights.docs}`);
    assert.equal(await page.locator("#intro a[href='/tracker.html']:visible").count(), 0);
  } finally {
    await page.close();
  }
});

test("home-ux: Open folder shows the real location after it opens, and the fallback note when it fails", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const good = await startHome({ openFolder: () => {} });
  let page = await newPage(good.url);
  try {
    await page.click("#openDocs");
    await page.waitForFunction(() => document.getElementById("openDocsNote").textContent.startsWith("Opened:"));
    assert.equal(await page.textContent("#openDocsNote"), `Opened: ${path.join(good.root, "my-documents")}`);
  } finally {
    await page.close();
  }
  const bad = await startHome({
    openFolder: () => {
      throw new Error("no opener");
    },
  });
  page = await newPage(bad.url);
  try {
    await page.click("#openDocs");
    await page.waitForFunction(() => document.getElementById("openDocsNote").textContent.startsWith("Could not open"));
    assert.match(await page.textContent("#openDocsNote"), /Open my-documents yourself/);
  } finally {
    await page.close();
  }
});

test("home-ux: Add a job builds a sentence, validates, copies, and saves the request for the agent", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url, root } = await startHome();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.click("#t-jobs");
    assert.doesNotMatch(await page.textContent("#jobs"), /does not add jobs/);

    await page.click("#jobForm button[type=submit]");
    await page.locator("#jobError").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.activeElement.id), "jobLink");
    await page.fill("#jobLink", "javascript:alert(1)");
    await page.click("#jobForm button[type=submit]");
    assert.match(await page.textContent("#jobError"), /http/);
    assert.equal(await page.locator("#jobResult").isVisible(), false);

    await page.fill("#jobLink", "https://jobs.example.com/ops?id=9");
    await page.fill("#jobText", "<b>Ops manager</b> at Example Health");
    await page.click("#jobForm button[type=submit]");
    await page.locator("#jobResult").waitFor({ state: "visible" });
    const sentence = await page.inputValue("#jobSentence");
    assert.match(sentence, /^Please add this job and tailor my resume: https:\/\/jobs\.example\.com\/ops\?id=9/);
    assert.match(sentence, /<b>Ops manager<\/b> at Example Health/);
    assert.equal(await page.locator("#jobResult b").count(), 0);

    await page.click("#copySentence");
    await page.waitForFunction(() => /Copied|Ctrl\+C/.test(document.getElementById("copyStatus").textContent));

    const saved = JSON.parse(fs.readFileSync(path.join(root, "candidate", "job-requests.json"), "utf8"));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].link, "https://jobs.example.com/ops?id=9");
    assert.equal(saved[0].text, "<b>Ops manager</b> at Example Health");
    await page.waitForFunction(() => !document.getElementById("jobPending").hidden);
    assert.match(await page.textContent("#jobPending"), /1 job request is waiting/);
  } finally {
    await context.close();
  }
});

test("home-ux: completed steps collapse into one summary line and can be shown", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url } = await startHome();
  const page = await newPage(url);
  try {
    await page.locator("#stepsToggle").waitFor({ state: "visible" });
    assert.match(await page.textContent("#stepsToggle"), /Steps 1-2 done/);
    assert.equal(await page.locator('[data-home-step="downloadRb"]').isVisible(), false);
    assert.equal(await page.locator('[data-home-step="addFiles"]').isVisible(), true);
    await page.click("#stepsToggle");
    assert.equal(await page.locator('[data-home-step="downloadRb"]').isVisible(), true);
  } finally {
    await page.close();
  }
});

test("home-ux: a tailored resume shows the ready card with working links; Answers saved is not green", async (t) => {
  if (skipReason()) return t.skip(skipReason());
  const { url, root } = await startHome();
  const page = await newPage(url);
  try {
    assert.equal(await page.locator("#readyCard").isVisible(), false);
    await page.click("#continueBtn");
    await page.fill("#goal", "Support engineering manager");
    await page.click("#intakeForm .btn.primary");
    await page.locator("#saved").waitFor({ state: "visible" });
    assert.equal(await page.locator("#readyCard").isVisible(), false);
    assert.match(await page.textContent("#savedNextStep"), /^Next:/);
    const border = await page.evaluate(() => getComputedStyle(document.getElementById("saved")).borderTopColor);
    assert.notEqual(border, "rgb(34, 197, 94)");

    const workspace = path.join(root, "candidate");
    fs.mkdirSync(path.join(workspace, "outputs", "resumes"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "outputs", "tailor-reports"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "outputs", "resumes", "jordan.html"), "<h1>JORDAN_RESUME</h1>");
    fs.writeFileSync(path.join(workspace, "outputs", "tailor-reports", "role.md"), "REPORT\n");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("#readyCard").waitFor({ state: "visible" });
    assert.equal(await page.textContent("#readyHeading"), "Your resume is ready");
    assert.equal(await page.getAttribute("#openResume", "href"), "/resume/latest");
    const response = await page.request.get(new URL("/resume/latest", url).href);
    assert.match(await response.text(), /JORDAN_RESUME/);
    assert.equal(await page.locator("#openReport").isVisible(), true);
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
