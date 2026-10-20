# Repository analysis
## Input
A **GitHub repository or account** URL, or a local directory
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI and [web view](web.md): *thin clients*.
Skill: id = `repo:path`, name, description, commit, its SKILL.md
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
## What is a project skill?
`<root>/<name>/SKILL.md`, `<root>` is one of:
`.agents/skills`, `.claude/skills`,
`.github/skills`, `agent/skills`
- The same `<name>` in two roots → one skill
  - from the first root in the list; the others are its *copies*
- Anything else → not a skill

## GitHub accounts
- A GitHub user or organization URL (`https://github.com/<owner>`, also without a scheme or with a trailing slash) scans all repositories returned by GitHub's account listing: public repositories for users, and repositories accessible to the caller for organizations.
- Determine the account type through the GitHub API, then list its repositories, following all pages (100 repositories per page). Sort by full repository name and scan each once.
- Reuse repository scanning and its skill deduplication; the same skill name in different repositories counts separately. Empty repositories have zero skills.
- Scan at most four repositories concurrently. `GITHUB_TOKEN`, when set, authenticates account lookup and repository listing as well as repository scans.
- A failed repository is marked as failed, with a warning including its name; continue scanning the other repositories. Never present a failed scan as zero skills. Skill warnings also include their repository name.
- An empty account produces an empty result. An unreachable or unknown account, or failed repository listing (including a later page), fails the whole request with a clear error.
