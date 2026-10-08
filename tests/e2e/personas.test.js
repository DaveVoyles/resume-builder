"use strict";

// Persona e2e scorecard + golden DOCX text (docs/testing.md).
// Regenerate goldens after an intended content/layout change:
//   UPDATE_GOLDEN=1 npm test
// Page-count checks need LibreOffice and run only via `npm run e2e`.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { runPersona, listPersonas, assertSafeCommand, normalizeText } = require("../../scripts/e2e-persona");

const updateGolden = process.env.UPDATE_GOLDEN === "1";

test("there are at least three fictional personas", () => {
  assert.ok(listPersonas().length >= 3, listPersonas().join(", "));
});

for (const persona of listPersonas()) {
  test(`persona ${persona}: scorecard passes and rendered DOCX text matches golden`, async () => {
    const result = await runPersona(persona, { pages: false });
    const failures = result.checks.filter((check) => check.status === "fail");
    assert.deepEqual(failures, [], `failed checks: ${JSON.stringify(failures, null, 2)}`);

    assert.ok(result.outputs.length > 0, "persona rendered at least one resume");
    for (const output of result.outputs) {
      if (updateGolden) {
        fs.mkdirSync(path.dirname(output.goldenPath), { recursive: true });
        fs.writeFileSync(output.goldenPath, output.text);
        continue;
      }
      assert.ok(fs.existsSync(output.goldenPath), `missing golden ${path.relative(process.cwd(), output.goldenPath)}; run UPDATE_GOLDEN=1 npm test`);
      const golden = normalizeText(fs.readFileSync(output.goldenPath, "utf8"));
      assert.equal(output.text, golden, `${persona}/${output.id} DOCX text drifted from golden (UPDATE_GOLDEN=1 to regenerate)`);
    }
  });
}

test("e2e runner refuses apply, approve-apply, and --confirm-submit", () => {
  assert.throws(() => assertSafeCommand(["apply", "--dry-run"]), /never submit/);
  assert.throws(() => assertSafeCommand(["approve-apply", "--company", "X"]), /never submit/);
  assert.throws(() => assertSafeCommand(["tailor", "--confirm-submit"]), /--confirm-submit/);
  assert.doesNotThrow(() => assertSafeCommand(["validate", "--workspace", "x"]));
});

test("a broken claim makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace("by 20%", "by 65%"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((check) => check.status === "fail" && /stage completed|claim audit/.test(check.check)));
});

test("an invented employer makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace("Riverside Dental", "Globex Dynamics"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((check) => check.status === "fail" && /Employer not found/.test(JSON.stringify(check))));
});

test("a missing keyword makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace(/scheduling|billing|checklist/giu, "xxxx"),
  });
  assert.equal(result.ok, false);
});
