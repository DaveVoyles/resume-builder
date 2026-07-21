"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/init");
const { workspacePaths } = require("../../src/core/workspace");

// Coverage for `init`'s workspace scaffolding (previously untested), focused
// on the links.md deliverable from design plan 0003 D1: scaffolded content
// and idempotency (issue #31 acceptance criteria).

function withTempWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "init-workspace-"));
  try {
    return fn(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("init scaffolds inputs/links.md with a one-link-per-line template", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);
    assert.ok(fs.existsSync(paths.links), "links.md should be scaffolded");
    const content = fs.readFileSync(paths.links, "utf8");
    assert.match(content, /Public source links/);
  });
});

test("init does not overwrite an existing links.md on re-run (idempotent)", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);

    const customContent = "https://github.com/real-candidate\n";
    fs.writeFileSync(paths.links, customContent);

    command.run({ workspace });

    assert.strictEqual(
      fs.readFileSync(paths.links, "utf8"),
      customContent,
      "re-running init must not overwrite a candidate's real links.md content",
    );
  });
});

test("init --force overwrites an existing links.md back to the template", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);

    fs.writeFileSync(paths.links, "https://github.com/real-candidate\n");
    command.run({ workspace, force: true });

    assert.match(fs.readFileSync(paths.links, "utf8"), /Public source links/);
  });
});

// Coverage for issue #100: the scaffolded preferences.json must match the
// documented schema (docs/workspace-schemas.md#preferencesjson) — `locations`
// is a required object (not a flat array), `dealBreakers` is a required
// array, `compensation` is an *optional* field so it's omitted entirely per
// the doc's shared convention ("Omit unknown optional fields instead of
// adding placeholder values"), and the undocumented `workAuthorization`/
// `remotePreference` fields are gone.
test("init scaffolds preferences.json matching the documented schema", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));

    assert.strictEqual(preferences.schemaVersion, "1.0");
    assert.deepEqual(preferences.roleTargets, []);

    assert.deepEqual(preferences.locations, {
      workModes: [],
      preferredRegions: [],
      excludedRegions: [],
      priority: "should",
    });

    assert.deepEqual(preferences.dealBreakers, [], "dealBreakers is required and defaults to empty");

    assert.strictEqual(
      preferences.compensation,
      undefined,
      "compensation is documented as optional — omit it rather than scaffold a placeholder object",
    );
    assert.strictEqual(preferences.workAuthorization, undefined, "workAuthorization is not part of the documented schema");
    assert.strictEqual(preferences.remotePreference, undefined, "remotePreference is not part of the documented schema");

    assert.ok(!Number.isNaN(Date.parse(preferences.updatedAt)), "updatedAt should be a valid ISO timestamp");
  });
});

test("init does not overwrite an existing preferences.json on re-run (idempotent)", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);

    const customPreferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    customPreferences.dealBreakers = [{ id: "deal-001", text: "No relocation.", priority: "must" }];
    fs.writeFileSync(paths.preferences, JSON.stringify(customPreferences, null, 2));

    command.run({ workspace });

    const reread = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(reread.dealBreakers, customPreferences.dealBreakers);
  });
});

test("init --force overwrites an existing preferences.json back to the documented schema shape", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace });
    const paths = workspacePaths(workspace);

    fs.writeFileSync(paths.preferences, JSON.stringify({ schemaVersion: "1.0", stale: true }, null, 2));
    command.run({ workspace, force: true });

    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.dealBreakers, []);
    assert.strictEqual(preferences.stale, undefined);
  });
});
