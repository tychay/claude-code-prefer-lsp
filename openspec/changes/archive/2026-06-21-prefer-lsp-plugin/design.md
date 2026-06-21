## Context

Claude Code has a native LSP tool (via plugins like `typescript-lsp@claude-plugins-official`) that provides goToDefinition, findReferences, hover, workspaceSymbol, etc. Five LSP plugins are installed globally. Despite a `prefer-lsp.md` rule, the model routinely greps for symbols instead.

The `claude-code-lsp-enforcement-kit` (nesaminua, 315 stars) solves this with blocking hooks targeting MCP-based LSP servers (`cclsp`/`Serena`). We adapt their session-tracking and symbol-detection patterns into a lighter nudge-based plugin that works with the native LSP tool.

Reference implementation cloned at `/tmp/lsp-enforcement-kit/`.

## Goals / Non-Goals

**Goals:**
- Remind Claude to use LSP on the first navigational grep/find/read per session
- "Nudge once, Claude figures it out" — one reminder is sufficient for the model to switch behavior
- Suppress after first nudge; re-nudge only after compaction likely dropped it from context
- Detect available LSP capabilities from installed plugin `.lsp.json` configs (not hardcoded)
- Provide escape hatch (`NOLSP=1` prefix) for when LSP is misconfigured
- Clean session state on session start

**Non-Goals:**
- Blocking tool calls (exit 2) — too aggressive, causes lockups
- Supporting MCP-based LSP servers (cclsp/Serena) — we use native LSP tool
- Gating every Read (the kit's progressive gate system) — overkill for nudge philosophy
- Catching every possible navigation pattern — one trigger per session is enough

## Decisions

### 1. Nudge via additionalContext, not block

**Choice:** Exit 0 with `hookSpecificOutput.additionalContext` injection. Never exit 2.

**Why:** The enforcement-kit uses two blocking strategies — permanent block on grep (with copy-pasteable MCP command), progressive gating on Read (release after proven LSP usage). This works for them because MCP guarantees availability, their block messages are parametrized with exact commands, and they only target unambiguous code extensions.

Our context differs critically:
1. Plugin LSP is less guaranteed — language server may not be started/indexed
2. We cannot parametrize a redirect — the LSP tool needs `filePath`, `line`, `character` which we don't know from the grep command alone
3. Extension boundaries are blurry — `.md` and `.yml` are only LSP-relevant in specific contexts (vault paths, ansible paths)

One reminder per session is sufficient for the model to switch behavior. This is a positive design choice, not merely avoidance of blocking.

**Alternatives rejected:**
- Block always (kit's grep model): without copy-pasteable redirects and with blurry extensions, causes dead ends and lockups
- Block until compliance (kit's Read model): without MCP guarantees, redirect may fail repeatedly
- Block once then suppress: dead end risk if LSP unavailable on first detection

See ADR-0001 and `docs/enforcement-kit-analysis.md` for full rationale.

### 2. Session state in `~/.claude/state/` with time + count re-nudge

**Choice:** JSON file keyed by `md5(cwd).slice(0,12)` storing `{ nudged: true, timestamp, toolCallsSinceNudge, lspUsed }`. Re-nudge when BOTH: >15 minutes elapsed AND >20 non-LSP tool calls since last nudge.
**Why:** Context compaction may drop the earlier nudge. The kit uses 24h expiry; we use shorter windows since we're nudging, not blocking.
**Alternative rejected:** Once-per-session-forever (insufficient if context compacts). Every-call (too chatty).

### 3. Provider detection as ordered strategy list

**Choice:** `detect-providers.js` is structured as an ordered list of detection strategies. First match wins per extension:
1. Scan `.lsp.json` in installed Claude Code plugins (current, only active strategy)
2. (Future) Scan MCP server configs for known LSP gateways (cclsp, Serena, lsp-tools-mcp)
3. No LSP found → skip extension

**Why strategy list:** Enables future cross-compatibility with OpenCode (MCP-based LSP) and users with MCP language server gateways but no Claude Code native LSP. Adding MCP detection is additive — one new strategy function — not a rewrite.
**Why .lsp.json primary:** It's the authoritative source Claude Code uses to start language servers. Automatically picks up new plugins without code changes.
**Nudge messages are provider-agnostic:** Name operations (goToDefinition, findReferences) not tool-call syntax (mcp__cclsp__*), so they work regardless of which strategy resolved the capability.
**Alternative rejected:** Hardcoded extension list (brittle). Single-strategy architecture (paints into a corner for MCP fallback).

### 4. Hook on Bash AND Read matchers

**Choice:** `hooks.json` matcher: `"Bash|Read"`. Single hook script handles both.
**Why:** The kit shows Read gating catches cases where Claude reads entire files to find definitions. Even as a nudge, catching the first Read of a code file is valuable.
**Differentiation:** For Bash, detect grep/find patterns. For Read, check file extension against LSP-capable set.

### 5. Bash pattern detection (stolen from enforcement-kit)

**Choice:** Adapted from `bash-grep-block.js` symbol detection:
- Match `grep|rg|ag|ack` (not `git grep`)
- Extract search pattern, split on `|` and `.`
- Check for camelCase/PascalCase/snake_case identifiers (>= 4 chars)
- Exclude: TODO/FIXME, console/import/export keywords, ALL_CAPS constants, short lowercase words, kebab-case

**Additional heuristics for our file types:**
- Ansible YAML: only fire if path contains ansible/playbook/roles/tasks/handlers/inventories/group_vars/host_vars
- Markdown: only fire if path contains `tychay-ai-vault` AND pattern is `[[` (wikilink) or frontmatter field

### 6. Suppressable via env prefix

**Choice:** If command starts with `NOLSP=1 ` or contains `NOLSP=1`, skip hook entirely.
**Why:** Escape hatch for misconfigured LSP, CI environments, or deliberate grep usage.

### 7. JavaScript (Node.js) for hook implementation

**Choice:** `.js` files using Node.js built-ins (fs, path, crypto, os).
**Why:** Matches the enforcement-kit's pattern (proven to work in Claude Code hook context). Plugin hooks need fast startup — Node.js is already available. Python would work but adds an interpreter dependency.

### 8. PostToolUse tracker for LSP usage

**Choice:** PostToolUse hook on `LSP` tool matcher. When Claude successfully uses LSP, mark `lspUsed: true` in session state. This suppresses future nudges for the remainder of the session.
**Why:** Once Claude uses LSP, it has "learned" for this session — no more nudges needed.

### 9. SessionStart reset

**Choice:** SessionStart hook deletes the state file for cwd.
**Why:** Each new session starts fresh. Stolen directly from the kit's `lsp-session-reset.js`.

## Risks / Trade-offs

- **[False positives on Bash detection]** → Nudge is non-blocking and fires at most once per session (suppressed after first nudge), so false positives are cheap — one extra context line that Claude ignores if irrelevant.
- **[.lsp.json scanning adds startup latency]** → Cache results in state file; only re-scan if state is stale (>1h). First-call overhead ~10ms (file reads are fast).
- **[Re-nudge threshold too aggressive/conservative]** → Start with 15min + 20 calls. Tune based on real usage. Can be made configurable later.
- **[NOLSP prefix leaking into actual commands]** → Document that it's a hook suppression signal, not a real env var. It's stripped before pattern matching.
