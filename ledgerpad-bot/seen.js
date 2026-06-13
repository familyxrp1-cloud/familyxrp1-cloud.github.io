/**
 * Persistent seen-set backed by a local JSON file.
 * Prevents double-tweeting the same launch or graduation.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'seen-launches.json');

function load() {
  try {
    return new Set(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return new Set();
  }
}

function save(set) {
  fs.writeFileSync(FILE, JSON.stringify([...set]), 'utf8');
}

const _seen = load();

function has(id) {
  return _seen.has(id);
}

function add(id) {
  _seen.add(id);
  save(_seen);
}

module.exports = { has, add };
