# Beat Pals

A rhythm game in the style of Guitar Hero for one child of 4 to 5 years. It is a PWA for an iPhone or iPad, for one family.

- Research and decisions so far: `docs/research/README.md`.
- Current build: the spec `.scratch/beat-pals-mvp/spec.md` and its tickets in `.scratch/beat-pals-mvp/issues/`.
- Sister project with the same stack and iOS lessons: `/Users/mantoci/Personal/pile-pals` (read its `docs/agents/ios-device.md`).

## Public repository, private songs

The repository is public, and each push is permanent. Song ids, titles, and artists live only in the git-ignored folders `.scratch/` and `songs/`. In tracked files, comments, test fixtures, and commit messages, use invented song names. The leak scan in the commit hooks and before each push enforces this (spec, section "Leak scan").

## Ignored folders in a checkout

An ovnfs checkout or a worktree can lack the git-ignored folders. Read `.scratch/` (spec, tickets, prototypes, song list) and `songs/` (the `.sng` files) from `/Users/mantoci/Personal/beat-pals`.

## Agent skills

### Issue tracker

Issues and specs are local Markdown files under `.scratch/` (not in git). See `docs/agents/issue-tracker.md`.

### Triage labels

The default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
