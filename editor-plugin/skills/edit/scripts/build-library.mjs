#!/usr/bin/env node
// Snapshot a matsek-fer/library checkout into the files the editor page
// ships with: library.json (every editable text file + an item index +
// the base commit) and KaTeX's stylesheet and fonts.
//
//   node build-library.mjs <library-checkout> <out-dir>
//
// The page cannot fetch anything at run time (artifact pages have no
// network), so the whole library travels with it. ~0.5 MB today.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KATEX_VERSION = "0.16.11"; // keep in step with library/scripts/build.mjs

const [libDir, outDir] = process.argv.slice(2);
if (!libDir || !outDir) {
  console.error("usage: build-library.mjs <library-checkout> <out-dir>");
  process.exit(2);
}
const root = path.resolve(libDir);
if (!fs.existsSync(path.join(root, "concepts", "concepts.yaml"))) {
  console.error(`${root} does not look like a matsek-fer/library checkout`);
  process.exit(2);
}

const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const commitDate = git("log", "-1", "--format=%cI");
const dirty = git("status", "--porcelain").length > 0;

const files = {};
const items = [];
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(p, "utf8");
const TEXT = /\.(md|json|ya?ml)$/;

// Frontmatter fields read with a line regex: trees use flat `key: value`
// lines, and the page re-reads the full YAML itself when it needs more.
function fmField(md, key) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!fm) return undefined;
  const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm[1]);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// --- bundles: problems/ proofs/ blogs/ ---------------------------------
const KIND_DIR = { problem: "problems", proof: "proofs", blog: "blogs" };
// Order files the way a reader meets them.
const FILE_ORDER = ["problem.md", "blog.md", "statement.md", "proof.md", "solution.md", "annotation.md", "manifest.json"];
const byOrder = (a, b) => {
  const ia = FILE_ORDER.indexOf(path.basename(a)), ib = FILE_ORDER.indexOf(path.basename(b));
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

for (const [kind, dir] of Object.entries(KIND_DIR)) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  for (const slug of fs.readdirSync(base).sort()) {
    const folder = path.join(base, slug);
    if (!fs.statSync(folder).isDirectory()) continue;
    const manifestPath = path.join(folder, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest = {};
    try { manifest = JSON.parse(read(manifestPath)); } catch { /* keep going: the editor can fix it */ }
    const own = [];
    for (const f of fs.readdirSync(folder)) {
      const p = path.join(folder, f);
      if (fs.statSync(p).isFile() && TEXT.test(f)) {
        files[rel(p)] = read(p);
        own.push(rel(p));
      }
    }
    own.sort(byOrder);
    const assets = fs.existsSync(path.join(folder, "assets")) ? fs.readdirSync(path.join(folder, "assets")) : [];
    items.push({
      key: `${kind}/${slug}`,
      kind,
      title: manifest.title || slug,
      lang: manifest.language || "",
      folder: rel(folder),
      files: own,
      assets: assets.length ? assets : undefined,
      teaches: manifest.teaches || [],
      provenance: manifest.provenance || "",
    });
  }
}

// --- forest trees -------------------------------------------------------
const treeDir = path.join(root, "forest", "trees");
if (fs.existsSync(treeDir)) {
  for (const f of fs.readdirSync(treeDir).sort()) {
    if (!f.endsWith(".md")) continue;
    const p = path.join(treeDir, f);
    const md = read(p);
    files[rel(p)] = md;
    const id = fmField(md, "id") || f.replace(/\.md$/, "");
    items.push({
      key: `tree/${id}`,
      kind: "tree",
      title: fmField(md, "title") || id,
      lang: fmField(md, "language") || "",
      taxon: fmField(md, "taxon") || "",
      digested_from: fmField(md, "digested_from"),
      folder: rel(treeDir),
      files: [rel(p)],
    });
  }
}

// --- shared files that are edited like content --------------------------
for (const [key, title, p] of [
  ["meta/concepts", "Registar pojmova (concepts.yaml)", path.join(root, "concepts", "concepts.yaml")],
  ["meta/forest-index", "Karta šume (forest/index.md)", path.join(root, "forest", "index.md")],
]) {
  if (!fs.existsSync(p)) continue;
  files[rel(p)] = read(p);
  items.push({ key, kind: "meta", title, lang: "", folder: rel(path.dirname(p)), files: [rel(p)] });
}

const snapshot = {
  schema: 1,
  repo: "matsek-fer/library",
  commit,
  commit_date: commitDate,
  built_at: new Date().toISOString(),
  dirty_checkout: dirty || undefined,
  items,
  files,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "library.json"), JSON.stringify(snapshot));

// --- Vendored libraries: KaTeX (script, stylesheet, woff2 fonts) and
// marked, shipped as the artifact's own files. The page then loads
// nothing from outside, works the same opened locally, and renders
// exactly what the library site renders.
const MARKED_VERSION = "14.1.0"; // the library's own marked major
function npmPackage(name, version) {
  const local = path.join(root, "node_modules", name);
  if (fs.existsSync(path.join(local, "package.json"))) {
    const v = JSON.parse(read(path.join(local, "package.json"))).version;
    if (v === version) return local;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execFileSync("npm", ["pack", `${name}@${version}`, "--silent"], { cwd: tmp, stdio: ["ignore", "pipe", "inherit"] });
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith(".tgz"));
  execFileSync("tar", ["-xzf", tgz], { cwd: tmp });
  return path.join(tmp, "package");
}
const dist = path.join(npmPackage("katex", KATEX_VERSION), "dist");
const markedPkg = npmPackage("marked", MARKED_VERSION);
const vOut = path.join(outDir, "vendor");
fs.mkdirSync(vOut, { recursive: true });
fs.copyFileSync(path.join(dist, "katex.min.js"), path.join(vOut, "katex.min.js"));
fs.copyFileSync(path.join(markedPkg, "marked.min.js"), path.join(vOut, "marked.min.js"));
const kOut = path.join(outDir, "katex");
fs.mkdirSync(path.join(kOut, "fonts"), { recursive: true });
// Drop the woff/ttf fallbacks from @font-face so only shipped files are named.
const css = read(path.join(dist, "katex.min.css"))
  .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, "")
  .replace(/,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, "");
fs.writeFileSync(path.join(kOut, "katex.min.css"), css);
let fontCount = 0;
for (const f of fs.readdirSync(path.join(dist, "fonts"))) {
  if (f.endsWith(".woff2")) {
    fs.copyFileSync(path.join(dist, "fonts", f), path.join(kOut, "fonts", f));
    fontCount++;
  }
}

const bytes = fs.statSync(path.join(outDir, "library.json")).size;
const counts = items.reduce((m, it) => ((m[it.kind] = (m[it.kind] || 0) + 1), m), {});
console.log(JSON.stringify({ commit, items: counts, files: Object.keys(files).length, library_json_bytes: bytes, katex_fonts: fontCount, dirty_checkout: dirty }));
