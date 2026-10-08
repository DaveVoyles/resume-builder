"use strict";

const fs = require("fs");
const path = require("path");
const { fillPracticeForm, readPracticeTemplate } = require("../src/core/fill-practice-form");

const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "examples", "practice-application.html");
const outPath = path.join(root, "examples", "practice-application.filled.html");

const profile = {
  name: "Alex Rivera",
  email: "alex.rivera@example.invalid",
  phone: "555-0100",
  location: "Raleigh, NC",
};

const template = readPracticeTemplate(templatePath);
const filled = fillPracticeForm(template, profile);
fs.writeFileSync(outPath, filled.html);
console.log(`Filled practice form: ${outPath}`);
console.log(`Left blank: ${filled.missing.join(", ")}`);
console.log("Submitted: no");
