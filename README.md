# MatSek plugins

The club's Claude Code plugin marketplace. Install any MatSek tool with two
commands inside Claude Code:

```
/plugin marketplace add matsek-fer/plugins
/plugin install tutor@matsek
```

Updates arrive automatically through the marketplace.

| Plugin | What it is | Status |
|---|---|---|
| `tutor` | AI tutor (probe → plan → teach) with a live Markdown session log | wiring up (Phase 2) |
| `problemset` | Fine-grained problem retrieval over the community library | planned (Phase 3) |
| `reader` | Paper reader: ingest a PDF, select, ask — fully local | planned (Phase 4) |
| `blog-writer` | Writes two-tier blogs (static web + interactive local) | planned (Phase 5) |

The marketplace entry format is validated against the current Claude Code
plugin schema in Phase 2, when `tutor` is wired and tested on a clean
machine — treat `marketplace.json` as a draft until then.

Skill folders follow the open Agent Skills standard (SKILL.md), so the
tools also work in other skill-aware harnesses; the marketplace is the
Claude Code convenience layer, not a lock-in.
