---
name: edit
description: MatSek urednik — open any library file (blog, forest tree, problem, proof, the concept registry) in a published editor page where the member edits block by block and comments on blocks, then turn their submission into a pull request on matsek-fer/library with their own GitHub account. Use when a member wants to edit, fix or improve something in the library ("uredi", "ispravi ovaj blog", "otvori urednik", "želim popraviti stablo"), says "pošalji moju MatSek prijavu", or sends a comment from the editor page to Claude.
---

# MatSek urednik

The member edits library content in a page published as their own Claude
artifact; you do the parts a page cannot: building it from a fresh
library snapshot, larger rewrites asked for in comments, and the pull
request. The page has no network, so it carries the whole library
(`library.json`, ~0.6 MB) and hands submissions back through the
artifact's database.

Talk to the member in Croatian by default. This protocol, commit
messages and `annotation.md` are English; PR text follows the library's
Croatian template.

**Read before the first submission of a session:** `spec/policies/provenance.md`
and `spec/bundles.md` in a `matsek-fer/spec` checkout. They are the law;
this skill does not restate them.

## What lives where

| Thing | Where |
|---|---|
| Editor page | `assets/editor.html` → published as `index.html` with `library.json`, `vendor/` and `katex/` beside it |
| Snapshot builder | `scripts/build-library.mjs <library> <out>` |
| Drafts | artifact db `drafts/<path with / → ~>`: `{path, base_commit, updated, blocks:[{id, raw, fm?, ai?}]}` |
| Submissions | artifact db `submissions/<id>`: `{id, status, title, body, affirmations, files:[{path, content, draft_base_commit, item}], block_map, ai_blocks, used_quick_edits}` |
| Block ids | `<fnv(path)>-<index>` for snapshot blocks, `<fnv(path)>-n<random>` for new ones; DOM id `b-<id>` |
| Draft tool | `scripts/draft.mjs` (same splitting and ids as the page) |
| PR tool | `scripts/apply-submission.mjs apply|body` |
| Your side, in Claude Code | `ArtifactData` reads and writes the db; `ArtifactComments` reads, answers and resolves threads |

`status` moves `ready` (page) → `working` → `opened` (+ `pr_url`) or
`failed` (+ `error`), and the page shows each one live. Only you write
`working`, `opened` and `failed`. Write a status as an `update` of just
the fields that change, pinned with `if_version` to the version you read:
the store refuses an unpinned write to an existing document, and the pin
also stops you overwriting a submission the member changed meanwhile.

## A. Open or refresh the editor

1. **Library checkout.** Use the member's own clone of
   `matsek-fer/library` if one is around; otherwise clone
   `https://github.com/matsek-fer/library` into a scratch directory. Bring
   it to the latest `main` (`git fetch && git switch main && git pull --ff-only`).
   Never build from a dirty checkout: the snapshot's commit is what drafts
   are merged against.
2. **Build:**
   ```sh
   node scripts/build-library.mjs <library> <out>
   cp assets/editor.html <out>/index.html
   ```
   It prints a JSON summary (commit, item counts, size). Needs `npm` once to
   fetch KaTeX and marked if the checkout has no `node_modules`.
3. **Find the member's existing editor.** List their artifacts and look
   for the title **MatSek urednik**. Drafts, submissions and comment
   threads belong to that artifact, so a refresh **republishes the same
   artifact** and never creates a second one.
4. **Publish** with the tool that publishes from files on disk: `index.html`,
   `library.json`, `vendor/katex.min.js`, `vendor/marked.min.js`,
   `katex/katex.min.css`, and every `katex/fonts/*.woff2`, each served under
   its relative path. Title `MatSek urednik`, icon `edit`. Load the
   session's artifact guidance first if you have not (in Claude Code, the
   `artifact-capabilities` skill). In Claude Code this is the `Artifact`
   tool: `file_path` is `<out>/index.html`, the other files go in `files`
   keyed by their relative path, and a refresh passes the existing
   artifact's `url`.
5. **Declare capabilities** exactly as below. Claude Code's `Artifact`
   tool takes them as `capabilities` on the first publish; a refresh
   leaves the field out so the stored declaration carries over. Where
   declaring is a separate step, publish first, then declare, and on a
   refresh redeclare only if the stored declaration differs:
   ```json
   {
     "db": { "rules": [ { "path": "", "read": "admin", "write": "admin" } ] },
     "comments": { "composer_only": true },
     "sample": {}
   }
   ```
   - `db` holds the drafts and submissions. They are readable only by the
     owner and editors, so sharing the page read-only exposes nothing.
   - `comments` (composer only) gives each block a "Komentiraj" button and
     lets the page take a "Send to Claude" first.
   - `sample` powers the quick edits, which run on the member's own Claude
     usage after a one-time consent prompt.
