# Enforcement Kit Analysis

Analysis of `nesaminua/claude-code-lsp-enforcement-kit` (315 stars) for understanding its blocking model and how it differs from our nudge approach.

## Their Blocking Model: Two Different Strategies

### Grep: Block Always (permanent enforcement)

`bash-grep-block.js` blocks **every** grep/rg/ag/ack call that contains code symbols. There is no session state check — if it detects a camelCase/PascalCase/snake_case identifier targeting code files, it blocks unconditionally. The block message provides the exact MCP tool command to copy-paste.

No session-level suppression ever. Grep for code symbols is never allowed.

### Read: Block Progressively (gated, then releases)

`lsp-first-read-guard.js` uses progressive gating with session memory:

| Gate | Condition | Behavior |
|------|-----------|----------|
| Gate 1 (warmup) | No LSP call made yet | Block all code file Reads |
| Free Reads | After warmup | 2 free Reads allowed |
| Gate 4 | Read #4+ | Block unless `nav_count >= 1` |
| Gate 5 | Read #6+ | Block unless `nav_count >= 2` |
| Surgical mode | `nav_count >= 2` | Unlimited Reads |

### The Unstated Principle

This two-tier model implements what appears to be an unstated ADR:

- **Grep for a code symbol is unambiguously navigational.** If you're grepping `handleSubmit`, you definitely want a definition/reference. LSP is always strictly better. There is no legitimate reason to grep for a camelCase symbol when LSP exists. Therefore: block permanently, redirect to LSP command.

- **Reading a code file is ambiguous.** You might be reading for context, for editing, for understanding file shape, for reviewing. Not all Reads are "navigation." Therefore: gate progressively to train the model, then release once it's demonstrated LSP awareness.

Their model is: "redirect unambiguous navigation; train the model on ambiguous operations."

## Why Their Model Works for Them

1. **MCP guarantees:** Their LSP is via MCP server (`cclsp`/`Serena`). Once registered, the MCP tool will always respond. The redirect command they suggest (`mcp__cclsp__find_definition("symbol")`) is guaranteed to work.

2. **Copy-pasteable commands:** The block message includes the exact command to run, parametrized by the detected symbol. Claude doesn't need to figure out how to use LSP — it just copies the suggestion.

3. **No extension ambiguity:** They only target code files (`.ts`, `.tsx`, `.js`, `.jsx`, etc.) — no markdown, no YAML, no blurry boundaries.

## Why Their Model Doesn't Work for Us

1. **Plugin LSP is less guaranteed than MCP.** The language server might not have started, might not be indexed, might not support the specific file. A block would create a dead end.

2. **No copy-pasteable redirect.** The native LSP tool requires `filePath`, `line`, `character` — we can't generate a precise LSP call from a hook that only sees the grep command. We can name the operations (goToDefinition, findReferences) but can't parametrize them.

3. **Blurry extension boundaries.** Markdown files (`.md`) are only LSP-relevant in vault contexts with wikilinks. YAML files (`.yml`) are only LSP-relevant in Ansible paths. Blocking a grep on a generic YAML config file would be wrong.

4. **Different philosophy.** "Nudge once, Claude figures it out" — once Claude knows LSP exists, it will use it. The model is smart enough that one reminder suffices. The enforcement-kit assumes the model needs permanent physical constraints; we assume it needs a one-time prompt.

## Implications for Our Design

We chose option 1 (nudge once, suppress) over:
- Option 2 (block once, suppress regardless) — risk of dead end if LSP unavailable on first call
- Option 3 (block until compliance, then suppress) — their Read model, but without MCP guarantees for redirect
- Option 4 (block always) — their grep model, but without copy-pasteable commands and with blurry extension boundaries

See ADR-0001 for the formal decision record.
