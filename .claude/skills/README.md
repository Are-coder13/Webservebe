# Design skills for Webservebe mockups

The **ui-ux-pro-max** skill (from the MIT-licensed
[`ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)),
vendored so Claude Code can use it when building and refining the business
mockups in `mockups/`.

Claude Code auto-discovers skills under `.claude/skills/`, so it's active in
every session in this repo — no install step.

> We kept **only** `ui-ux-pro-max`. The other bundled sub-skills (banner-design,
> brand, design, design-system, slides, ui-styling) were removed: they lean on
> AI image generation and Tailwind/shadcn, neither of which fits our pipeline
> (single-file HTML, CSS/SVG only, no external photos).

## What's valuable here

`ui-ux-pro-max` is a searchable database of design decisions:

- **161 colour palettes** with semantic roles (primary / accent / bg / border …)
- **57 font pairings** with moods and Google Fonts URLs
- **landing-page layout patterns** (section orders, CTA placement)
- **UI styles** with effects and best-for guidance
- **99 UX guidelines** (accessibility, touch, animation, forms) — a QA checklist

The "design-system engine" auto-picker is only so-so (e.g. it once suggested an
orange palette for a dentist). Treat the data as a **menu to choose from**, not
an oracle.

## Two ways it's used

### 1. Hand-building / refining mockups (run the scripts)

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "healthcare calm trust" --domain color
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "service business landing" --domain landing
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "minimalism dark mode" --domain style
```

### 2. The automated worker (extracted data — no Python at runtime)

`worker/worker.js` runs on Cloudflare and can't execute Python, so the
**local-business-relevant slice** of this data is extracted into
`worker/design-knowledge.js`. For each prospect the worker:

- classifies the business into a domain (health / auto / beauty / home / food /
  general) from its name + category,
- injects a **shortlist of matched palettes, font pairings, layout patterns and
  styles** into the design prompt (Claude picks what fits),
- injects the **UX checklist** into the art-director review prompt as a QA gate.

To regenerate `worker/design-knowledge.js` after updating the skill data:

```bash
python3 scripts/build-design-knowledge.py
```

## Requirements

Python 3 (standard library only) for the skill scripts and the build script.

## Provenance / license

Vendored from `ui-ux-pro-max-skill` (MIT), upstream skill version 2.6.2.
`ui-ux-pro-max/SKILL.md` is the Claude Code build of that skill.
