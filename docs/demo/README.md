# Filter and organization scan demo

[Watch the demo](filter-and-organization-scan.mp4) — a 36-second, silent 1280 × 720 recording with on-screen captions.

The demo shows:

- A repository scan with skill details and warnings.
- Case-insensitive name filtering, matching counts, no-match feedback, and clearing the filter.
- An organization scan with sorted repositories, skill totals, a zero-skill repository, and an explicit scan failure.
- Opening a repository from the organization summary and filtering its skills.

The browser runs the actual web page, HTTP server, GitHub adapter, and scanner. GitHub responses are supplied by an offline fixture for the fictional `SkillAtlasDemo` organization; this is not a live GitHub scan. Its `agent-skills` repository uses the checked-in `fixture/` skills, `empty` has no skills, and `unavailable` returns a simulated 404. The malformed-front-matter warning and duplicate skill come from the existing fixture. The lower caption bar and cursor highlight are recording overlays.
