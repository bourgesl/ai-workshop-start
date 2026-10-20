// The decisions in spec/web.md, checked on the real server: the CLI's `serve`, and the page's
// scans of ./fixture and of the small GitHub repository answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import type { Repository, Skill } from '../src/core/model.ts';
import { createWebServer, listen } from '../src/web.ts';
import { CLI, EXAMPLE_COMMIT, FIXTURE, open } from './helpers.ts';

const server = createWebServer(open);
const base = await listen(server, 0, '127.0.0.1');
test.after(() => server.close());

/** What `GET /api/scan` answers: the scan, or an error. */
type Scanned = {
  repository: Repository;
  skills: (Skill & { link: string })[];
  warnings: string[];
  error?: string;
};

/** What the page asks the server for a repository. */
async function scanned(repo: string) {
  const response = await fetch(`${base}/api/scan?repo=${encodeURIComponent(repo)}`);
  return { status: response.status, body: (await response.json()) as Scanned };
}

/** `skill-atlas serve <port>` in a fresh directory, until it prints its URL. */
async function serve(port: string, cwd: string) {
  const child = spawn(process.execPath, [CLI, 'serve', port], { cwd, env: { ...process.env, HOST: '127.0.0.1' } });
  let stdout = '';
  child.stdout.setEncoding('utf8').on('data', (text) => (stdout += text));
  while (!stdout.includes('\n')) {
    const [exit] = await Promise.race([once(child.stdout, 'data'), once(child, 'exit')]);
    if (typeof exit === 'number') assert.fail(`serve exited with ${exit}`);
  }
  return { child, line: stdout.trim() };
}

test('serve prints its URL; the page has a field for the repository', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const { child, line } = await serve('0', cwd);
  t.after(() => child.kill());
  const url = /^Skill Atlas at (http:\/\/localhost:\d+)$/.exec(line)?.[1];
  assert.ok(url, line);

  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /^text\/html/);
  const html = await page.text();
  assert.match(html, /<input id="repo" name="repo"/);
  assert.match(html, /\/api\/scan\?repo=/);

  // The same core as scan, and nothing stored.
  const response = await fetch(`${url}/api/scan?repo=${encodeURIComponent(FIXTURE)}`);
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as Scanned).skills.length, 3);
  assert.deepEqual(readdirSync(cwd), []);
});

test('./fixture: the skills sorted by name, each with its link and its SKILL.md as written', async () => {
  const root = pathToFileURL(FIXTURE).href;
  const { status, body } = await scanned(FIXTURE);
  assert.equal(status, 200);
  assert.equal(body.repository.id, 'fixture');
  assert.deepEqual(
    body.skills.map((skill) => [skill.name, skill.link, skill.copies]),
    [
      ['code-style', `${root}/.github/skills/code-style/SKILL.md`, []],
      ['commits', `${root}/.claude/skills/commits/SKILL.md`, ['agent/skills/commits/SKILL.md']],
      ['release-checklist', `${root}/.agents/skills/release-checklist/SKILL.md`, []],
    ],
  );
  for (const skill of body.skills) assert.equal(skill.markdown, readFileSync(join(FIXTURE, skill.path), 'utf8'));
  assert.equal(body.skills[1].description, 'Write commit messages the way this repository does. Use for every commit.');
  assert.equal(body.warnings.length, 1);
  assert.match(body.warnings[0], /^\.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('GitHub: the link pins the scanned commit; the SKILL.md is the one at that commit', async () => {
  const { status, body } = await scanned('https://github.com/JetBrains/example');
  assert.equal(status, 200);
  assert.equal(body.repository.id, 'JetBrains/example');
  assert.equal(body.skills.length, 1);
  const [skill] = body.skills;
  assert.equal(skill.link, `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`);
  assert.equal(
    skill.markdown,
    '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
  );
  assert.deepEqual(body.warnings, []);
});

test('no repository, or one that cannot be scanned → 400 and its message', async () => {
  assert.deepEqual(await scanned(' '), { status: 400, body: { error: 'Enter a GitHub repository URL or a directory' } });

  const missing = await scanned(join(FIXTURE, 'no-such-directory'));
  assert.equal(missing.status, 400);
  assert.match(missing.body.error ?? '', /^Not a GitHub URL or a readable directory: .*no-such-directory$/);

  assert.deepEqual(await scanned('https://github.com/JetBrains/not-answered'), {
    status: 400,
    body: { error: 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered' },
  });

  assert.equal((await fetch(`${base}/no-such-page`)).status, 404);
});

test('a port in use, or not a port → a clear message, exit code 1', () => {
  const port = new URL(base).port;
  const busy = spawnSync(process.execPath, [CLI, 'serve', port], { encoding: 'utf8', env: { ...process.env, HOST: '127.0.0.1' } });
  assert.equal(busy.status, 1);
  assert.equal(busy.stderr, `Port ${port} is in use; try skill-atlas serve <port>\n`);

  const wrong = spawnSync(process.execPath, [CLI, 'serve', 'http'], { encoding: 'utf8' });
  assert.equal(wrong.status, 1);
  assert.equal(wrong.stderr, 'Usage: skill-atlas serve [port]\n');
});
