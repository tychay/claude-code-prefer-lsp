#!/usr/bin/env node
'use strict';

const { deleteState } = require('./lib/session-state');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let cwd = process.cwd();
  try {
    const data = JSON.parse(raw || '{}');
    if (data.cwd && typeof data.cwd === 'string') cwd = data.cwd;
  } catch { /* ignore */ }

  deleteState(cwd);
  process.exit(0);
});
