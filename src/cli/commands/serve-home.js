"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { openInBrowser, resolvePort, trackerStatus, DEFAULT_PORT, CONTENT_TYPES } = require("./serve");
const { identityHeaders, STATUS_ENDPOINT } = require("../../core/server-config");
const { saveHomeAnswers, readHomeFormPrefill, emptyHomeFormValues } = require("../../core/home-answers");
const { readJson, workspacePaths } = require("../../core/workspace");
const { countRoleStats } = require("../../core/role-view");
const { tryRebuildTrackers } = require("./build-tracker");

const {
  HOME_STEP_TO_TRACKER_STEPS,
  defaultOnboardingState,
  homeStepsFromOnboarding,
  isHomeSetupComplete,
  loadOnboardingState,
  nextHomeStep,
  onboardingSteps,
} = require("../../core/onboarding-state");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const HOME_PAGE = path.join(REPO_ROOT, "onboarding", "home.html");
const BODY_LIMIT = 65536;
const OPEN_FOLDER_TIMEOUT_MS = 5000;
const OPEN_FOLDER_TIMEOUT_ERROR = "Could not confirm the folder opened.";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function missingTrackerPage(workspaceLabel) {
  const command = escapeHtml(`npm run workspace:tracker:html -- --workspace ${workspaceLabel}`);
  const filePath = escapeHtml(`${workspaceLabel}/outputs/tracker.html`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tracker not built yet</title>
</head>
<body>
<h1>Tracker not built yet</h1>
<p>The job list is not on disk yet. Build it with:</p>
<pre>${command}</pre>
<p>Then open <a href="/tracker.html">/tracker.html</a> from the home page. The file also lives at <code>${filePath}</code> if you need a file fallback.</p>
<p><a href="/">Back to home</a></p>
</body>
</html>`;
}


function homeUrl(port) {
  return `http://localhost:${port}/`;
}

function resolveUnder(root, relativePath) {
  const rootResolved = path.resolve(root);
  const filePath = path.resolve(path.join(rootResolved, relativePath));
  if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return filePath;
}

function sendJson(res, status, body) {
  res.writeHead(status, identityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, identityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
  res.end(body);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, `Not found: ${path.basename(filePath)}`);
      return;
    }
    const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, identityHeaders({ "Content-Type": contentType }));
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        const error = new Error("Payload too large");
        error.code = "PAYLOAD_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isOpenSuccess(platform, error) {
  if (!error) {
    return true;
  }
  if (typeof error.code !== "number") {
    return false;
  }
  if (error.code === 0) {
    return true;
  }
  return platform === "win32" && error.code === 1;
}

