"use strict";

function setOption(options, key, value) {
  if (Object.prototype.hasOwnProperty.call(options, key)) {
    options[key] = Array.isArray(options[key]) ? options[key].concat(value) : [options[key], value];
  } else {
    options[key] = value;
  }
}

function parseArgs(argv) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/su).filter((part) => part !== undefined);
    const key = rawKey.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      setOption(options, key, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      setOption(options, key, next);
      index += 1;
    } else {
      setOption(options, key, true);
    }
  }
  return options;
}

function asArray(value) {
  if (value === undefined || value === false) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { asArray, parseArgs };
