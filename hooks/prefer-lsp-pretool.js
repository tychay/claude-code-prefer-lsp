#!/usr/bin/env node
'use strict';

const { detectProviders, isLspCapable, buildNudgeMessage } = require('./lib/detect-providers');
const { readState, writeState, shouldNudge, markNudged, incrementCallCount } = require('./lib/session-state');

const ZERO_WIDTH = /[­​-\u200F⁠-⁤﻿]/g;

const ANSIBLE_PATH_RE = /\b(ansible|playbook|roles|tasks|handlers|inventories|group_vars|host_vars)\b/i;
const VAULT_PATH_RE = /tychay-ai-vault/;
const MARKDOWN_NAV_RE = /\[\[|\bfrontmatter\b|\btags?:/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  const toolName = data.tool_name || '';
  if (toolName !== 'Bash' && toolName !== 'Read') process.exit(0);

  const state = readState();
  const providers = detectProviders(state);

  // Update provider cache if needed
  if (!state.providerCache || (Date.now() - (state.providerCacheTime || 0)) > 3600000) {
    state.providerCache = providers;
    state.providerCacheTime = Date.now();
  }

  let shouldFire = false;
  let detectedExt = null;

  if (toolName === 'Bash') {
    const result = checkBash(data.tool_input, providers);
    shouldFire = result.fire;
    detectedExt = result.ext;
  } else if (toolName === 'Read') {
    const result = checkRead(data.tool_input, providers);
    shouldFire = result.fire;
    detectedExt = result.ext;
  }

  if (!shouldFire) {
    incrementCallCount(state);
    writeState(state);
    process.exit(0);
  }

  if (!shouldNudge(state)) {
    incrementCallCount(state);
    writeState(state);
    process.exit(0);
  }

  // Fire the nudge
  const message = buildNudgeMessage(detectedExt, providers);
  if (!message) {
    incrementCallCount(state);
    writeState(state);
    process.exit(0);
  }

  markNudged(state);
  writeState(state);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: message,
    },
  }));
  process.exit(0);
});

function checkBash(toolInput, providers) {
  const cmd = String(toolInput?.command ?? '').trim().replace(ZERO_WIDTH, '');

  // NOLSP suppression
  if (/NOLSP=1/i.test(cmd)) return { fire: false };

  // Must contain grep/rg/ag/ack
  if (!/\b(grep|rg|ag|ack)\b/i.test(cmd)) return { fire: false };

  // Exclude git grep
  if (/\bgit\s+grep\b/i.test(cmd)) return { fire: false };

  // Exclude non-code file targets
  if (/--include=?\S*\.(sql|json|yaml|yml|txt|env|sh|css|scss|log|toml|xml)\b/i.test(cmd)) {
    // But allow yaml if ansible path
    if (/--include=?\S*\.(yaml|yml)\b/i.test(cmd) && ANSIBLE_PATH_RE.test(cmd)) {
      // fall through — this IS an ansible yaml grep
    } else {
      return { fire: false };
    }
  }

  // Extract search pattern
  const cleaned = cmd.replace(/\\"/g, '"');
  const patternMatch =
    cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*"([^"]+)"/i) ||
    cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*'([^']+)'/i) ||
    cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*(\S+)/i);

  if (!patternMatch) return { fire: false };

  const fullPattern = patternMatch[1];

  // Markdown special case: only fire for vault path + nav patterns
  if (/\.md\b/i.test(cmd) || VAULT_PATH_RE.test(cmd)) {
    if (!VAULT_PATH_RE.test(cmd)) return { fire: false };
    if (!MARKDOWN_NAV_RE.test(fullPattern)) return { fire: false };
    return { fire: true, ext: '.md' };
  }

  // Check for code symbols (adapted from enforcement-kit)
  const parts = fullPattern
    .split(/\\?\||\./)
    .map(p => p.replace(ZERO_WIDTH, '').replace(/[*+?^${}()[\]\\]/g, '').trim())
    .filter(Boolean);

  const symbols = parts.filter(p => {
    if (p.length < 4 || /\s/.test(p)) return false;
    const skip = [
      /^(TODO|FIXME|HACK|XXX|NOTE)/i,
      /^console\b/, /^import\b/, /^export\b/, /^http/i, /^\d/,
      /^[A-Z_]{3,}$/, /^[a-z]{1,8}$/, /^[a-z]+-[a-z]+/,
    ];
    if (skip.some(rx => rx.test(p))) return false;
    return (/^[a-z][a-zA-Z0-9]{3,}$/.test(p) && /[A-Z]/.test(p)) ||
           /^[A-Z][a-zA-Z][a-zA-Z0-9]{2,}$/.test(p) ||
           (/^[a-z]+(_[a-z]+){2,}$/.test(p) && p.length >= 9);
  });

  if (symbols.length === 0) return { fire: false };

  // Determine target extension
  const ext = detectTargetExtension(cmd, providers);
  if (!ext) return { fire: false };

  // Ansible YAML: only fire if path matches
  if ((ext === '.yml' || ext === '.yaml') && !ANSIBLE_PATH_RE.test(cmd)) {
    return { fire: false };
  }

  return { fire: true, ext };
}

function checkRead(toolInput, providers) {
  const filePath = String(toolInput?.file_path ?? '').trim();
  if (!filePath) return { fire: false };

  const ext = '.' + filePath.split('.').pop();

  // Markdown: only in vault context
  if (ext === '.md') {
    if (!VAULT_PATH_RE.test(filePath)) return { fire: false };
    return { fire: true, ext };
  }

  // YAML: only ansible paths
  if (ext === '.yml' || ext === '.yaml') {
    if (!ANSIBLE_PATH_RE.test(filePath)) return { fire: false };
    return { fire: true, ext };
  }

  if (!isLspCapable(ext, providers)) return { fire: false };
  return { fire: true, ext };
}

function detectTargetExtension(cmd, providers) {
  // Check --include patterns
  const includeMatch = cmd.match(/--include=?\S*\.(\w+)/i);
  if (includeMatch) {
    const ext = '.' + includeMatch[1];
    if (isLspCapable(ext, providers)) return ext;
  }

  // Check for code path indicators + known extensions in command
  const extMatch = cmd.match(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|py|pyi|php|yml|yaml|md)\b/i);
  if (extMatch) {
    const ext = '.' + extMatch[1].toLowerCase();
    if (isLspCapable(ext, providers)) return ext;
  }

  // Check for src/ or similar code directories
  if (/\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]/i.test(cmd)) {
    return '.ts'; // default assumption for code dirs
  }

  return null;
}
