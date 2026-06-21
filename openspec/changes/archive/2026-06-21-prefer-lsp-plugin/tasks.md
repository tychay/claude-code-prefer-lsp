## 1. Plugin Scaffold

- [x] 1.1 Create `.claude-plugin/plugin.json` manifest (name: prefer-lsp, version 1.0.0)
- [x] 1.2 Create `hooks/hooks.json` registering PreToolUse (matcher: `Bash|Read`), PostToolUse (matcher: `LSP`), and SessionStart hooks — nudge only, never block (ADR-0001)

## 2. Provider Detection

- [x] 2.1 Create `hooks/lib/detect-providers.js` — ordered strategy list pattern (ADR-0002): currently only `.lsp.json` scan, but structured so MCP config scan can be added as a second strategy without rewrite
- [x] 2.2 Add caching logic — store/read provider map in session state, refresh if >1h old
- [x] 2.3 Add nudge message builder — given a file extension, returns the available LSP operations as a formatted string

## 3. Session State Management

- [x] 3.1 Create `hooks/lib/session-state.js` — read/write `~/.claude/state/prefer-lsp-<hash>.json`, ensure state dir exists
- [x] 3.2 Implement state schema: `{ nudged, timestamp, toolCallsSinceNudge, lspUsed, providerCache, providerCacheTime }`
- [x] 3.3 Implement re-nudge threshold logic (>15min AND >20 calls AND !lspUsed)

## 4. PreToolUse Hook (Main)

- [x] 4.1 Create `hooks/prefer-lsp-pretool.js` — stdin parser, tool_name dispatch (Bash vs Read)
- [x] 4.2 Implement Bash detection: grep/rg/ag/ack symbol extraction (adapted from enforcement-kit `bash-grep-block.js`)
- [x] 4.3 Implement Read detection: check file extension against LSP-capable set
- [x] 4.4 Implement Ansible YAML path heuristic (only fire for ansible-related paths)
- [x] 4.5 Implement Markdown vault heuristic (only fire for `tychay-ai-vault` paths with wikilink/frontmatter patterns)
- [x] 4.6 Implement NOLSP=1 suppression check
- [x] 4.7 Implement nudge-once logic: check session state, skip if already nudged and thresholds not met, increment counter

## 5. PostToolUse Tracker

- [x] 5.1 Create `hooks/prefer-lsp-posttool.js` — fires on LSP tool, marks `lspUsed: true` on success
- [x] 5.2 Handle LSP error responses — do not mark lspUsed if LSP returned an error

## 6. SessionStart Reset

- [x] 6.1 Create `hooks/prefer-lsp-session-reset.js` — deletes state file for cwd on session start

## 7. Integration & Verification

- [x] 7.1 Test hook manually: `echo '{"tool_name":"Bash","tool_input":{"command":"grep -r handleSubmit src/"}}' | node hooks/prefer-lsp-pretool.js`
- [x] 7.2 Test suppression: verify `NOLSP=1` prefix skips hook, verify git grep skips, verify non-code files skip
- [x] 7.3 Test Read detection: `echo '{"tool_name":"Read","tool_input":{"file_path":"src/index.ts"}}' | node hooks/prefer-lsp-pretool.js`
- [x] 7.4 Enable plugin in `~/.claude/settings.json` (`"prefer-lsp@my-local-claudecode-marketplace": true`)
- [x] 7.5 Delete `~/.claude/rules/prefer-lsp.md`
- [x] 7.6 Start new session, grep a TypeScript symbol, verify nudge appears in transcript
- [x] 7.7 Verify nudge suppresses on subsequent greps within same session
- [x] 7.8 Use LSP tool, verify PostToolUse tracker marks lspUsed and fully suppresses
