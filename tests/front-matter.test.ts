import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseSkill } from '../src/core/parse.ts';
import { createWebServer, listen } from '../src/web.ts';
import { atlas, open } from './helpers.ts';

const rejected = [
  {
    reason: 'Excessive alias count indicates a resource exhaustion attack',
    // Issue #10's exact 139-byte reproduction; retain the default YAML alias limit.
    markdown: '---\nname: aliases\na: &a [x,x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]\n---\nSYNTHETIC MARKER',
  },
  {
    reason: 'Unresolved alias (the anchor must be set before the alias): missing',
    markdown: '---\nname: unresolved\ndescription: *missing\n---\nSYNTHETIC MARKER',
  },
];

for (const { reason, markdown } of rejected) {
  test(`YAML conversion rejection falls back: ${reason}`, () => {
    assert.deepEqual(parseSkill(markdown), {
      description: '',
      properties: {},
      body: 'SYNTHETIC MARKER',
      warning: `malformed front matter: ${reason}; using the directory name`,
    });
  });

  test(`CLI and HTTP scans continue after YAML conversion rejection: ${reason}`, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'skill-atlas-yaml-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = '.agents/skills/broken/SKILL.md';
    for (const [name, text] of [
      ['broken', markdown],
      ['control', '---\nname: control\ndescription: Synthetic control\n---\nCONTROL MARKER'],
    ]) {
      const dir = join(root, '.agents/skills', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), text);
    }
    const warning = `${path}: malformed front matter: ${reason}; using the directory name`;
    const cli = await atlas(['scan', root]);
    assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, / · 2 skills\nbroken\n/);
    assert.match(cli.stdout, /\ncontrol — Synthetic control\n/);
    assert.equal(cli.stderr, `warning: ${warning}`);

    const server = createWebServer(open);
    t.after(() => server.close());
    const base = await listen(server, 0, '127.0.0.1');
    const response = await fetch(`${base}/api/scan?repo=${encodeURIComponent(root)}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.skills.map((skill: { name: string; description: string }) => [skill.name, skill.description]), [
      ['broken', ''], ['control', 'Synthetic control'],
    ]);
    assert.equal(result.skills[0].path, path);
    assert.equal(result.skills[0].markdown, markdown);
    assert.deepEqual(result.warnings, [warning]);
  });
}

test('ordinary YAML aliases still produce skill metadata', () => {
  assert.deepEqual(parseSkill('---\nname: &name ordinary\ndescription: *name\ncustom: [*name]\n---\nBODY'), {
    name: 'ordinary', description: 'ordinary', properties: { custom: ['ordinary'] }, body: 'BODY',
  });
});
