"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { openInBrowser, resolvePort, DEFAULT_PORT, CONTENT_TYPES } = require("./serve");
const { DRAFT_FILENAME, writeFirstDraft } = require("../../core/first-draft");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const HOME_PAGE = path.join(REPO_ROOT, "onboarding", "home.html");
const BODY_LIMIT = 65536;

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
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, `Not found: ${path.basename(filePath)}`);
      return;
    }
    const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
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

function defaultOpenFolder(folderPath) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  execFile(opener, [folderPath], () => {});
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

async function run(options, { openFolder = defaultOpenFolder, openHome = openInBrowser } = {}) {
  if (!fs.existsSync(HOME_PAGE)) {
    throw new Error(`Onboarding home page not found at ${HOME_PAGE}`);
  }

  const root = path.resolve(options.root || REPO_ROOT);
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

    if (method === "GET" && requestedPath === "/api/documents") {
      sendJson(res, 200, { files: listFiles(documentsDir) });
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
          openFolder(folder);
          sendJson(res, 200, { opened: folder });
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
            const draft = writeFirstDraft({ outputDir, answers });
            sendJson(res, 200, {
              filename: draft.filename,
              displayPath: `resume-builder / output / ${draft.filename}`,
              url: `/output/${draft.filename}`,
              stub: true,
            });
          } catch (error) {
            if (error.code === "GOAL_REQUIRED") {
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
      console.log("This page is only on your computer. The design mock used port 3000; this repo uses 4321.");
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
  DRAFT_FILENAME,
  HOME_PAGE,
  REPO_ROOT,
};
