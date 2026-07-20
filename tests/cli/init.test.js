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
