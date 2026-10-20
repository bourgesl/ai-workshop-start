# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

`./skill-atlas serve` opens the same scan in a web page, at http://localhost:3000: a field for the
repository, its skills and their SKILL.md.

Use an account URL, for example `./skill-atlas scan https://github.com/JetBrains`, to scan
all repositories listed by GitHub for a user or organization. In the web view, each repository
shows its skill count and links to its full scan. Failed repositories are marked explicitly;
the remaining repositories still appear. Large accounts can take longer and may need
`GITHUB_TOKEN` to avoid GitHub's rate limit.

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