6. Tell the member in two or three sentences what they can do:
   - Hover a paragraph and press **Uredi**, or double-click it.
   - Comment on a paragraph and press **Send to Claude**. Small edits land
     in seconds, applied by the page itself. Bigger ones come to you (flow C).
   - When they're done, press **Pošalji u knjižnicu**, then tell you
     "Pošalji moju MatSek prijavu".

   A comment sent to Claude reaches only a session that watches the
   editor: the one that published it, while it stays open. Tell the
   member to keep this session open while they work. In a later session,
   start watching the editor (in Claude Code, `ArtifactComments` with
   `action: "watch"` and its url) before they comment.

**No artifact tool in this session** (e.g. plain local Claude Code): build
anyway, then start `python3 -m http.server` in `<out>` and give the
member `http://localhost:8000/`. Opening it as a `file://` URL won't work
because the page fetches `library.json`. In this mode drafts stay in their
browser and the submission downloads as a JSON file, which you take in
flow B. Comments and quick edits need the artifact, so say so plainly.

Each member runs their **own copy**. Connectors, page-written comments and
db writes only work for the artifact's owner and editors, so never share
one editor page as the club's tool.

## B. "Pošalji moju MatSek prijavu": submission → pull request

1. **Fetch the submission.** In the editor artifact's db, list
   `submissions` and take the newest with `status: "ready"`. If several
   are ready, list them by title and ask which one. With a downloaded JSON
   file, use that instead. Save it to a scratch file. Set `status:
   "working"` right away (a pinned `update`, as above).
2. **GitHub identity.** `gh auth status`. If gh is not logged in, stop and
   ask the member to run `gh auth login` themselves: the PR must be opened
   by their account, never yours or a shared token. Note their login
   (`gh api user --jq .login`) and git identity (`git config user.name` /
   `user.email`). If git has no identity, ask the member for one.
3. **Provenance, before anything is written.** The affirmations in the
   submission are the member's own act from the page. Never tick or alter
   them. Then check what the edit means for each touched bundle:
   - If `used_quick_edits` is true, or `ai_blocks` names any block, a model
     drafted part of the text. Under the provenance policy, `ai-assisted`
     is then mandatory. For each touched bundle whose manifest says
     `original`, tell the member and propose changing the manifest's
     `provenance` to `ai-assisted` in the same PR. Make the change only
     with their yes. If the manifest says `adapted`, don't decide; put the
     question in the PR description for the maintainer. Trees carry no
     provenance field, so say it in the PR text instead.
   - Show the member the AI-drafted blocks (`ai_blocks` + `block_map`)
     and ask them to confirm they checked them. Check the mathematics
     yourself too.
