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
| `tutor` | AI tutor (probe → plan → teach) with a live Markdown session log | **live** |
| `problemset` | Fine-grained problem retrieval over the community library | **live** |
| `blog-writer` | Forest-ready blog authoring: one-concept sections, checkpoints, tutor hand-off | **live** |
| `submit` | Experience submission (consent-gated) + maintainer improvement flow | **live** |
| `forest` | Knowledge Forest: digest a book into a typed vault of theorems, proofs and expositions (slice 1 — the digester) | **live** |

Every entry is validated with `claude plugin validate` before it ships,
and sources are explicit https URLs — the `github` source type clones
over SSH and fails for anyone without SSH keys.

Skill folders follow the open Agent Skills standard (SKILL.md), so the
tools also work in other skill-aware harnesses; the marketplace is the
Claude Code convenience layer, not a lock-in.
