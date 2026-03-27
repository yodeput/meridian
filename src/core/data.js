/**
 * Centralized data I/O for all runtime JSON state files.
 *
 * All state files live in data/. No other module should use
 * fs.readFileSync / fs.writeFileSync for data files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

/**
 * Read and parse a JSON file from the data/ directory.
 * @param {string} filename - e.g. "lessons.json"
 * @returns {object|null}
 */
export function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write an object as JSON to the data/ directory.
 * @param {string} filename - e.g. "lessons.json"
 * @param {object} data
 */
export function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
