# 0002. Provider detection from .lsp.json plugin configs

- Status: accepted
- Date: 2026-06-21

## Context

The plugin needs to know which file extensions have LSP support available. The enforcement-kit hardcodes provider names (`cclsp`, `Serena`) and checks MCP server configs. Claude Code's native LSP system uses `.lsp.json` files in plugins to declare `extensionToLanguage` mappings — these are the authoritative source of what file types have LSP available on a given machine.

## Decision

The prefer-lsp plugin SHALL discover LSP-capable file extensions by scanning installed plugin directories for `.lsp.json` files and reading their `extensionToLanguage` fields. It SHALL NOT hardcode file extension lists. Additional path-based heuristics (Ansible YAML, Obsidian markdown) are layered on top of the extension detection but do not replace it.

## Consequences

- Positive: Automatically picks up new LSP plugins without code changes to this plugin
- Positive: Single source of truth — same config that Claude Code uses to start language servers
- Positive: Works for official plugins, custom marketplace plugins, and future additions
- Negative: Requires filesystem scanning (~10ms) — mitigated by caching with 1h expiry
- Negative: If a plugin's `.lsp.json` is malformed, that language silently drops out of detection
- Neutral: Ansible/Markdown heuristics are hardcoded overlays specific to the user's workflow; these won't auto-extend to other users without customization
- Extensibility: The detection layer is structured as an ordered strategy list: (1) plugin `.lsp.json` scan → (2) future MCP server config scan → (3) no LSP found. Adding MCP-based fallback (for OpenCode compatibility or users with MCP language server gateways like cclsp/Serena/lsp-tools-mcp) means adding a strategy to this list, not rewriting the system. The nudge message format is provider-agnostic (names operations like "goToDefinition", not tool-call syntax like "mcp__cclsp__find_definition"), so it works regardless of which strategy resolved the LSP capability.
