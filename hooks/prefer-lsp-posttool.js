#!/usr/bin/env node
'use strict';

const { readState, writeState, markLspUsed } = require('./lib/session-state');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  if (data.tool_name !== 'LSP') process.exit(0);

  const resp = data.tool_response || data.result || {};

  // Don't mark lspUsed if the tool returned an error
  if (isError(resp)) process.exit(0);

  const state = readState();
  markLspUsed(state);
  writeState(state);
  process.exit(0);
});

function isError(resp) {
  if (!resp) return true;
  if (resp.is_error === true || resp.isError === true || resp.error) return true;
  const s = typeof resp === 'string' ? resp : JSON.stringify(resp);
  if (/^Error[: ]|no server|not configured|server is not available/i.test(s)) return true;
  return false;
}
