# 0001. Nudge (additionalContext) not block (exit 2)

- Status: accepted
- Date: 2026-06-21

## Context

Claude Code PreToolUse hooks can either block a tool call (exit 2) or allow it with injected context (exit 0 + additionalContext). The `claude-code-lsp-enforcement-kit` (nesaminua, 315 stars) validates the hook-based enforcement approach and uses TWO blocking strategies:

- **Grep: block always.** Every grep containing code symbols is permanently blocked. No session suppression. The block message provides a copy-pasteable MCP tool command (`mcp__cclsp__find_definition("symbol")`).
- **Read: block progressively.** Code file reads are gated until the model proves LSP awareness (warmup call → free reads → require nav calls → unlimited "surgical mode").

Their model works because:
1. MCP-based LSP (`cclsp`/`Serena`) guarantees availability — once the server is registered, the redirect command will always work.
2. Block messages are parametrized with the exact command to run — Claude doesn't need to figure out how to use LSP, it copies the suggestion.
3. They only target unambiguous code files (`.ts`, `.tsx`, `.js`, `.jsx`) — no blurry extension boundaries.

Our context differs in three critical ways:
1. **Plugin LSP is less guaranteed than MCP.** The language server might not have started, indexed, or support the specific file. A block creates a dead end.
2. **No parametrizable redirect.** The native LSP tool requires `filePath`, `line`, `character` — we cannot generate a precise LSP call from a hook that only sees the grep command. We can name operations but not parametrize them.
3. **Blurry extension boundaries.** Markdown (`.md`) is only LSP-relevant in vault contexts with wikilinks. YAML (`.yml`) is only relevant in Ansible paths. Blocking a grep on generic config YAML would be wrong.

Four enforcement strategies were considered:

| # | Strategy | Behavior | Risk |
|---|----------|----------|------|
| 1 | Nudge once, suppress | Inject additionalContext on first detection, suppress after | Model may ignore |
| 2 | Block once, suppress regardless | One hard stop, then trust | Dead end if LSP unavailable on first call |
| 3 | Block until compliance, then suppress | Their Read model — progressive gates | Without MCP guarantees, redirect may fail repeatedly |
| 4 | Block always | Their grep model — permanent enforcement | Without copy-pasteable commands and with blurry extensions, causes lockups |

See `docs/enforcement-kit-analysis.md` for the full reference implementation analysis.

## Decision

The prefer-lsp plugin SHALL use non-blocking nudges (exit 0 with `hookSpecificOutput.additionalContext`) exclusively. It SHALL NOT use exit 2 to block tool calls.

The nudge fires once per session, then suppresses. It re-fires after a compaction threshold (time + tool-call count) in case the earlier nudge was dropped from context. Once Claude uses the LSP tool successfully (tracked by PostToolUse hook), all nudging ceases for the session.

This is a positive choice ("one reminder is sufficient for the model to switch behavior") not merely a defensive one ("blocking is scary"). The model is capable enough that knowing LSP exists is sufficient — it doesn't need permanent physical constraints.

## Consequences

- Positive: No lockup risk, no retry loops, no false-positive disruption
- Positive: Compatible with legitimate grep usage (string search, test output, counting)
- Positive: Blurry extension boundaries (markdown, YAML) are safe — a false-positive nudge is cheap
- Positive: Lower hook overhead — most calls exit 0 immediately with no output
- Negative: Not 100% enforcement — Claude could theoretically ignore the nudge
- Negative: If nudge is compacted and thresholds haven't fired, Claude may revert to grep
- Escalation path: If nudging proves insufficient in practice, record a new ADR superseding this one to adopt strategy 2 or 3 with tighter guarantees
