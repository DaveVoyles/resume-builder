"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/init");
const { workspacePaths } = require("../../src/core/workspace");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

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

// Separate from withTempWorkspace (kept sync, unchanged) rather than making
// that one async: an async wrapper would swallow a synchronous assertion
// throw from an un-awaited sync callback into a dropped promise rejection
// instead of a failing test, for every existing synchronous call site above.
async function withTempWorkspaceAsync(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "init-workspace-"));
  try {
    return await fn(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("init scaffolds inputs/links.md with a one-link-per-line template", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);
    assert.ok(fs.existsSync(paths.links), "links.md should be scaffolded");
    const content = fs.readFileSync(paths.links, "utf8");
    assert.match(content, /Public source links/);
  });
});

test("init does not overwrite an existing links.md on re-run (idempotent)", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    const customContent = "https://github.com/real-candidate\n";
    fs.writeFileSync(paths.links, customContent);

    command.run({ workspace, noServe: true });

    assert.strictEqual(
      fs.readFileSync(paths.links, "utf8"),
      customContent,
      "re-running init must not overwrite a candidate's real links.md content",
    );
  });
});

test("init --force overwrites an existing links.md back to the template", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    fs.writeFileSync(paths.links, "https://github.com/real-candidate\n");
    command.run({ workspace, force: true, noServe: true });

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
    command.run({ workspace, noServe: true });
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
    command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    const customPreferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    customPreferences.dealBreakers = [{ id: "deal-001", text: "No relocation.", priority: "must" }];
    fs.writeFileSync(paths.preferences, JSON.stringify(customPreferences, null, 2));

    command.run({ workspace, noServe: true });

    const reread = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(reread.dealBreakers, customPreferences.dealBreakers);
  });
});

test("init --force overwrites an existing preferences.json back to the documented schema shape", () => {
  withTempWorkspace((workspace) => {
    command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    fs.writeFileSync(paths.preferences, JSON.stringify({ schemaVersion: "1.0", stale: true }, null, 2));
    command.run({ workspace, force: true, noServe: true });

    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.dealBreakers, []);
    assert.strictEqual(preferences.stale, undefined);
  });
});

// Coverage for design plan 0006 D3 (issue #130): setup should write an
// initial tracker.html and auto-launch the local server, so a candidate
// sees a result immediately instead of a 404 until build-tracker runs.

test("init scaffolds an initial tracker.html alongside tracker.md", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);
    assert.ok(fs.existsSync(paths.htmlTracker), "tracker.html should be scaffolded at setup");
    assert.match(fs.readFileSync(paths.htmlTracker, "utf8"), /<html/u);
  });
});

test("init does not overwrite an existing tracker.html on re-run (idempotent)", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    const customContent = "<html><body>hand-edited</body></html>";
    fs.writeFileSync(paths.htmlTracker, customContent);

    await command.run({ workspace, noServe: true });

    assert.strictEqual(fs.readFileSync(paths.htmlTracker, "utf8"), customContent);
  });
});

// Coverage for design plan 0006 D1 (issue #128): setup scaffolds the
// onboarding-state marker file every step keys off of.

test("init scaffolds .onboarding-state.json with every step pending except setupComplete", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);
    assert.ok(fs.existsSync(paths.onboardingState));
    const state = JSON.parse(fs.readFileSync(paths.onboardingState, "utf8"));
    assert.deepEqual(state, defaultOnboardingState());
  });
});

test("init does not overwrite an existing .onboarding-state.json on re-run (idempotent)", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await command.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);

    const state = defaultOnboardingState();
    state.materialIngested = true;
    fs.writeFileSync(paths.onboardingState, JSON.stringify(state));

    await command.run({ workspace, noServe: true });

    assert.strictEqual(JSON.parse(fs.readFileSync(paths.onboardingState, "utf8")).materialIngested, true);
  });
});

test("init attempts to launch the local server by default, with the workspace/port/noOpen it was given", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    let callArgs = null;
    await command.run(
      { workspace, port: "5555", noOpen: true },
      { serveRunner: async (args) => { callArgs = args; }, openInBrowser: () => {} },
    );
    assert.deepEqual(callArgs, { workspace, port: "5555", noOpen: true });
  });
});

test("--noServe skips the launch attempt entirely", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    let launched = false;
    await command.run({ workspace, noServe: true }, { serveRunner: async () => { launched = true; }, openInBrowser: () => {} });
    assert.strictEqual(launched, false);
  });
});

function eaddrinuseError(port) {
  const error = new Error(`Port ${port} is already in use — pass --port <n> to use a different one.`);
  error.code = "EADDRINUSE";
  return error;
}

test("init treats an already-running server on the configured port as success, and still opens the browser", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    let openedUrl = null;
    await command.run(
      { workspace, port: "5555" },
      {
        serveRunner: async () => {
          throw eaddrinuseError(5555);
        },
        openInBrowser: (url) => {
          openedUrl = url;
        },
      },
    );
    assert.strictEqual(openedUrl, "http://localhost:5555/tracker.html", "should still open the browser against the already-running instance");
  });
});

test("init reusing an already-running server respects --noOpen (no browser tab either)", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    let opened = false;
    await command.run(
      { workspace, port: "5555", noOpen: true },
      { serveRunner: async () => { throw eaddrinuseError(5555); }, openInBrowser: () => { opened = true; } },
    );
    assert.strictEqual(opened, false, "--noOpen should suppress the browser open even on the reuse path");
  });
});

test("init propagates a launch failure that isn't a port conflict (no .code, or a different code)", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await assert.rejects(
      command.run({ workspace }, { serveRunner: async () => { throw new Error("boom"); }, openInBrowser: () => {} }),
      /boom/,
    );

    const wrongCode = new Error("permission denied");
    wrongCode.code = "EACCES";
    await assert.rejects(
      command.run({ workspace }, { serveRunner: async () => { throw wrongCode; }, openInBrowser: () => {} }),
      /permission denied/,
    );
  });
});

// Integration coverage (no mocks): exercises the real serve.js EADDRINUSE
// path end-to-end, closing the gap where every test above only verified
// init.js's reaction to a hand-authored mock error, not the actual error
// serve.js throws (its message text and .code could drift from the mock
// and every test above would stay green).
test("init reuses a real, already-listening serve.js instance on the same port (integration)", async () => {
  await withTempWorkspaceAsync(async (workspace) => {
    await command.run({ workspace, noServe: true });

    const realServe = require("../../src/cli/commands/serve");
    const runningServer = await realServe.run({ workspace, port: "0", noOpen: true });
    const realPort = runningServer.address().port;

    try {
      let openedUrl = null;
      await command.run(
        { workspace, port: String(realPort) },
        { serveRunner: realServe.run, openInBrowser: (url) => { openedUrl = url; } },
      );
      assert.strictEqual(
        openedUrl,
        `http://localhost:${realPort}/tracker.html`,
        "should detect the real EADDRINUSE, not throw, and open the browser against the already-running instance",
      );
    } finally {
      await new Promise((resolve) => runningServer.close(resolve));
    }
  });
});
