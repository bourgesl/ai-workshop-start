# Web view
`./skill-atlas serve [port]`, then open the URL it prints: `http://localhost:3000` by default.
- *This machine only*: listens on `127.0.0.1`; `HOST` overrides it
- A port in use → a clear message, exit code 1
- The same core as `scan`; *nothing is stored*
## The page
- A **field** for the repository: the same input as `scan`, a GitHub repository or account URL, or a directory
- Its **skills**, as `scan` finds them: name and description, sorted by **name**
- One skill selected, the first at first: its **SKILL.md** *as written*, front matter included
  - its **link**, pinned to the scanned commit; `also in <paths>` for copies
- Warnings under the repository; an unreachable repository → its message, in the page
- Status text wraps long unbroken repository identifiers instead of widening the page; the full identifier remains visible, including on mobile.
- `/?repo=<link>` scans at once: a scan can be *shared as a link*
## Filtering
- After a successful scan, a field labeled **Filter** filters skill names as you type, using case-insensitive substring matching (contains)
- An empty value shows every skill; descriptions are not searched
- Show matching and total counts, including when the repository has no skills
- A non-empty filter with no matches has a red border and `aria-invalid=true`; matching again or clearing it removes this state
- Keep the selected skill when it matches; otherwise select the first match, or clear the detail view if there are no matches
- Keep warnings visible while filtering, and apply the current filter to subsequent scans
## Skill list presentation
- Use compact rows separated by subtle dividers. Names wrap when needed; descriptions occupy one line with an ellipsis, retaining their full text in the accessible button name and a hover tooltip.
- Mark the selected row with a colored leading border and background. Keyboard focus has a distinct outline; Enter or Space selects the focused skill.
- At widths up to 640px, stack the list above the details, limit the list to 40% of the viewport height with scrolling, and keep the page free of horizontal overflow.
## API
`GET /api/scan?repo=<GitHub URL | directory>` → JSON:
`repository`; `skills`, each with its `link` and `markdown`; `warnings`
- No `repo`, or a repository that cannot be scanned → `400`, `{ "error": <message> }`

## GitHub accounts
- Scanning an account URL shows its name, repository count, total skills from successful scans, and a list sorted by full repository name. Each successful repository displays its name and skill count, including zero.
- Each repository name links to `/?repo=<repository URL>`, opening the existing repository scan with its skill filter, selected SKILL.md, pinned links, copies and warnings.
- Failed repositories show their error instead of a zero count; the summary says **incomplete scan** and warnings remain visible. Empty accounts show **No repositories found.**
- Account results hide the skill filter and detail view. Switching back to a repository restores them; a new scan clears the previous account list. Only the latest submitted scan may update the page.
- The API for an account URL returns `account` (`id`, `url`), `repositories` (each `id`, `url`, and either `result` with the existing repository scan JSON or `error`), and repository-prefixed `warnings`. An account lookup or listing failure returns `400` with `error`.
