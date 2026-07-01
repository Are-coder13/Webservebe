# Design skills for Webservebe mockups

These are the **UI/UX Pro Max** skills (from the open-source
[`ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
MIT-licensed), vendored into this repo so Claude Code can use them when building
and improving the business mockups in `mockups/`.

Claude Code auto-discovers any skill under `.claude/skills/`, so they're active
in every session in this repo — no install step needed.

## What's here

| Skill | Use it for |
|-------|-----------|
| **ui-ux-pro-max** | The core design-intelligence engine. Given a business + vibe, it recommends a complete design system: layout pattern, UI style, colour palette, font pairing, effects, and a pre-delivery checklist. Backed by a searchable database (styles, 161 palettes, font pairings, UX rules, charts) across many stacks. |
| **ui-styling** | Tailwind CSS + shadcn/ui component and theming guidance. |
| **design-system** | Design tokens (primitive → semantic → component), component specs, CSS variables. |
| **design** | Umbrella design skill: logos, corporate identity, banners, icons, slides. |
| **brand** | Brand voice, visual identity, messaging frameworks, consistency checks. |
| **banner-design** | Social / ad / web-hero / print banners. |
| **slides** | HTML presentations (Chart.js, design tokens). |

## How this helps the mockups

Our mockups are single-file HTML landing pages tailored to a specific local
business (see `mockups/` and the design agent in `worker/worker.js`). The core
value here is **grounding each mockup in a deliberate design system instead of
guessing**.

Typical flow when generating or refining a mockup:

```bash
# 1. Get a recommended design system for the business
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "local dentist practice antwerp trustworthy modern" \
  --design-system -p "N-VoDent"

# 2. Drill into a specific domain if you want alternatives
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "healthcare calm trust" --domain color
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "service business landing" --domain landing
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "minimalism dark mode" --domain style
```

Feed the recommended pattern / style / palette / typography into the mockup so
the result is coherent and on-brand, and run the pre-delivery checklist before
sending a preview to a prospect.

> **Note on the Cloudflare worker:** `worker/worker.js` runs on Cloudflare and
> can't execute Python, so it can't call `search.py` directly. To bring this
> intelligence into the automated pipeline, precompute a design system for a
> business and pass it into the worker's prompt as extra context (a good
> follow-up). For hand-built mockups, run the scripts above directly.

## Requirements

Python 3 (the search scripts use only the standard library).

## Provenance / license

Vendored from `ui-ux-pro-max-skill` (MIT). Upstream skill version 2.6.2. The
`ui-ux-pro-max/SKILL.md` here is the Claude Code build of that skill; the other
six are its bundled sub-skills. Keep this note if you update them.
