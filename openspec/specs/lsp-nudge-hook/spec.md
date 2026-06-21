## ADDED Requirements

### Requirement: Detect navigational grep in Bash commands
The hook SHALL detect Bash tool calls containing `grep`, `rg`, `ag`, or `ack` (but NOT `git grep`) that target code files with LSP-capable extensions and contain code symbol patterns (camelCase, PascalCase, or snake_case identifiers >= 4 characters).

#### Scenario: Grep for a camelCase symbol in TypeScript
- **WHEN** Bash tool is called with `grep -r "handleSubmit" src/`
- **THEN** hook detects `handleSubmit` as a code symbol targeting LSP-capable files and injects additionalContext

#### Scenario: Git grep is excluded
- **WHEN** Bash tool is called with `git grep "handleSubmit" src/`
- **THEN** hook exits 0 silently (no nudge)

#### Scenario: Grep for non-symbol string
- **WHEN** Bash tool is called with `grep -r "error occurred" src/`
- **THEN** hook exits 0 silently (phrase, not a symbol)

#### Scenario: Grep targeting non-code files
- **WHEN** Bash tool is called with `grep -r "Config" --include="*.json" .`
- **THEN** hook exits 0 silently (JSON is not LSP-capable)

### Requirement: Detect navigational Read of code files
The hook SHALL detect Read tool calls targeting files with LSP-capable extensions and inject a nudge if Claude has not yet used LSP this session.

#### Scenario: First Read of a TypeScript file without prior LSP usage
- **WHEN** Read tool is called with `file_path` ending in `.ts` and session state shows `lspUsed: false`
- **THEN** hook injects additionalContext suggesting LSP for symbol navigation

#### Scenario: Read of a TypeScript file after LSP was used
- **WHEN** Read tool is called with `file_path` ending in `.ts` and session state shows `lspUsed: true`
- **THEN** hook exits 0 silently (already using LSP)

#### Scenario: Read of a non-code file
- **WHEN** Read tool is called with `file_path` ending in `.json` or `.md` (without vault context)
- **THEN** hook exits 0 silently

### Requirement: Ansible YAML path-based detection
The hook SHALL only fire on `.yml`/`.yaml` files when the file path contains ansible-related directory names.

#### Scenario: YAML in ansible roles directory
- **WHEN** Bash tool greps for a symbol in a path containing `/roles/`
- **THEN** hook fires the nudge

#### Scenario: YAML in docker-compose
- **WHEN** Bash tool greps in `docker-compose.yml`
- **THEN** hook exits 0 silently (not ansible)

### Requirement: Markdown vault-context detection
The hook SHALL only fire on `.md` files when the path contains `tychay-ai-vault` AND the pattern is a wikilink (`[[`) or frontmatter field.

#### Scenario: Grep for wikilink in vault
- **WHEN** Bash tool is called with `grep -r "[[install-and-use-LSPs]]" tychay-ai-vault/`
- **THEN** hook fires the nudge (wikilink pattern in vault)

#### Scenario: Grep for plain text in vault
- **WHEN** Bash tool is called with `grep -r "meeting notes" tychay-ai-vault/`
- **THEN** hook exits 0 silently (not a structural pattern)

### Requirement: Non-blocking nudge output format
The hook SHALL output JSON with `hookSpecificOutput.additionalContext` naming the available LSP operations for the detected file type. The hook SHALL exit 0 (never exit 2).

#### Scenario: Nudge message content
- **WHEN** hook decides to nudge for a TypeScript file
- **THEN** output includes the available LSP operations (goToDefinition, findReferences, workspaceSymbol, hover) and instructs to use LSP tool first

### Requirement: NOLSP suppression prefix
The hook SHALL skip all detection if the Bash command contains `NOLSP=1`.

#### Scenario: Command with NOLSP prefix
- **WHEN** Bash tool is called with `NOLSP=1 grep -r "handleSubmit" src/`
- **THEN** hook exits 0 silently regardless of pattern match
