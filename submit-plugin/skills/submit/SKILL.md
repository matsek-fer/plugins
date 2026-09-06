---
name: submit
description: Share a tool experience report with the MatSek community library. Use when a member wants to submit, share or publish an experience/feedback report from a tutor (or other MatSek tool) session — "podijeli iskustvo", "pošalji izvještaj", "submit my experience" — or asks what they can learn from a finished session.
---

# Submit — experience reports, consent first

You take a member's `experience.md` from a finished tool session and turn
it into (a) a private, personal "use the tool better" report — always —
and (b) a public library submission — only with explicit, informed
consent on the exact final text. Talk to the member in Croatian; this
protocol and everything model-facing stays English.

Three rules outrank everything below:

1. **Never submit text the member has not seen.** The full final
   `experience.md` — frontmatter and body — is shown verbatim before the
   consent question, and again after any later edit.
2. **`consent_public: true` is written only after the member answers the
   consent question affirmatively.** It starts and stays `false`
   otherwise. No inference from "yes, submit it" said earlier in the
   conversation — ask the question, get the answer.
3. **Never modify the member's original file.** All scrubbing happens on
   a copy in a scratch directory; the file in their vault keeps their
   words and `consent_public: false`.

## 1 · Find

Look for experience reports:

- default: `sessions/*/experience.md` under the current directory (the
  tutor writes one per finished session);
- plus any path the member names.

Read each hit's frontmatter (`tool`, `tool_version`, `rating`,
`duration_minutes`, `session_ref`). If several exist, list them in
Croatian — one line each: session name, tool, date if derivable, rating —
and let the member pick. If none exist, say so and stop: this skill does
not write experience reports from scratch, the tool does that at session
end.

## 2 · Personal report — before any submission talk

This is the value the member gets whether or not they submit anything.
From the chosen `experience.md` (and, when `session_ref` resolves to a
local `sessions/<slug>/state.json`, from the session state too) write a
short report in Croatian — "kako izvući više iz alata" — covering:

- what visibly worked in this session (keep it factual, no cheerleading);
- 2–4 concrete things to try differently next time (e.g. a more specific
  `background` line, splitting a too-broad topic, using review-flagged
  nodes as the next session's starting point);
- if state.json is available: which concepts ended `needs_review` and a
  one-line suggestion for revisiting each.

Deliver it in the conversation. Only then ask whether they also want to
share the experience with the library. If they decline, you are done —
do not persuade.

## 3 · Scrub

Copy `experience.md` to the scratch directory and rewrite the copy:

- remove names of people (the member's own or anyone mentioned) and any
  handles, emails, course/group identifiers;
- rephrase personal struggles that are identifiable as told
  ("as the only first-year in the group I...") into neutral form ("a
  member with little prior exposure to X...") — keep the substance, drop
  the identity;
- remove anything the member marks private — ask once, in Croatian,
  whether any part should stay out;
- keep the friction and suggestions concrete: the report's value to the
  maintainer is specifics, so scrub identity, not detail;
- preserve all `x_` frontmatter keys byte-for-byte, and every other
  frontmatter field except `consent_public`, which you will set in the
  next step.

Then show the member the **exact final text** — the complete file,
frontmatter included — and ask, verbatim:

> Ovo će biti javno objavljeno pod CC BY 4.0 — potvrđuješ?

Only an explicit yes flips `consent_public: true` in the scratch copy.
Any request to change the text means: edit, show the full file again,
ask again. A no, or hesitation, means stop here — the personal report
from step 2 already happened, so nothing is lost.

## 4 · Package and validate

The experience bundle is the single file — per the spec
(`matsek-fer/spec` → `bundles.md`), `experience.md` has no
`manifest.json`; its frontmatter is the manifest. Lay it out as the
library expects (repo folders are plural):

```
experiences/<slug>/experience.md
```

Slug: kebab-case, descriptive of tool + session, e.g.
`tutor-calculus-probe-repeats`. Validate the folder before offering any
submission path:

```sh
node <spec-checkout>/validator/bin/matsek-validate.js experiences/<slug> \
  --concepts <library-checkout>/concepts/concepts.yaml
```

(Clone `matsek-fer/spec` into the scratch directory if no local checkout
exists; run `npm ci` in `spec/validator` first.) Errors mean fix and
re-validate — never hand the member a bundle that fails. And a hard rule:
ANY edit made after consent was given — including your own validator
fixes — voids that consent. Show the changed file again and re-ask the
exact consent question before proceeding; consent always refers to the
final bytes, never to an earlier version.

## 5 · Submit

Preferred: a PR to `matsek-fer/library` via `gh`.

- Member with push access: branch off `main`, add
  `experiences/<slug>/`, commit, `gh pr create`.
- Anyone else: fork flow — `gh repo fork matsek-fer/library --clone`
  into the scratch directory, add the folder, push, `gh pr create`.
- The PR template asks for a provenance statement; an experience report
  is the member's own account, so `original` — say so in the PR body.
- Commit and PR text in English (repo-facing), following the library's
  conventions.

No `gh` / no GitHub account: offer the email fallback — hand the member
the finished `experiences/<slug>/experience.md`, tell them to attach it
in an email to the section's maintainers through the section's usual
channel, and note in Croatian that a maintainer will open the PR for
them (authorship is then recorded in the PR the maintainer opens).

Close by telling the member, in Croatian, exactly what was submitted and
where to watch the PR.
