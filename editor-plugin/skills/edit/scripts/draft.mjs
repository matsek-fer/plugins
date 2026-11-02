#!/usr/bin/env node
// Read and write editor drafts from Claude's side, with exactly the block
// ids the page uses — so a comment's anchor (#b-<id>) finds its block, and
// a rewrite Claude makes shows up in the member's open editor live.
//
//   node draft.mjs blocks  <library.json> <path> [draft.json]
//       Print the file's blocks (draft if given, else the snapshot) as
//       JSON lines: {"i", "id", "line", "ai", "raw"}.
//   node draft.mjs find    <library.json> <block-id> [drafts-dir]
//       Which file a block id belongs to (drafts-dir: one draft JSON per
//       file, as fetched from the artifact db).
//   node draft.mjs replace <library.json> <path> <draft.json|-> <block-id> <new-text-file>
//       Print the updated draft document (ready for db_write at
//       drafts/<path with / replaced by ~>). The block is marked ai: true —
//       text a model drafted is ai-assisted under the provenance policy.
//   node draft.mjs fromtext <library.json> <path> <draft.json|-> <full-new-file>
//       Rewrite a whole file: blocks are re-split, ids kept where a block's
//       text is unchanged, changed and new blocks marked ai: true.
//
// The splitting below mirrors splitText()/origBlocks() in assets/editor.html
// and uses the same marked version; change them together.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const MARKED_VERSION = "14.1.0";
function loadMarked() {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const cache = path.join(os.tmpdir(), `matsek-editor-marked-${MARKED_VERSION}`);
  for (const dir of [path.join(here, "node_modules"), path.join(cache, "node_modules")]) {
    try { return createRequire(path.join(dir, "x.js"))("marked"); } catch { /* next */ }
  }
  fs.mkdirSync(cache, { recursive: true });
  execFileSync("npm", ["install", "--silent", "--no-save", "--prefix", cache, `marked@${MARKED_VERSION}`], { stdio: "ignore" });
  return createRequire(path.join(cache, "node_modules", "x.js"))("marked");
}
const { marked } = loadMarked();

export function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
export function splitText(p, text) {
  if (p.endsWith(".md")) {
    const fm = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
    const head = fm ? fm[0] : "";
    const parts = [];
    for (const t of marked.lexer(text.slice(head.length))) {
      if (t.type === "space" && parts.length) parts[parts.length - 1] += t.raw;
      else parts.push(t.raw);
    }
    if (parts.length > 1 && !parts[0].trim()) { const lead = parts.shift(); parts[0] = lead + parts[0]; }
    return { parts: head ? [head, ...parts] : parts, fm: !!head };
  }
  if (/\.ya?ml$/.test(p)) {
    const parts = []; let last = 0; const re = /\n[ \t]*\n/g; let m;
    while ((m = re.exec(text))) { parts.push(text.slice(last, m.index + m[0].length)); last = m.index + m[0].length; }
    if (last < text.length) parts.push(text.slice(last));
    return { parts: parts.length ? parts : [text], fm: false };
  }
  return { parts: [text], fm: false };
}
export function origBlocks(lib, p) {
  if (lib.files[p] == null) throw new Error(`${p} is not in the snapshot`);
  const fh = fnv(p);
  const { parts, fm } = splitText(p, lib.files[p]);
  return parts.map((raw, i) => Object.assign({ id: `${fh}-${i}`, raw }, fm && i === 0 ? { fm: true } : null));
}
const readJson = (f) => JSON.parse(f === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(f, "utf8"));
const draftDoc = (lib, p, blocks) => ({ path: p, base_commit: lib.commit, updated: new Date().toISOString(), blocks });

const [cmd, ...a] = process.argv.slice(2);
const lib = a[0] ? JSON.parse(fs.readFileSync(a[0], "utf8")) : null;
if (cmd === "blocks") {
  const blocks = a[2] ? readJson(a[2]).blocks : origBlocks(lib, a[1]);
  let line = 1;
    // line: the block's first non-blank line in the file (where a PR review comment goes)
  blocks.forEach((b, i) => { const lead = (b.raw.match(/^\s*\n/) || [""])[0].split("\n").length - 1; console.log(JSON.stringify({ i, id: b.id, line: line + lead, ai: !!b.ai, raw: b.raw })); line += (b.raw.match(/\n/g) || []).length; });
} else if (cmd === "find") {
  const id = a[1]; const dir = a[2];
  const hits = [];
  for (const p of Object.keys(lib.files)) if (id.startsWith(fnv(p) + "-")) hits.push(p);
  if (dir && fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.blocks?.some((b) => b.id === id) && !hits.includes(d.path)) hits.push(d.path);
  }
  console.log(JSON.stringify(hits));
} else if (cmd === "replace") {
  const [, p, draftArg, id, newFile] = a;
  const blocks = draftArg && draftArg !== "none" ? readJson(draftArg).blocks : origBlocks(lib, p);
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx < 0) { console.error(`block ${id} not in ${p}`); process.exit(3); }
  let v = fs.readFileSync(newFile, "utf8");
  const tail = (blocks[idx].raw.match(/\n+$/) || [""])[0];
  v = v.replace(/\n*$/, "") + (tail || "");
  blocks[idx] = Object.assign({}, blocks[idx], { raw: v, ai: true });
  console.log(JSON.stringify(draftDoc(lib, p, blocks)));
} else if (cmd === "fromtext") {
  const [, p, draftArg, newFile] = a;
  const prev = draftArg && draftArg !== "none" ? readJson(draftArg).blocks : origBlocks(lib, p);
  const { parts, fm } = splitText(p, fs.readFileSync(newFile, "utf8"));
  const pool = new Map(); prev.forEach((b) => { if (!pool.has(b.raw)) pool.set(b.raw, []); pool.get(b.raw).push(b); });
  const fh = fnv(p);
  const blocks = parts.map((raw, i) => {
    const same = pool.get(raw)?.shift();
    if (same) return same;
    return Object.assign({ id: `${fh}-n${Math.random().toString(36).slice(2, 7)}`, raw, ai: true }, fm && i === 0 ? { fm: true } : null);
  });
  console.log(JSON.stringify(draftDoc(lib, p, blocks)));
} else {
  console.error("usage: draft.mjs blocks|find|replace|fromtext …");
  process.exit(2);
}
