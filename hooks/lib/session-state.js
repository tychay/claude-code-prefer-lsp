'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const STATE_DIR = path.join(os.homedir(), '.claude', 'state');
const RE_NUDGE_TIME_MS = 15 * 60 * 1000; // 15 minutes
const RE_NUDGE_CALLS = 20;

function getStatePath(cwd) {
  const hash = crypto.createHash('md5').update(cwd || process.cwd()).digest('hex').slice(0, 12);
  return path.join(STATE_DIR, `prefer-lsp-${hash}.json`);
}

function ensureStateDir() {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  } catch { /* silent */ }
}

function readState(cwd) {
  const fp = getStatePath(cwd);
  try {
    if (!fs.existsSync(fp)) return freshState();
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return data;
  } catch { return freshState(); }
}

function writeState(state, cwd) {
  ensureStateDir();
  const fp = getStatePath(cwd);
  try { fs.writeFileSync(fp, JSON.stringify(state)); } catch { /* silent */ }
}

function deleteState(cwd) {
  const fp = getStatePath(cwd);
  try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* silent */ }
}

function freshState() {
  return {
    nudged: false,
    timestamp: 0,
    toolCallsSinceNudge: 0,
    lspUsed: false,
    providerCache: null,
    providerCacheTime: 0,
  };
}

function shouldNudge(state) {
  if (state.lspUsed) return false;
  if (!state.nudged) return true;

  const timeElapsed = Date.now() - state.timestamp;
  const callsElapsed = state.toolCallsSinceNudge;
  return timeElapsed > RE_NUDGE_TIME_MS && callsElapsed > RE_NUDGE_CALLS;
}

function markNudged(state) {
  state.nudged = true;
  state.timestamp = Date.now();
  state.toolCallsSinceNudge = 0;
  return state;
}

function incrementCallCount(state) {
  state.toolCallsSinceNudge = (state.toolCallsSinceNudge || 0) + 1;
  return state;
}

function markLspUsed(state) {
  state.lspUsed = true;
  return state;
}

module.exports = {
  readState,
  writeState,
  deleteState,
  freshState,
  shouldNudge,
  markNudged,
  incrementCallCount,
  markLspUsed,
  getStatePath,
  RE_NUDGE_TIME_MS,
  RE_NUDGE_CALLS,
};
