"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function findSoffice() {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(finder, ["soffice"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/u)[0].trim() || null;
}

function run(options, deps = {}) {
  const find = deps.findSoffice || findSoffice;
  const exec = deps.spawnSync || spawnSync;
  if (typeof options.docx !== "string") {
    throw new Error("export-pdf requires --docx <file.docx>");
  }
  const docx = path.resolve(process.cwd(), options.docx);
  if (!fs.existsSync(docx)) throw new Error(`DOCX not found: ${docx}`);

  const soffice = find();
  if (!soffice) {
    throw new Error("export-pdf needs LibreOffice. Install LibreOffice so the `soffice` command is on your PATH.");
  }

  const out = path.resolve(
    process.cwd(),
    typeof options.out === "string" ? options.out : docx.replace(/\.docx$/iu, ".pdf")
  );
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "export-pdf-"));
  try {
    const result = exec(soffice, ["--headless", "--convert-to", "pdf", "--outdir", tmp, docx], { encoding: "utf8" });
    const produced = path.join(tmp, `${path.basename(docx, path.extname(docx))}.pdf`);
    if (result.status !== 0 || !fs.existsSync(produced)) {
      throw new Error(`soffice failed to convert ${docx}: ${(result.stderr || "").trim()}`);
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(produced, out);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`Wrote ${out}`);
  return out;
}

module.exports = { run, findSoffice };
