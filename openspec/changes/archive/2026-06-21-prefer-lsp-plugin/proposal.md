## Why

The `~/.claude/rules/prefer-lsp.md` soft instruction is routinely ignored — Claude defaults to grep/find for code navigation even though LSP plugins are installed and enabled (typescript-lsp, pyright-lsp, php-lsp, markdown-oxide-lsp, ansible-lsp). A single-line rule cannot compete with hundreds of lines of system context. This causes unnecessary token burn (~40x more tokens per navigation operation vs LSP) and less accurate results.

A PreToolUse hook provides physical enforcement — code that runs on every tool call and cannot be "forgotten" by the model. The existing `claude-code-lsp-enforcement-kit` (315 stars) validates this approach but targets MCP-based LSP servers. We need a lighter-weight, nudge-based variant that works with the native Claude Code LSP tool from official plugins.

## What Changes

- New plugin `prefer-lsp` in the local marketplace with PreToolUse hooks that detect code-navigation patterns and inject LSP reminders
- Hooks fire on `Bash` (grep/find commands) and `Read` (code file reads) targeting LSP-supported file types
- Non-blocking nudge (exit 0 + additionalContext) — not blocking (exit 2) — to avoid chattiness/lockup issues
- Session state tracking: nudge once, suppress until context likely compacted (time + tool-call count threshold)
- Suppressable via `NOLSP=1` env prefix in Bash commands as escape hatch
- Provider awareness derived from installed `.lsp.json` plugin configs (not hardcoded file types)
- PostToolUse tracker counts successful LSP calls to know when enforcement is no longer needed
- SessionStart hook resets state for fresh enforcement each session
- Deletion of `~/.claude/rules/prefer-lsp.md` (replaced by this plugin)

## Capabilities

### New Capabilities
- `lsp-nudge-hook`: PreToolUse hook that detects navigational grep/find/read patterns on LSP-capable file types and injects a reminder via additionalContext
- `session-tracking`: State management across tool calls — nudge once, suppress, re-nudge after compaction threshold
- `provider-detection`: Reads installed `.lsp.json` plugin configs to determine which file types have LSP available and what operations are supported

### Modified Capabilities

## Impact

- `~/.claude/settings.json` — new entry in `enabledPlugins`
- `~/.claude/rules/prefer-lsp.md` — deleted (replaced by hook)
- `~/.claude/state/` — session state files created/cleaned per session
- All Claude Code sessions across all projects — plugin is global
- Token usage — expected significant reduction in navigation token spend
