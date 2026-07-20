"use strict";

/**
 * Shared docx-building primitives (design plan 0001, D2). Ported from the
 * private upstream implementation's resume-generation engine (battle-tested
 * across 74 real role renders there) and genericized: every function here is
 * a pure styling primitive with no candidate-specific data baked in. Contact
 * info, education, publications, and speaking content all come from the
 * resume config (see src/core/resume-config.js) instead of module-level
 * constants — this file used to hardcode one person's name, email, schools,
 * and publication history, which has no place in a reusable public engine.
 */

const {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  BorderStyle,
  WidthType,
  LevelFormat,
  ExternalHyperlink,
} = require("docx");

const COLOR = { name: "1F3864", rule: "2E75B6", gray: "595959", light: "AAAAAA" };

function stripEmoji(text) {
  return text
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}][️]?\s*/u, "")
    .trim();
}

// Replace the trailing "Strong/Exceptional fit for..." sentence with a role-specific
// one. If no existing fit sentence is found, the override is appended. Pass null/undefined
// to keep the config's own summary text unchanged.
function injectFit(summary, fitOverride) {
  if (!fitOverride) return summary;
  const replaced = summary.replace(/((?:Strong|Exceptional) fit for [^.]+\.)/, fitOverride);
  if (replaced === summary) return summary.trimEnd() + " " + fitOverride;
  return replaced;
}

function name(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 40, bold: true, color: COLOR.name })],
  });
}

function contactLine(parts) {
  const children = [];
  parts.forEach((p, i) => {
    if (i > 0) children.push(new TextRun({ text: "  |  ", font: "Arial", size: 18, color: COLOR.light }));
    if (p.link) {
      children.push(
        new ExternalHyperlink({
          link: p.link,
          children: [new TextRun({ text: p.text, font: "Arial", size: 18, color: COLOR.rule, underline: {}, noProof: true })],
        }),
      );
    } else {
      children.push(new TextRun({ text: p.text, font: "Arial", size: 18, color: COLOR.gray }));
    }
  });
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children });
}

function rule() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.rule, space: 1 } },
    children: [],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: text.toUpperCase(), font: "Arial", size: 22, bold: true, color: COLOR.rule, allCaps: false })],
  });
}

function jobHeader(title, company, dates) {
  return new Paragraph({
    spacing: { before: 120, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: title, font: "Arial", size: 22, bold: true }),
      new TextRun({ text: "  —  ", font: "Arial", size: 22, color: COLOR.gray }),
      new TextRun({ text: company, font: "Arial", size: 22, bold: true, color: COLOR.rule }),
      new TextRun({ text: "   ", font: "Arial", size: 22 }),
      new TextRun({ text: "\t", font: "Arial", size: 22 }),
      new TextRun({ text: dates, font: "Arial", size: 20, italics: true, color: COLOR.gray }),
    ],
  });
}

function subHeader(text) {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, italics: true, color: COLOR.gray })],
  });
}

function bullet(text, boldPrefix) {
  const cleanText = stripEmoji(text);
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({ text: boldPrefix + " ", font: "Arial", size: 20, bold: true }));
    children.push(new TextRun({ text: cleanText, font: "Arial", size: 20 }));
  } else {
    children.push(new TextRun({ text: cleanText, font: "Arial", size: 20 }));
  }
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children,
  });
}

// Splits on blank lines ("\n\n") into one docx Paragraph per block, so a multi-idea
// summary reads as short paragraphs instead of one dense block. Falls back to splitting
// before a trailing "Strong/Exceptional/Suitable fit for..." sentence for single-block text.
function para(text, opts = {}) {
  if (typeof text === "string" && text.includes("\n\n")) {
    const blocks = text
      .split(/\n{2,}/u)
      .map((b) => b.trim())
      .filter(Boolean);
    if (blocks.length > 1) {
      return blocks.map(
        (block, i) =>
          new Paragraph({
            spacing: { before: i === 0 ? 40 : 120, after: 40 },
            children: [new TextRun({ text: block, font: "Arial", size: 20, italics: opts.italics, color: opts.color })],
          }),
      );
    }
  }
  if (typeof text === "string") {
    const splitIndex = text.search(/\b(exceptional|strong|suitable)\s+fit\s+for\b/iu);
    if (splitIndex > 0) {
      const firstPart = text.slice(0, splitIndex).trim();
      const secondPart = text.slice(splitIndex).trim();
      return [
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: firstPart, font: "Arial", size: 20, italics: opts.italics, color: opts.color })],
        }),
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [new TextRun({ text: secondPart, font: "Arial", size: 20, italics: opts.italics, color: opts.color })],
        }),
      ];
    }
  }
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 20, italics: opts.italics, color: opts.color })],
  });
}

function skillsRow(label, value) {
  const border = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        borders,
        margins: { top: 50, bottom: 50, left: 0, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: "Arial", size: 20, bold: true })] })],
      }),
      new TableCell({
        width: { size: 7160, type: WidthType.DXA },
        borders,
        margins: { top: 50, bottom: 50, left: 0, right: 0 },
        children: [new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 20 })] })],
      }),
    ],
  });
}

function skillsTable(skills) {
  return new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [2200, 7880],
    rows: skills.map(([l, v]) => skillsRow(l, v)),
  });
}

function jobBlock(title, company, dates, subheaderText, bullets) {
  const children = [jobHeader(title, company, dates)];
  if (subheaderText) children.push(subHeader(subheaderText));
  children.push(...bullets.map((b) => bullet(b)));
  return children;
}

// Renders a generic {degree|title|heading, institution|publisher|organizations, dates, details?}
// entry the same way a job block is rendered, for education/publications/speaking sections.
function entryBlock(primary, secondary, dates, details) {
  const children = [jobHeader(primary, secondary, dates)];
  if (details) children.push(para(details, { color: COLOR.gray }));
  return children;
}

function numbering() {
  return {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 400, hanging: 200 } } },
          },
        ],
      },
    ],
  };
}

function pageProps() {
  return {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
    },
  };
}

function docFrom(children) {
  const flatChildren = children.flat(Infinity);
  return new Document({ numbering: numbering(), sections: [{ properties: pageProps(), children: flatChildren }] });
}

module.exports = {
  COLOR,
  stripEmoji,
  injectFit,
  name,
  contactLine,
  rule,
  sectionHeading,
  jobHeader,
  subHeader,
  bullet,
  para,
  skillsRow,
  skillsTable,
  jobBlock,
  entryBlock,
  numbering,
  pageProps,
  docFrom,
};
