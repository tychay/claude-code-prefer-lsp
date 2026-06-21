# Spec-Driven With ADR OpenSpec Schema

`spec-driven-with-adr` is for changes that need the standard proposal-to-tasks
OpenSpec flow plus durable Architecture Decision Records.

- Good fit: architectural changes, platform decisions, cross-module work, new
  service boundaries, technology choices, or changes where future contributors
  need a persistent decision trail.
- Not a good fit: small tactical fixes, content-only edits, simple UI changes,
  or work where `specs -> tasks` is enough.

## Stage Gates

Artifact order:
`proposal -> specs -> design -> adr -> tasks`

Gate expectations:
- `specs` must be based on the capabilities identified in `proposal.md`.
- `design` must account for the proposal, specs, and currently in-force ADRs.
- `adr` records durable decisions after design and before task planning.
- `tasks` are planned only after proposal, specs, design, and ADR artifacts are
  complete.

## ADR Persistence

ADR files are generated under the target repository's top-level `adr/` folder,
not only inside the OpenSpec change folder. Accepted ADRs are immutable. If a
future decision changes a prior ADR, create a new ADR that supersedes the old
one and leave the original file unchanged.

## Source

Fetched from [intent-driven-dev/openspec-schemas](https://github.com/intent-driven-dev/openspec-schemas)
(commit: main, 2026-06-15).
