/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills, in the order a skill's copies are preferred. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/**
 * Every `<root>/<name>/SKILL.md`, named after its directory; anything else is not a skill.
 * The same `<name>` in several roots is one skill: the SKILL.md in the first root, the
 * others its copies.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const skills = new Map<string, SkillFile>();
  for (const root of SKILL_ROOTS) {
    for (const path of paths.filter((path) => isSkill(root, path)).sort()) {
      const name = path.split('/').at(-2)!;
      const skill = skills.get(name);
      if (skill) skill.copies.push(path);
      else skills.set(name, { path, name, copies: [] });
    }
  }
  return [...skills.values()];
}

/** `<root>/<name>/SKILL.md`: exactly one directory below the root, and the exact file name. */
function isSkill(root: string, path: string): boolean {
  if (!path.startsWith(`${root}/`)) return false;
  const [name, file, ...rest] = path.slice(root.length + 1).split('/');
  return Boolean(name) && file === 'SKILL.md' && rest.length === 0;
}
