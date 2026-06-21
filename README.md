# Prefer LSP

A Claude Code plugin that nudges Claude to use LSP tools instead of grep/find for code navigation — saving ~40x tokens per operation.

## In Action

When Claude tries to `grep handleSubmit src/` or reads a `.ts` file to find a definition, the hook injects a one-time-per-session reminder via `additionalContext`:

```
LSP is available for typescript files. Use the LSP tool for goToDefinition,
findReferences, workspaceSymbol, hover, documentSymbol — it's faster and more
accurate than grep/find. Fall back to grep/find only if LSP returns no result.
```

Non-blocking. Claude sees the nudge, switches to LSP, and the nudge suppresses for the "rest" of the session. Because it is a nudge, we don't have to do this aggressively and we can nudge later in the session in case it may have fallen out of context.

## Why This Plugin Exists

- **Language servers give Claude deterministic navigation.** Go-to-definition, find-references, and workspace-symbol return precise AST-based results in ~80 tokens. Grep returns 23 noisy matches in ~1500 tokens, then Claude reads 2-3 wrong files before finding the right one.

- **Claude Code has native LSP support** via official plugins (`typescript-lsp`, `pyright-lsp`, `php-lsp`) and community plugins (`markdown-oxide-lsp`, `ansible-lsp`). The infrastructure is there — but Claude routinely ignores soft rules (`.claude/rules/`) telling it to prefer LSP. This feature was added in December 2025 but it is still (late Jun 2026) gated behind a feature flag. Before this, (and it is still a common pattern to use), the only way to do this was via an LSP-to-MCP Bridge.

- **A PreToolUse hook can't be "forgotten."** It runs on every tool call regardless of context window pressure, compaction, or system prompt length. One nudge is enough — once reminded, Claude uses LSP for the rest of the session… hopefully!

## Why Not `claude-code-lsp-enforcement-kit`?

[`nesaminua/claude-code-lsp-enforcement-kit`](https://github.com/nesaminua/claude-code-lsp-enforcement-kit) (315+ stars) is an excellent solution for MCP-based LSP setups (cclsp, Serena). We built this plugin for two reasons:

1. **Native LSP preference.** We use Claude Code's built-in LSP tool (from official plugins), not MCP-based language servers. The enforcement-kit's block messages are parametrized with `mcp__cclsp__*` commands that don't apply here.

2. **Nudge model vs. blocking.** The enforcement-kit permanently blocks grep and progressively gates reads. This works when you can provide a copy-pasteable redirect command. With native LSP (which needs `filePath`, `line`, `character`), we can't parametrize the redirect — so we nudge once and let Claude figure out the right LSP call.

For a detailed comparison, see [`docs/enforcement-kit-analysis.md`](docs/enforcement-kit-analysis.md).

## Prerequisites

You need language servers installed and Claude Code LSP plugins enabled **before** this plugin adds value. This plugin doesn't provide LSP — it reminds Claude to use LSP that's already available.

See [`docs/lsp-setup-guide.md`](docs/lsp-setup-guide.md) for installation guidance covering TypeScript, Python, PHP, Markdown (Obsidian), and Ansible.

## Installation

### From a plugin marketplace

```bash
claude plugin install prefer-lsp@<your-marketplace>
```

### From a local directory

```bash
claude plugin install --source directory --path /path/to/prefer-lsp
```

### From GitHub

```bash
git clone https://github.com/tychay/claude-code-prefer-lsp.git
claude plugin install --source directory --path ./claude-code-prefer-lsp
```

After install, reload Claude Code (Cmd-Shift-P → "Developer: Reload Window" in VS Code).

## How It Works

| Hook | Event | What it does |
|------|-------|--------------|
| `prefer-lsp-pretool.js` | PreToolUse (Bash\|Read) | Detects grep/rg/ag/ack for code symbols, or Read of LSP-capable file types. Injects nudge via `additionalContext`. |
| `prefer-lsp-posttool.js` | PostToolUse (LSP) | Tracks successful LSP usage. Once Claude uses LSP, all further nudges are suppressed. |
| `prefer-lsp-session-reset.js` | SessionStart | Deletes session state so each new session starts with fresh enforcement. |

**Session lifecycle:**
1. Session starts → state reset
2. First navigational grep/read detected → nudge fires once
3. Claude uses LSP → `lspUsed` marked, nudges permanently suppressed
4. If Claude doesn't use LSP but context compacts (>15min AND >20 tool calls) → re-nudge

**Bash detection** (adapted from enforcement-kit): matches `grep|rg|ag|ack` commands containing camelCase, PascalCase, or snake_case identifiers. Excludes `git grep`, TODO/FIXME, env vars, CSS classes.

**Read detection:** checks file extension against installed LSP plugins. YAML only nudges in Ansible paths; Markdown only nudges in vault paths with wikilinks.

## Configuration

Suppress the hook for a single command by prefixing with `NOLSP=1`:

```bash
NOLSP=1 grep handleSubmit src/
```

## Architecture

- [`adr/0001-nudge-not-block.md`](adr/0001-nudge-not-block.md) — Why nudge instead of block
- [`adr/0002-provider-detection-from-lsp-json.md`](adr/0002-provider-detection-from-lsp-json.md) — Extensible strategy list for detecting LSP providers
- [`docs/enforcement-kit-analysis.md`](docs/enforcement-kit-analysis.md) — Comparison with the enforcement-kit's blocking model
- [`openspec/`](openspec/) — Full spec-driven design archive

## Development

(This is a reminder for me/claude, because when I develop I have the plugin symlinked into myself. :D)

**Dev loop:**

1. Edit source files directly (symlinked cache means no reinstall needed locally)
2. Pick up changes: **Cmd-Shift-P → "Developer: Reload Window"** (VS Code)
3. Validate structure: `claude plugin validate ./path/to/prefer-lsp`

**Publishing changes:** Bump `version` in `.claude-plugin/plugin.json` before pushing.

## License

MIT
