"use strict";

// On-demand PDF copy of a resume .docx, for the home page's "Open my resume".
// Browsers download a .docx instead of showing it; a PDF opens in a tab.
// The PDF is written next to the .docx (same name, .pdf) and reused until the
// .docx changes. Callers pass a path found by walking a fixed outputs folder,
// never a path taken from a request.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { findSoffice } = require("../cli/commands/export-pdf");

const CONVERT_TIMEOUT_MS = 120000;

let sofficeLookup;
// Looked up once per process; the home page asks on every refresh.
function cachedSoffice() {
  if (sofficeLookup === undefined) {
    try {
      sofficeLookup = findSoffice() || null;
    } catch (error) {
      sofficeLookup = null;
    }
  }
  return sofficeLookup;
}

function pdfPathFor(docxPath) {
  return path.join(path.dirname(docxPath), `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
}

function isFresh(pdfPath, docxPath) {
  try {
    return fs.statSync(pdfPath).mtimeMs >= fs.statSync(docxPath).mtimeMs;
  } catch (error) {
    return false;
  }
}

function defaultConvert(soffice, docxPath, outDir) {
  return new Promise((resolve) => {
    const profile = path.join(outDir, "profile");
    execFile(
      soffice,
      [`-env:UserInstallation=file://${profile}`, "--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
      { timeout: CONVERT_TIMEOUT_MS },
      (error) => resolve(!error),
    );
  });
}

const inFlight = new Map();

/**
 * Resolves to the PDF path for `docxPath`, converting when the cached copy is
 * missing or older than the .docx. Resolves to null when LibreOffice is not
 * available or the conversion fails.
 * deps: { findSoffice() -> path|null, convert(soffice, docx, outDir) -> Promise<boolean> }
 */
function ensureResumePdf(docxPath, deps = {}) {
  const pdfPath = pdfPathFor(docxPath);
  if (isFresh(pdfPath, docxPath)) return Promise.resolve(pdfPath);
  const soffice = (deps.findSoffice || cachedSoffice)();
  if (!soffice) return Promise.resolve(null);
  if (inFlight.has(pdfPath)) return inFlight.get(pdfPath);
  const job = (async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-pdf-"));
    try {
      const ok = await (deps.convert || defaultConvert)(soffice, docxPath, tmp);
      const produced = path.join(tmp, path.basename(pdfPath));
      if (!ok || !fs.existsSync(produced)) return null;
      fs.copyFileSync(produced, pdfPath);
      return pdfPath;
    } catch (error) {
      return null;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      inFlight.delete(pdfPath);
    }
  })();
  inFlight.set(pdfPath, job);
  return job;
}

// True when a PDF of this .docx can be had (already made, or LibreOffice exists).
function canMakePdf(docxPath, deps = {}) {
  return isFresh(pdfPathFor(docxPath), docxPath) || Boolean((deps.findSoffice || cachedSoffice)());
}

module.exports = { canMakePdf, ensureResumePdf, pdfPathFor };
