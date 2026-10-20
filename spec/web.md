# Web view
`./skill-atlas serve [port]`, then open the URL it prints: `http://localhost:3000` by default.
- *This machine only*: listens on `127.0.0.1`; `HOST` overrides it
- A port in use → a clear message, exit code 1
- The same core as `scan`; *nothing is stored*
## The page
- A **field** for the repository: the same input as `scan`, a GitHub URL or a directory
- Its **skills**, as `scan` finds them: name and description, sorted by **name**
- One skill selected, the first at first: its **SKILL.md** *as written*, front matter included
  - its **link**, pinned to the scanned commit; `also in <paths>` for copies
- Warnings under the repository; an unreachable repository → its message, in the page
- `/?repo=<link>` scans at once: a scan can be *shared as a link*
## API
`GET /api/scan?repo=<GitHub URL | directory>` → JSON:
`repository`; `skills`, each with its `link` and `markdown`; `warnings`
- No `repo`, or a repository that cannot be scanned → `400`, `{ "error": <message> }`
