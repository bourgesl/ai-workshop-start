# Command line
`./skill-atlas scan <GitHub URL | directory>`
`./skill-atlas serve [port]`: the [web view](web.md)
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- `also in <paths>` for copies; warnings go to *stderr*

## GitHub accounts
`./skill-atlas scan https://github.com/<owner>` scans a user or organization.
Print `<owner> · N repositories`, then the existing repository output for each repository, sorted by full name. Failed repositories print `<owner>/<repo> · scan failed`; warnings go to stderr. An empty account prints `0 repositories`. Account lookup or listing failures return exit code 1; a completed account scan with repository failures returns 0 with warnings.
