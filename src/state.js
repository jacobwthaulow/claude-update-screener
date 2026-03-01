import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '..', 'state.json');

let state = {};

export function loadState() {
  try {
    const raw = readFileSync(STATE_PATH, 'utf-8');
    state = JSON.parse(raw);
  } catch {
    state = {};
  }
  return state;
}

export function getSourceState(key) {
  return state[key] ?? null;
}

export function setSourceState(key, value) {
  state[key] = value;
}

export function saveState() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Check if a source is running for the first time (no prior state).
 * On first run we initialize state without sending notifications.
 */
export function isFirstRun(key) {
  return state[key] === undefined || state[key] === null;
}
