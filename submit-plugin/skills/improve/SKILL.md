---
name: improve
description: Maintainer flow — mine the library's accumulated experience reports into concrete SKILL.md improvements for the MatSek tools. Use when a maintainer wants to review member feedback, improve a tool from experiences, or check a planned change against past reports.
---

# Improve — experiences in, diffs out

Maintainer-facing; everything here is English. Input: a local checkout of
`matsek-fer/library`. Output: proposed diffs to the named tool's SKILL.md
and a dated notes file recording what was acted on.

## 1 · Collect

Read every `experiences/*/experience.md` in the library checkout (ask for
the path if not obvious). Everything merged there already passed the
consent gate — no re-checking needed. Parse frontmatter; skip nothing.

## 2 · Group

Group by `tool`, then by `tool_version` within it. Per tool report:

- rating distribution and count per version;
- each distinct friction point, quoted or tightly paraphrased, with the
  experience slug(s) that raised it — recurrence across reports or
  versions is the signal;
- suggestions members made verbatim, kept separate from your own reading.

A friction reported against an old `tool_version` may already be fixed —
check the tool's current behavior before proposing anything.

## 3 · Propose diffs

Map the tool to its skill file:

- `tutor` → `AI_instructor/.claude/skills/tutor/SKILL.md`
- `problemset` → `library/skills/problemset/SKILL.md`
- others → the repo the marketplace entry points at.

For each friction still present, propose a minimal concrete diff — the
actual changed lines, not advice — one diff per friction, each citing its
experience slug(s) as evidence. Present all diffs to the maintainer;
apply only the ones they accept. Do not commit or push unless asked.

## 4 · Record

Write (or append to) a dated notes file the maintainer keeps —
default `docs/improve-notes/YYYY-MM-DD.md` in the tool's repo, or
wherever they say. One line per friction:

```
- [acted-on|deferred|rejected] <friction summary> — <experience slugs> — <commit/PR or reason>
```

Before a new pass, read the existing notes: never re-propose what was
rejected without new evidence, and list deferred items first.

## 5 · Regress

Old experiences are regression checks. Before the maintainer ships any
change to a tool's SKILL.md — from this flow or not — re-read that tool's
experiences and confirm the change does not reintroduce behavior a report
complained about. Flag any it would, with the slug.
