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
import { JSDOM } from 'jsdom';
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

/** Execute the served page, with its requests reaching the real scan API. */
async function page(t: { after: (fn: () => void) => void }, repository = FIXTURE) {
  const html = await (await fetch(base)).text();
  const dom = new JSDOM(html, {
    url: `${base}/?repo=${encodeURIComponent(repository)}`,
    runScripts: 'dangerously',
    beforeParse(window) {
      window.fetch = (input, init) => fetch(new URL(String(input), base), init);
    },
  });
  t.after(() => dom.window.close());
  const document = dom.window.document;
  await until(() => !document.getElementById('filter-controls')!.hidden);
  const filter = document.querySelector<HTMLInputElement>('#filter')!;
  return {
    dom, document, filter,
    names: () => Array.from(document.querySelectorAll('#skills .name'), (node) => node.textContent),
    counts: () => document.getElementById('counts')!.textContent,
    selected: () => document.querySelector('#skill h2')?.textContent,
    input(value: string) {
      filter.value = value;
      filter.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    },
  };
}

async function until(condition: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'page did not finish scanning');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('Filter matches names by case-insensitive substring; empty shows all and warnings stay visible', async (t) => {
  const ui = await page(t);
  assert.equal(ui.document.querySelector('label[for="filter"]')?.textContent, 'Filter');
  assert.deepEqual(ui.names(), ['code-style', 'commits', 'release-checklist']);
  assert.equal(ui.counts(), '3 of 3 skills');
  assert.equal(ui.selected(), 'code-style');
  ui.input('MIT');
  assert.deepEqual(ui.names(), ['commits']);
  assert.equal(ui.counts(), '1 of 3 skills');
  assert.equal(ui.selected(), 'commits');
  assert.equal(ui.document.querySelectorAll('#warnings li').length, 1);
  ui.input('');
  assert.equal(ui.names().length, 3);
  assert.equal(ui.counts(), '3 of 3 skills');
  assert.equal(ui.selected(), 'commits');
  const buttons = ui.document.querySelectorAll<HTMLButtonElement>('#skills button');
  buttons[2].click();
  ui.input('check');
  assert.equal(ui.selected(), 'release-checklist');
  assert.equal(ui.document.querySelector('#skills button[aria-current="true"] .name')?.textContent, 'release-checklist');
});

test('no name matches: red field, zero count, cleared details; matching or clearing recovers', async (t) => {
  const ui = await page(t);
  for (const value of ['Write commit messages', 'no-such-skill']) {
    ui.input(value);
    assert.deepEqual(ui.names(), []);
    assert.equal(ui.counts(), '0 of 3 skills');
    assert.equal(ui.document.getElementById('skill')!.textContent, '');
    assert.equal(ui.filter.getAttribute('aria-invalid'), 'true');
    assert.equal(ui.dom.window.getComputedStyle(ui.filter).borderTopColor, 'rgb(221, 51, 51)');
    ui.input(value === 'Write commit messages' ? 'style' : '');
    assert.equal(ui.filter.getAttribute('aria-invalid'), 'false');
    assert.notEqual(ui.dom.window.getComputedStyle(ui.filter).borderTopColor, 'rgb(221, 51, 51)');
    assert.equal(ui.selected(), 'code-style');
  }
});

test('current filter applies to subsequent repository scans', async (t) => {
  const ui = await page(t);
  ui.input('style');
  ui.document.querySelector<HTMLInputElement>('#repo')!.value = 'https://github.com/JetBrains/example';
  ui.document.getElementById('scan')!.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => !ui.document.getElementById('filter-controls')!.hidden);
  assert.equal(ui.counts(), '0 of 1 skills');
  assert.deepEqual(ui.names(), []);
  assert.equal(ui.filter.getAttribute('aria-invalid'), 'true');
  ui.input('');
  assert.deepEqual(ui.names(), ['commits']);
  assert.equal(ui.counts(), '1 of 1 skills');
  assert.equal(ui.selected(), 'commits');
});

test('repository with no skills keeps filter and zero counts available', async (t) => {
  const empty = mkdtempSync(join(tmpdir(), 'skill-atlas-empty-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const ui = await page(t, empty);
  assert.equal(ui.counts(), '0 of 0 skills');
  assert.deepEqual(ui.names(), []);
  assert.equal(ui.filter.getAttribute('aria-invalid'), 'false');
  ui.input('anything');
  assert.equal(ui.filter.getAttribute('aria-invalid'), 'true');
  ui.input('');
  assert.equal(ui.filter.getAttribute('aria-invalid'), 'false');
});

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
  assert.deepEqual(await scanned(' '), { status: 400, body: { error: 'Enter a GitHub repository or account URL, or a directory' } });

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
