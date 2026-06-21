## ADDED Requirements

### Requirement: Scan installed plugins for .lsp.json configs
The system SHALL scan plugin cache and marketplace directories for `.lsp.json` files to determine which file extensions have LSP support available.

#### Scenario: TypeScript LSP plugin installed
- **WHEN** `~/.claude/plugins/cache/claude-plugins-official/typescript-lsp/*/` contains a `.lsp.json` with `extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact", ... }`
- **THEN** extensions `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs` are marked as LSP-capable

#### Scenario: Custom marketplace plugin with .lsp.json
- **WHEN** `~/.claude/plugins/marketplaces/my-local-claudecode-marketplace/plugins/ansible-lsp/.lsp.json` declares `.yml` and `.yaml`
- **THEN** those extensions are marked as LSP-capable (subject to path-based heuristics for YAML)

#### Scenario: No .lsp.json found for a file type
- **WHEN** a file has extension `.rb` and no installed plugin declares Ruby LSP
- **THEN** that extension is NOT considered LSP-capable and hook does not fire

### Requirement: Cache provider scan results
The system SHALL cache the scanned extension-to-LSP mapping in the session state file. The cache SHALL be refreshed if older than 1 hour.

#### Scenario: First hook invocation scans and caches
- **WHEN** hook fires and no cached provider data exists (or cache is >1h old)
- **THEN** system scans `.lsp.json` files and stores results in state

#### Scenario: Subsequent invocations use cache
- **WHEN** hook fires and cached provider data exists and is <1h old
- **THEN** system uses cached data without re-scanning filesystem

### Requirement: Generate LSP operation suggestions per file type
The system SHALL include in the nudge message which LSP operations are available for the detected file type, based on the `.lsp.json` capabilities.

#### Scenario: TypeScript file nudge includes available operations
- **WHEN** nudge fires for a `.ts` file and typescript-lsp is installed
- **THEN** additionalContext mentions goToDefinition, findReferences, workspaceSymbol, hover, documentSymbol as available operations

#### Scenario: Markdown file nudge includes markdown-oxide operations
- **WHEN** nudge fires for an `.md` file in vault context
- **THEN** additionalContext mentions workspaceSymbol and findReferences as available for wikilink/heading resolution

### Requirement: Extension-to-language mapping drives detection
The system SHALL use the `extensionToLanguage` field from `.lsp.json` files as the authoritative source for which extensions are LSP-capable, rather than hardcoded lists.

#### Scenario: New LSP plugin added after plugin creation
- **WHEN** user installs a new LSP plugin (e.g., `rust-analyzer-lsp`) with a `.lsp.json` declaring `.rs`
- **THEN** the hook detects `.rs` files as LSP-capable on next session (after cache expires)
