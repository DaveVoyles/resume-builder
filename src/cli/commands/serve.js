"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { resolveWorkspace, workspacePaths } = require("../../core/workspace");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const DEFAULT_PORT = 4321;

// Read-only change-detection signal (design plan 0006 D4, permitted by ADR
// 0003): reports tracker.html's own mtime so the tracker page's embedded
// client script can poll and reload itself when it changes, without adding
// any new persistent server-side state or a write endpoint.
const STATUS_ENDPOINT = "/__status";

function trackerStatus(root) {
  try {
    return { path: "tracker.html", mtimeMs: fs.statSync(path.join(root, "tracker.html")).mtimeMs };
  } catch (error) {
    return { path: "tracker.html", mtimeMs: null };
  }
}

function openInBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(opener, [url], () => {});
}

function trackerUrl(port) {
  return `http://localhost:${port}/tracker.html`;
}

function resolvePort(rawPort) {
  const parsed = Number.parseInt(rawPort, 10);
  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
}

async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const root = path.resolve(paths.outputs);

  if (!fs.existsSync(root)) {
    throw new Error(`No outputs/ directory found at ${root} — run build-tracker or tailor first.`);
  }

  const port = resolvePort(options.port);

  const server = http.createServer((req, res) => {
    const requestedPath = decodeURIComponent(req.url.split("?")[0]);

    if (requestedPath === STATUS_ENDPOINT) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(trackerStatus(root)));
      return;
    }

    const relativePath = requestedPath === "/" ? "/tracker.html" : requestedPath;
    const filePath = path.resolve(path.join(root, relativePath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Not found: ${relativePath}`);
        return;
      }
      const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
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
      const url = trackerUrl(server.address().port);
      console.log(`Serving ${root} at ${url}`);
      console.log("Press Ctrl+C to stop.");
      if (!options.noOpen) {
        openInBrowser(url);
      }
      resolve(server);
    });
  });
}

module.exports = { run, openInBrowser, trackerUrl, resolvePort, trackerStatus, DEFAULT_PORT, STATUS_ENDPOINT };
