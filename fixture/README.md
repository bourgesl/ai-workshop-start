# fixture

A small repository for the tests.

| Path | Case |
| --- | --- |
| `.claude/skills/commits` | a skill |
| `.github/skills/code-style` | a skill in another agent's folder |
| `.agents/skills/release-checklist` | malformed front matter |
| `agent/skills/commits` | the same name in another root: a copy of `.claude/skills/commits` |
| `SKILL.md` | not a skill: at the repository root |
| `.claude/skills/SKILL.md` | not a skill: directly in a skill root |
| `.claude/skills/commits/examples/SKILL.md` | not a skill: too deep |
| `.claude/skills/lowercase/skill.md` | not a skill: not exactly `SKILL.md` |
| `docs/skills/notes` | not a skill: not a skill root |
| `packages/app/.claude/skills/nested` | not a skill: a skill root below the repository root |