4. **Apply:**
   ```sh
   node scripts/apply-submission.mjs apply <library> <submission.json>
   ```
   It creates `uredi/<id>` from `origin/main` and writes each file. A draft
   made on an older snapshot is three-way-merged. **Exit 3 means
   conflicts**: nothing was committed and the checkout is back where it
   was. Show the member the conflicting part (`merged_with_markers`) and
   resolve it with them. Either write the resolved text into their draft
   (flow C's `fromtext`, then they resubmit), or edit the submission file
   and apply again. If they stop here, write `status: "failed"`, `error`
   saying what conflicted.
5. **Validate** the way CI does. Clone `matsek-fer/spec` (`npm ci` in
   `validator/`) and `matsek-fer/reader` at the tag CI pins (read it from
   the library's `.github/workflows/validate.yml`) into scratch. Then:
   - `node <spec>/validator/bin/matsek-validate.js --registry-only concepts/concepts.yaml`
   - `matsek-validate <dir> --concepts concepts/concepts.yaml` for every
     bundle in the report's `bundles`. If `touches_concepts` is true, run
     it for **every** bundle.
   - `node <reader>/scripts/validate-forest.mjs forest --concepts concepts/concepts.yaml`
     if any tree, `forest/index.md` or the registry changed.
   - `node scripts/check-consent.mjs && node scripts/check-math.mjs`
   - `SKIP_EMBED=1 node scripts/build.mjs`

   Run these one at a time and read each result. On a failure, show the
   member the error and fix it with them. The usual fix is a draft edit
   via flow C, then a resubmit; a small mechanical fix can go straight
   into the branch with their OK. Never weaken a check to get through.
6. **Commit** as the member: `git add` the reported files (plus a manifest
   provenance change, if agreed) and commit with the submission title. In
   the body, add `MatSek urednik, prijava <id>`.
7. **Push and open the PR.** Check whether they can push:
   `gh api repos/matsek-fer/library --jq .permissions.push`.
   - **Push access:** `git push -u origin uredi/<id>`.
   - **No push access:** `gh repo fork matsek-fer/library --remote --remote-name fork`,
     then `git push -u fork uredi/<id>`.

   Then:
   ```sh
   node scripts/apply-submission.mjs body <submission.json> --validator pass|skip --math pass [--ai-provenance "<what was agreed>"] > pr-body.md
   gh pr create --repo matsek-fer/library --base main --head <owner>:uredi/<id> --title "<title>" --body-file pr-body.md
   ```
   Use `--validator skip` only when no bundle was touched (only trees or
   shared files changed).
8. **Open comment threads go to the PR, with consent.** Read the editor
   artifact's comment threads. Keep the unresolved ones whose anchor holds
   `#b-<id>` for a block in `block_map`. If an anchor has no `#b-` id,
   match the thread's quoted text to a block with `draft.mjs blocks`. Ask
   the member once: "Imaš N otvorenih komentara na ovim datotekama — da
   ih dodam u PR kao komentare na retke?" They are the member's words
   going public, so ask; don't assume. On yes, post each one with
   `gh api repos/matsek-fer/library/pulls/<n>/comments -f body=… -f path=… -F line=<block_map line> -f side=RIGHT -f commit_id=<head sha>`.
   Then offer to resolve those threads in the editor. Resolving keeps them;
   it only marks them done.
9. **Report back.** Write `status: "opened"`, `pr_url`, and a one-line
   `note` (e.g. "manifest provenance → ai-assisted"). The page then offers
   to clear the submitted drafts. Switch the checkout back to `main`.
   Give the member the PR link in one sentence.

On any stop after step 1, write `status: "failed"` with an `error` the
member can act on. Their drafts are never touched by a failure.

## C. A comment sent to Claude from the editor

The page tries small, single-block edits itself first. What reaches you is
a question, a discussion, or a change bigger than one block.

1. Read the thread. The anchor's `#b-<id>` names the block. Get the file
   from `draft.mjs find <library.json> <id>`, using the `library.json` you
   published (rebuild it from the snapshot's commit if it's gone), and
   read the current draft from db `drafts/<path ~>` if one exists.
2. **A question:** answer it in the thread, short and exact, in the
   member's language. If the answer reveals a gap in the text, offer to
   fix it, and make the fix only with their yes.
3. **A change:** write the new text, then produce the draft with
   `draft.mjs replace` (one block) or `draft.mjs fromtext` (several
   blocks or the whole file). Build it on the draft as it stands now,
   not on the snapshot: re-read `drafts/<path ~>` and the thread first,
   because the member keeps editing and an automatic reply may already
   have made the change. Write it to `drafts/<path ~>` pinned to the
   version you read. If the write is refused, someone changed the draft
   meanwhile: re-read it and merge, never overwrite. The open
   editor picks it up live. Blocks you wrote are marked `ai: true`, so
   the provenance step in flow B sees them. Keep the file's language,
   notation and wikilinks. All math must pass KaTeX. Never invent
   references.
4. Reply in the thread with what changed and where. The member reviews it
   in the editor, where "Izvorno" on a block reverts it.

## Rules that do not bend

- The PR is the member's, opened from their GitHub account. Never use
  another account or token, and never merge.
- Never tick an affirmation or change a submission's text without the
  member saying so.
- AI-drafted text is `ai-assisted`. That holds for the page's quick edits
  and for your own rewrites.
- D-007: trees are canonical, and legacy blogs are canonical until
  digested. When a member fixes a digested blog, point out the trees that
  carry the same text (the page lists them), and offer to apply the same
  correction there in the same PR.
- Original content only. If an edit looks like transcribed textbook or
  competition material, say so and stop. The firewall in
  `policies/provenance.md` applies to edits exactly as it does to new
  bundles.
