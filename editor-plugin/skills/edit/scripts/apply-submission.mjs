#!/usr/bin/env node
// The mechanical half of turning an editor submission into a pull request.
//
//   node apply-submission.mjs apply <library-checkout> <submission.json> [--base origin/main]
//       Creates branch uredi/<submission id> from the base, writes every
//       submitted file, three-way-merging drafts made on an older snapshot.
//       Prints a JSON report; exit 3 on merge conflicts (nothing committed,
//       the checkout is put back on the branch it started from).
//
//   node apply-submission.mjs body <submission.json> --validator pass|fail|skip --math pass|fail|skip [--ai-provenance <text>]
//       Prints the PR body: the library's PR template, filled in.
//
// Judgment calls (provenance of AI-drafted text, what to do about a
// conflict, validator failures) stay with Claude and the member: see SKILL.md.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) flags[rest[i].slice(2)] = rest[++i];
  else args.push(rest[i]);
}
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const readSub = (p) => {
  const s = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!s || !s.id || !Array.isArray(s.files) || !s.files.length) die("not an editor submission (needs id and files[])");
  if (!/^[A-Za-z0-9-]+$/.test(s.id)) die("submission id has unexpected characters");
  for (const f of s.files) {
    if (typeof f.path !== "string" || typeof f.content !== "string") die("every file needs path and content");
    const norm = path.posix.normalize(f.path);
    if (norm !== f.path || norm.startsWith("..") || path.posix.isAbsolute(norm)) die(`refusing path ${f.path}`);
    if (!/^(problems|proofs|blogs)\/[a-z0-9-]+\/[^/]+\.(md|json)$|^forest\/trees\/[^/]+\.md$|^forest\/index\.md$|^concepts\/concepts\.yaml$/.test(norm)) {
      die(`refusing path outside the editable library files: ${f.path}`);
    }
  }
  return s;
};

