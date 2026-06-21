## ADDED Requirements

### Requirement: Session state persistence
The system SHALL maintain session state in `~/.claude/state/prefer-lsp-<hash>.json` where hash is `md5(cwd).slice(0, 12)`.

#### Scenario: State file location
- **WHEN** a session is active in `/Users/tychay/Developer/my-project`
- **THEN** state is stored at `~/.claude/state/prefer-lsp-<md5-of-cwd-first-12>.json`

### Requirement: Nudge-once-then-suppress behavior
The system SHALL inject the nudge at most once and then suppress further nudges until the re-nudge threshold is reached.

#### Scenario: First navigational grep in a fresh session
- **WHEN** first grep targeting code symbols is detected and state shows `nudged: false`
- **THEN** hook injects additionalContext and sets `nudged: true` with current timestamp

#### Scenario: Second navigational grep after nudge
- **WHEN** a grep targeting code symbols is detected and state shows `nudged: true` and thresholds not exceeded
- **THEN** hook exits 0 silently

### Requirement: Re-nudge after compaction threshold
The system SHALL re-nudge when BOTH conditions are met: more than 15 minutes have elapsed since last nudge AND more than 20 non-LSP tool calls have occurred since last nudge.

#### Scenario: Time elapsed but insufficient tool calls
- **WHEN** 20 minutes have elapsed since nudge but only 10 tool calls occurred
- **THEN** hook exits 0 silently (both conditions required)

#### Scenario: Both thresholds exceeded
- **WHEN** 16 minutes elapsed AND 21 tool calls since last nudge AND `lspUsed` is still false
- **THEN** hook re-fires the nudge and resets counters

#### Scenario: LSP was used — no re-nudge
- **WHEN** thresholds exceeded but `lspUsed: true`
- **THEN** hook exits 0 silently (Claude already learned)

### Requirement: Tool call counter increments on hook fire
The system SHALL increment `toolCallsSinceNudge` on every PreToolUse invocation where the hook does NOT nudge (i.e., when suppressed).

#### Scenario: Counter increments on suppressed calls
- **WHEN** hook fires but suppresses (already nudged, thresholds not met)
- **THEN** `toolCallsSinceNudge` increments by 1

### Requirement: PostToolUse LSP usage tracker
The system SHALL track successful LSP tool calls via a PostToolUse hook. When the LSP tool is used successfully, the session state SHALL be updated with `lspUsed: true`.

#### Scenario: LSP tool used successfully
- **WHEN** PostToolUse fires for the `LSP` tool with a non-error response
- **THEN** state is updated to `{ lspUsed: true }` and all future nudges are suppressed

#### Scenario: LSP tool returns error
- **WHEN** PostToolUse fires for the `LSP` tool with an error response
- **THEN** `lspUsed` remains false (don't suppress — LSP may be misconfigured)

### Requirement: SessionStart state reset
The system SHALL delete the state file for the current cwd at session start.

#### Scenario: New session clears previous state
- **WHEN** a new Claude Code session starts
- **THEN** the state file for the cwd is deleted, forcing fresh enforcement