function defaultOpenFolder(folderPath, { platform = process.platform, execFileImpl = execFile } = {}) {
  const opener = platform === "darwin" ? "open" : platform === "win32" ? "explorer" : "xdg-open";
  return new Promise((resolve, reject) => {
    execFileImpl(opener, [folderPath], (error) => {
      if (isOpenSuccess(platform, error)) {
        resolve();
        return;
      }
      reject(error);
    });
  });
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function resolveHomeWorkspace(root, options) {
  return path.resolve(root, options.workspace || "candidate");
}

function onboardingPayload(workspace) {
  const hasWorkspace =
    fs.existsSync(workspace) &&
    (fs.existsSync(path.join(workspace, "profile.json")) ||
      fs.existsSync(path.join(workspace, ".onboarding-state.json")));
  const state = hasWorkspace ? loadOnboardingState(workspace) : defaultOnboardingState();
  return {
    state,
    trackerSteps: onboardingSteps(state),
    homeSteps: homeStepsFromOnboarding(state),
    mapping: HOME_STEP_TO_TRACKER_STEPS,
    setupComplete: isHomeSetupComplete(state),
    nextStep: nextHomeStep(state),
    form: hasWorkspace ? readHomeFormPrefill(workspace) : emptyHomeFormValues(),
  };
}

function rolesPayload(workspace) {
  const paths = workspacePaths(workspace);
  const tracked = fs.existsSync(paths.rolesTracked) ? readJson(paths.rolesTracked, []) : [];
  const roles = Array.isArray(tracked) ? tracked : [];
  const stats = countRoleStats(roles);
  const hasWorkspace =
    fs.existsSync(workspace) &&
    (fs.existsSync(path.join(workspace, "profile.json")) ||
      fs.existsSync(path.join(workspace, ".onboarding-state.json")));
  const state = hasWorkspace ? loadOnboardingState(workspace) : defaultOnboardingState();
  return {
    roles: roles.map((role) => ({
      id: role.id || "",
      company: role.company || "",
      title: role.title || role.role || "",
    })),
    counts: {
      total: stats.total,
      readyToApply: stats.readyToApply,
      applied: stats.applied,
      interview: stats.interview,
      buckets: stats.buckets,
    },
    setupComplete: isHomeSetupComplete(state),
  };
}


async function run(options, { openFolder = defaultOpenFolder, openHome = openInBrowser, openFolderTimeoutMs = OPEN_FOLDER_TIMEOUT_MS, rebuildTrackers = tryRebuildTrackers } = {}) {
  if (!fs.existsSync(HOME_PAGE)) {
    throw new Error(`Onboarding home page not found at ${HOME_PAGE}`);
  }

  const root = path.resolve(options.root || REPO_ROOT);
  const workspace = resolveHomeWorkspace(root, options);
  const trackerFile = workspacePaths(workspace).htmlTracker;
  const workspaceLabel = options.workspace || "candidate";

  const documentsDir = path.join(root, "my-documents");
  const outputDir = path.join(root, "output");
  fs.mkdirSync(documentsDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const port = resolvePort(options.port);

  const server = http.createServer((req, res) => {
    const requestedPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const method = req.method || "GET";

    if (method === "GET" && requestedPath === "/") {
      serveFile(HOME_PAGE, res);
      return;
    }

    if (method === "GET" && requestedPath === "/tracker.html") {
      fs.stat(trackerFile, (error, stats) => {
        if (error || !stats.isFile()) {
          res.writeHead(404, identityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
          res.end(missingTrackerPage(workspaceLabel));
          return;
        }
        serveFile(trackerFile, res);
      });
      return;
    }


    if (method === "GET" && requestedPath === "/api/documents") {
      sendJson(res, 200, { files: listFiles(documentsDir) });
      return;
    }

    if (method === "GET" && requestedPath === "/api/onboarding-state") {
      sendJson(res, 200, onboardingPayload(workspace));
      return;
    }

    if (method === "GET" && requestedPath === "/api/roles") {
      sendJson(res, 200, rolesPayload(workspace));
      return;
    }

    if (method === "GET" && requestedPath === STATUS_ENDPOINT) {
      sendJson(res, 200, trackerStatus(path.dirname(trackerFile)));
      return;
    }

    if (method === "POST" && requestedPath === "/api/open-folder") {
      readBody(req)
        .then((raw) => {
          let body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch (error) {
            sendJson(res, 400, { error: "Invalid JSON." });
            return;
          }
          const folders = { "my-documents": documentsDir, output: outputDir };
          const folder = folders[body.folder];
          if (!folder) {
            sendJson(res, 400, { error: "Unknown folder." });
            return;
          }
          let responded = false;
          const respond = (status, payload) => {
            if (responded) {
              return;
            }
            responded = true;
            sendJson(res, status, payload);
          };
          const timer = setTimeout(() => {
            respond(504, { opened: false, error: OPEN_FOLDER_TIMEOUT_ERROR });
          }, openFolderTimeoutMs);
          return Promise.resolve()
            .then(() => openFolder(folder))
            .then(() => {
              clearTimeout(timer);
              respond(200, { opened: true });
            })
            .catch((error) => {
              clearTimeout(timer);
              respond(500, {
                opened: false,
                error: error && error.message ? String(error.message) : "Could not open folder.",
              });
            });
        })
        .catch((error) => {
          if (error.code === "PAYLOAD_TOO_LARGE") {
            sendJson(res, 413, { error: "Payload too large." });
            return;
          }
          sendJson(res, 400, { error: "Could not open folder." });
        });
      return;
    }

    if (method === "POST" && requestedPath === "/api/save-intake") {
      readBody(req)
        .then((raw) => {
          let answers;
          try {
            answers = raw ? JSON.parse(raw) : {};
          } catch (error) {
            sendJson(res, 400, { error: "Invalid JSON." });
            return;
          }
          if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
            sendJson(res, 400, { error: "Invalid JSON." });
            return;
          }
          try {
            const saved = saveHomeAnswers(workspace, answers);
            try {
              rebuildTrackers(workspace);
            } catch (error) {
              console.error(`Warning: tracker rebuild failed (${error && error.message ? error.message : error})`);
            }
            const payload = onboardingPayload(workspace);
            sendJson(res, 200, {
              message: saved.message,
              filename: saved.filename,
              displayPath: saved.displayPath,
              state: payload.state,
              homeSteps: payload.homeSteps,
              trackerSteps: payload.trackerSteps,
              mapping: payload.mapping,
              setupComplete: payload.setupComplete,
              nextStep: payload.nextStep,
              form: payload.form,
            });
          } catch (error) {
            if (error.code === "GOAL_REQUIRED" || error.code === "SALARY_INVALID") {
              sendJson(res, 400, { error: error.message });
              return;
            }
            throw error;
          }
        })
        .catch((error) => {
          if (error.code === "PAYLOAD_TOO_LARGE") {
            sendJson(res, 413, { error: "Payload too large." });
            return;
          }
          sendText(res, 500, "Could not save answers.");
        });
      return;
    }

    if (method === "GET" && requestedPath.startsWith("/my-documents/")) {
      const relative = requestedPath.slice("/my-documents/".length);
      const filePath = resolveUnder(documentsDir, relative);
      if (!filePath) {
        sendText(res, 403, "Forbidden");
        return;
      }
      serveFile(filePath, res);
      return;
    }

    if (method === "GET" && requestedPath.startsWith("/output/")) {
      const relative = requestedPath.slice("/output/".length);
      const filePath = resolveUnder(outputDir, relative);
      if (!filePath) {
        sendText(res, 403, "Forbidden");
        return;
      }
      serveFile(filePath, res);
      return;
    }

    sendText(res, 404, `Not found: ${requestedPath}`);
  });

  return new Promise((resolve, reject) => {
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        const wrapped = new Error(`Port ${port} is already in use — pass --port <n> to use a different one.`);
        wrapped.code = "EADDRINUSE";
        reject(wrapped);
        return;
      }
      reject(error);
    });

    server.listen(port, () => {
      const url = homeUrl(server.address().port);
      console.log(`RB home is running at ${url}`);
      console.log("This page is only on your computer.");
      console.log("Press Ctrl+C to stop.");
      if (!options.noOpen) {
        openHome(url);
      }
      resolve(server);
    });
  });
}

module.exports = {
  run,
  homeUrl,
  resolveUnder,
  DEFAULT_PORT,
  HOME_PAGE,
  REPO_ROOT,
  defaultOpenFolder,
  isOpenSuccess,
};