if (cmd === "apply") {
  const [libDir, subPath] = args;
  if (!libDir || !subPath) die("usage: apply <library-checkout> <submission.json> [--base origin/main]");
  const root = path.resolve(libDir);
  const sub = readSub(subPath);
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
  // File contents must not be trimmed: a missing final newline is a diff.
  const show = (spec) => { try { return execFileSync("git", ["-C", root, "show", spec], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

  if (git("status", "--porcelain")) die("the library checkout has uncommitted changes; commit or stash them first");
  const startRef = tryGit("symbolic-ref", "--short", "HEAD") || git("rev-parse", "HEAD");
  const base = flags.base || "origin/main";
  tryGit("fetch", "--quiet", "origin", "main");
  const baseSha = git("rev-parse", base);
  const branch = `uredi/${sub.id}`;
  if (tryGit("rev-parse", "--verify", "--quiet", branch)) die(`branch ${branch} already exists — this submission was applied before`);
  git("switch", "--quiet", "-c", branch, baseSha);

  const report = { branch, base: baseSha, files: [], conflicts: [], bundles: [], trees: [], touches_concepts: false };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "matsek-merge-"));
  for (const f of sub.files) {
    const abs = path.join(root, f.path);
    const draftBase = f.draft_base_commit || sub.base_commit;
    const atBase = show(`${draftBase}:${f.path}`);
    const atHead = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
    if (atHead === null) { report.conflicts.push({ path: f.path, reason: "file no longer exists on main" }); continue; }
    let status;
    if (atBase === null || atBase === atHead) {
      fs.writeFileSync(abs, f.content);
      status = atHead === f.content ? "unchanged" : "applied";
    } else if (atHead === f.content) {
      status = "already-on-main";
    } else {
      // main moved since the draft was made: three-way merge
      const [o, b, t] = ["ours", "base", "theirs"].map((n) => path.join(tmp, `${n}-${report.files.length}`));
      fs.writeFileSync(o, f.content); fs.writeFileSync(b, atBase); fs.writeFileSync(t, atHead);
      let clean = true;
      try { execFileSync("git", ["merge-file", "-L", "tvoj nacrt", "-L", "snimka", "-L", "main", o, b, t], { stdio: "ignore" }); }
      catch { clean = false; }
      if (!clean) { report.conflicts.push({ path: f.path, reason: "main changed the same lines since the draft's snapshot", merged_with_markers: fs.readFileSync(o, "utf8") }); continue; }
      fs.writeFileSync(abs, fs.readFileSync(o, "utf8"));
      status = "merged";
    }
    report.files.push({ path: f.path, status });
    const m = /^(problems|proofs|blogs)\/([a-z0-9-]+)\//.exec(f.path);
    if (m && !report.bundles.includes(`${m[1]}/${m[2]}`)) report.bundles.push(`${m[1]}/${m[2]}`);
    if (f.path.startsWith("forest/trees/")) report.trees.push(f.path);
    if (f.path === "concepts/concepts.yaml") report.touches_concepts = true;
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  if (report.conflicts.length) {
    git("checkout", "--quiet", "--", ".");
    git("switch", "--quiet", startRef);
    git("branch", "-D", branch);
    report.branch = null;
    console.log(JSON.stringify(report, null, 2));
    process.exit(3);
  }
  // A bundle whose files changed must still validate as a whole; when only
  // the registry changed, every bundle depends on it.
  console.log(JSON.stringify(report, null, 2));
} else if (cmd === "body") {
  const [subPath] = args;
  if (!subPath) die("usage: body <submission.json> --validator pass|fail|skip --math pass|fail|skip");
  const sub = readSub(subPath);
  const box = (v) => (v === "pass" ? "x" : " ");
  const a = sub.affirmations || {};
  const files = sub.files.map((f) => `- \`${f.path}\``).join("\n");
  const aiNote = sub.used_quick_edits
    ? `\n\n**AI-assisted:** dio teksta predložio je model (brze izmjene iz komentara u MatSek uredniku${flags["ai-provenance"] ? `; ${flags["ai-provenance"]}` : ""}). Član ga je pregledao prije slanja.`
    : "";
  const out = `## Što donosi ovaj PR

${sub.body ? sub.body + "\n\n" : ""}Izmjene napravljene u MatSek uredniku (prijava \`${sub.id}\`, snimka \`${String(sub.base_commit).slice(0, 7)}\`):

${files}${aiNote}

## Provjera prije predaje

- [${box(flags.validator)}] Bundle prolazi validator lokalno (\`matsek-validate <mapa> --concepts concepts/concepts.yaml\`, nula grešaka).${flags.validator === "skip" ? " _(nije primjenjivo: mijenjaju se samo stabla/zajedničke datoteke)_" : ""}
- [${box(flags.math)}] Sva matematika se renderira (\`npm run check-math\`).
- [${sub.files.some((f) => f.path.endsWith("annotation.md")) ? "x" : " "}] \`annotation.md\` je napisan na engleskom i opisuje tehnike i princip, ne prepričava zadatak.${sub.files.some((f) => f.path.endsWith("annotation.md")) ? "" : " _(nije mijenjan)_"}

## Izjava o podrijetlu (obavezno — ovo je ugovor o doprinosu)

Predajom ovog PR-a potvrđujem, u skladu s
[pravilima o podrijetlu](https://github.com/matsek-fer/spec/blob/main/policies/provenance.md):

- [${a.authored_or_adapted ? "x" : " "}] Sadržaj sam **napisao/la sam(a)** (\`provenance: original\`), **ili** je uredno
      atribuirana prilagodba licencno kompatibilnog izvora
      (\`provenance: adapted\` + \`adapted_from\` u manifestu).
- [${a.ai_marked_and_checked ? "x" : " "}] Sve što je nastalo uz pomoć AI modela označeno je \`provenance: ai-assisted\`
      i osobno sam provjerio/la da je točno i da **nije** prepisani zadatak iz
      udžbenika, zbirke ili natjecanja.
- [${a.cc_by_4_0 ? "x" : " "}] Svoj doprinos **neopozivo licenciram pod
      [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.hr)** —
      isti uvjeti pod kojima ga svi dobivaju.

<sub>Izjavu je član potvrdio u MatSek uredniku pri slanju.</sub>
`;
  process.stdout.write(out);
} else {
  die("usage: apply-submission.mjs apply|body …");
}
