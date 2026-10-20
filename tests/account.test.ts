import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { createBrowserBackend } from '../src/browser.ts';
import { run } from '../src/commands.ts';
import { scanInput, type AccountResult } from '../src/core/account.ts';
import { openGitHub, type Fetch } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { createWebServer, listen } from '../src/web.ts';

const commit = '1234567890abcdef';
const markdown = '---\nname: review\ndescription: Review changes. Then approve.\n---\n# Review\n';
const accountUrl = 'https://github.com/workshop';
const api = 'https://api.github.com';
const accountInfo = `${api}/users/workshop`;
const listUrl = (type = 'Organization', page = 1) =>
  `${api}/${type === 'Organization' ? 'orgs' : 'users'}/workshop/repos?type=${type === 'Organization' ? 'all' : 'owner'}&sort=full_name&per_page=100&page=${page}`;

/** Recorded GitHub answers; unrecorded requests fail, including unnecessary copies. */
function github(options: { type?: string; paginated?: boolean; failed?: boolean; empty?: boolean; token?: boolean } = {}) {
  const type = options.type ?? 'Organization';
  const ids = options.empty ? [] : ['workshop/zeta', 'workshop/alpha', 'workshop/empty'];
  if (options.paginated) ids.push(...Array.from({ length: 98 }, (_, index) => `workshop/extra-${String(index).padStart(3, '0')}`));
  if (options.failed) ids.push('workshop/unavailable');
  const recording: Recording = { [accountInfo]: { status: 200, body: { login: 'workshop', type } } };
  for (let page = 1; page === 1 || (page - 1) * 100 <= ids.length; page++) {
    recording[listUrl(type, page)] = { status: 200, body: ids.slice((page - 1) * 100, page * 100).map((full_name) => ({ full_name })) };
    if (page * 100 > ids.length) break;
  }
  for (const id of ids) {
    const empty = id.includes('/empty') || id.includes('/extra-');
    const unavailable = id.endsWith('/unavailable');
    recording[`${api}/repos/${id}`] = unavailable ? { status: 404, body: { message: 'Not Found' } } :
      { status: 200, body: { full_name: id, default_branch: 'main' } };
    recording[`${api}/repos/${id}/commits/main`] = empty ? { status: 409, body: { message: 'Git Repository is empty.' } } :
      { status: 200, body: { sha: commit } };
    const paths = id.endsWith('/alpha') ? ['.agents/skills/review/SKILL.md', '.claude/skills/review/SKILL.md', '.agents/skills/broken/SKILL.md'] :
      id.endsWith('/zeta') ? ['.agents/skills/review/SKILL.md'] : [];
    recording[`${api}/repos/${id}/git/trees/${commit}?recursive=1`] = {
      status: 200, body: { truncated: false, tree: paths.map((path) => ({ path, type: 'blob', mode: '100644', sha: '0' })) },
    };
    recording[`${api}/search/code?q=filename:SKILL.md+repo:${id}&per_page=100&page=1`] = {
      status: 200, body: { total_count: paths.length, items: paths.map((path) => ({ path })) },
    };
    recording[`https://raw.githubusercontent.com/${id}/${commit}/.agents/skills/review/SKILL.md`] = { status: 200, body: markdown };
    recording[`https://raw.githubusercontent.com/${id}/${commit}/.agents/skills/broken/SKILL.md`] = { status: 200, body: '---\ndescription: bad: yaml\n---\n' };
  }
  const calls: { url: string; headers?: Record<string, string> }[] = [];
  const recorded = replay(recording);
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, headers: init?.headers });
    return recorded(url, init);
  };
  return { recording, calls, fetch, ids, open: (input: string) => openGitHub(input, { fetch, token: options.token ? 'test-token' : undefined }) };
}

async function command(open: ReturnType<typeof github>['open'], url = accountUrl) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(['scan', url], { open, print: (line) => stdout.push(line), error: (line) => stderr.push(line) });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

test('organization scan follows all pages, sorts repositories, deduplicates skills and includes empty repositories', async () => {
  const fixture = github({ paginated: true });
  // A repository repeated across pages must still be scanned once.
  (fixture.recording[listUrl('Organization', 2)].body as { full_name: string }[]).push({ full_name: 'workshop/alpha' });
  const result = await scanInput(await fixture.open(accountUrl)) as AccountResult;
  assert.equal(result.repositories.length, 101);
  assert.deepEqual(result.repositories.map(({ id }) => id), [...fixture.ids].sort());
  assert.ok(fixture.calls.some(({ url }) => url === listUrl('Organization', 2)));
  assert.equal(fixture.calls.filter(({ url }) => url === `${api}/repos/workshop/alpha`).length, 1);
  const alpha = result.repositories[0].result!;
  assert.deepEqual(alpha.skills.map(({ name }) => name), ['broken', 'review']);
  assert.deepEqual(alpha.skills[1].copies, ['.claude/skills/review/SKILL.md']);
  assert.equal(alpha.skills[1].markdown, markdown);
  assert.equal(alpha.skills[1].commit, commit);
  assert.equal(result.repositories[1].result!.skills.length, 0);
  assert.equal(result.repositories.at(-1)!.result!.skills.length, 1);
  assert.equal(result.repositories.at(-1)!.result!.skills[0].name, 'review');
  assert.match(result.warnings[0], /^workshop\/alpha: .*malformed front matter/);
});

test('user account URLs, CLI and browser terminal use account scans; tokens authenticate listing and code search', async () => {
  for (const url of [accountUrl, 'github.com/workshop/', 'https://www.github.com/workshop/']) {
    const fixture = github({ type: 'User', token: true });
    const result = await command(fixture.open, url);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^workshop · 3 repositories\nworkshop\/alpha · 2 skills/);
    assert.match(result.stdout, /workshop\/empty · 0 skills\nworkshop\/zeta · 1 skill\nreview — Review changes\./);
    assert.match(result.stdout, new RegExp(`https://github.com/workshop/alpha/blob/${commit}/`));
    assert.match(result.stderr, /warning: workshop\/alpha: .*malformed front matter/);
    assert.ok(fixture.calls.some(({ url }) => url === listUrl('User')));
    for (const call of fixture.calls.filter(({ url }) => url.startsWith(api))) {
      assert.equal(call.headers?.Authorization, 'Bearer test-token');
    }
    assert.ok(fixture.calls.some(({ url }) => url.includes('/search/code?')));
  }
  const fixture = github({ type: 'User' });
  const output = await createBrowserBackend({ fetch: fixture.fetch }).run(`scan ${accountUrl}`);
  assert.match(output, /^workshop · 3 repositories/);
  assert.match(output, /review — Review changes\./);
});

test('repository failures are explicit, retain successful results and do not count as zero skills', async () => {
  const fixture = github({ failed: true });
  const result = await command(fixture.open);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /workshop\/unavailable · scan failed/);
  assert.doesNotMatch(result.stdout, /unavailable · 0 skills/);
  assert.match(result.stderr, /warning: workshop\/unavailable: Repository not found/);
  assert.match(result.stdout, /workshop\/alpha · 2 skills/);
});

test('account scans keep no more than four repository scans in flight', async () => {
  const fixture = github({ paginated: true });
  let active = 0;
  let peak = 0;
  const fetch: Fetch = async (url, init) => {
    if (!/^https:\/\/api.github.com\/repos\/workshop\/[^/?]+$/.test(url)) return fixture.fetch(url, init);
    active++;
    peak = Math.max(peak, active);
    await delay(2);
    try { return await fixture.fetch(url, init); } finally { active--; }
  };
  await scanInput(await openGitHub(accountUrl, { fetch }));
  assert.equal(peak, 4);
});

async function web(t: { after(fn: () => void): void }, fixture = github()) {
  const server = createWebServer(fixture.open);
  const base = await listen(server, 0, '127.0.0.1');
  t.after(() => server.close());
  const html = await (await fetch(base)).text();
  async function page(url = `${base}/?repo=${encodeURIComponent(accountUrl)}`, waitForScan = true) {
    const dom = new JSDOM(html, {
      url, runScripts: 'dangerously',
      beforeParse(window) { window.fetch = (input, init) => fetch(new URL(String(input), base), init); },
    });
    t.after(() => dom.window.close());
    if (waitForScan) await until(() => !dom.window.document.getElementById('repositories')!.hidden || !dom.window.document.getElementById('filter-controls')!.hidden || !!dom.window.document.querySelector('#status .error'));
    return dom;
  }
  return { base, page };
}

async function until(condition: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'page did not finish scanning');
    await delay(10);
  }
}

function submit(dom: JSDOM, input: string) {
  const document = dom.window.document;
  document.querySelector<HTMLInputElement>('#repo')!.value = input;
  document.getElementById('scan')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

test('account API and served page show counts, warnings and links into the existing repository scan', async (t) => {
  const { base, page } = await web(t, github({ failed: true }));
  const response = await fetch(`${base}/api/scan?repo=${encodeURIComponent(accountUrl)}`);
  assert.equal(response.status, 200);
  const result = await response.json() as AccountResult;
  assert.equal(result.account.id, 'workshop');
  assert.equal(result.repositories.length, 4);
  assert.equal(result.repositories[0].result!.skills.length, 2);
  assert.match(result.repositories[2].error!, /Repository not found/);
  const dom = await page();
  const document = dom.window.document;
  assert.match(document.getElementById('status')!.textContent!, /workshop · 4 repositories · 3 skills · incomplete scan/);
  const rows = Array.from(document.querySelectorAll('#repositories li'), (node) => node.textContent);
  assert.match(rows[0]!, /^workshop\/alpha · 2 skills$/);
  assert.match(rows[1]!, /^workshop\/empty · 0 skills$/);
  assert.match(rows[2]!, /^workshop\/unavailable · scan failed: /);
  assert.equal(rows[3], 'workshop/zeta · 1 skill');
  assert.equal(document.getElementById('filter-controls')!.hidden, true);
  assert.equal(document.querySelector('main')!.hidden, true);
  assert.equal(document.querySelectorAll('#warnings li').length, 2);
  const link = document.querySelector<HTMLAnchorElement>('#repositories a')!;
  assert.equal(new URL(link.href).searchParams.get('repo'), 'https://github.com/workshop/alpha');
  const detail = await page(link.href);
  const details = detail.window.document;
  assert.equal(details.getElementById('repositories')!.hidden, true);
  assert.equal(details.querySelector('#skill h2')?.textContent, 'broken');
  assert.equal(details.getElementById('counts')!.textContent, '2 of 2 skills');
  const filter = details.querySelector<HTMLInputElement>('#filter')!;
  filter.value = 'REVIEW';
  filter.dispatchEvent(new detail.window.Event('input', { bubbles: true }));
  assert.equal(details.querySelector('#skill pre')!.textContent, markdown);
  assert.equal(details.querySelector<HTMLAnchorElement>('#skill a')!.href, `https://github.com/workshop/alpha/blob/${commit}/.agents/skills/review/SKILL.md`);
  assert.match(details.querySelector('#skill .meta')!.textContent!, /also in .claude\/skills\/review\/SKILL.md/);
  submit(detail, accountUrl);
  await until(() => !details.getElementById('repositories')!.hidden);
  assert.equal(details.getElementById('filter-controls')!.hidden, true);
  submit(detail, 'https://github.com/workshop/alpha');
  await until(() => !details.getElementById('filter-controls')!.hidden);
  assert.equal(details.getElementById('repositories')!.hidden, true);
  assert.equal(details.querySelector('#skill h2')!.textContent, 'review');
  assert.equal(details.querySelectorAll('#repositories li').length, 0);
});

test('empty accounts have an explicit empty state in CLI, API and page', async (t) => {
  const fixture = github({ empty: true });
  assert.deepEqual(await command(fixture.open), { code: 0, stdout: 'workshop · 0 repositories', stderr: '' });
  const { page } = await web(t, fixture);
  const dom = await page();
  assert.match(dom.window.document.getElementById('status')!.textContent!, /0 repositories · 0 skills/);
  assert.match(dom.window.document.getElementById('repositories')!.textContent!, /No repositories found\./);
  assert.equal(dom.window.document.querySelectorAll('#repositories li').length, 0);
});

test('unknown accounts, offline lookup and failed listings return clear errors without partial results', async (t) => {
  for (const scenario of ['missing', 'offline', 'limited', 'second-page', 'token'] as const) {
    const fixture = github({ paginated: true });
    const target = scenario === 'second-page' ? listUrl('Organization', 2) : scenario === 'limited' ? listUrl() : accountInfo;
    if (scenario === 'offline') delete fixture.recording[target];
    else fixture.recording[target] = scenario === 'missing' ? { status: 404, body: { message: 'Not Found' } } :
      scenario === 'token' ? { status: 401, body: { message: 'Bad credentials' } } :
      { status: 403, body: { message: 'API rate limit exceeded' } };
    const expected = scenario === 'missing' ? /Account not found/ : scenario === 'offline' ? /Cannot reach GitHub/ : scenario === 'token' ? /GitHub rejected the token/ : /GitHub rate limit reached; set GITHUB_TOKEN/;
    const result = await command(fixture.open);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, expected);
    const { base, page } = await web(t, fixture);
    const response = await fetch(`${base}/api/scan?repo=${encodeURIComponent(accountUrl)}`);
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string; repositories?: unknown };
    assert.match(body.error, expected);
    assert.equal(body.repositories, undefined);
    const dom = await page();
    assert.match(dom.window.document.querySelector('#status .error')!.textContent!, expected);
    assert.equal(dom.window.document.getElementById('repositories')!.hidden, true);
    assert.equal(dom.window.document.getElementById('filter-controls')!.hidden, true);
  }
});

test('a slower account scan cannot replace a newer repository scan', async (t) => {
  const fixture = github();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const { base, page } = await web(t, {
    ...fixture,
    open: async (input: string) => {
      if (input === accountUrl) {
        started.resolve();
        await release.promise;
      }
      return fixture.open(input);
    },
  });
  const dom = await page(`${base}/`, false);
  const document = dom.window.document;
  // Observe when the account result's JSON has been consumed by the page.
  const consumed = Promise.withResolvers<void>();
  const fetch = dom.window.fetch;
  dom.window.fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (String(input).includes(encodeURIComponent(accountUrl))) {
      const json = response.json.bind(response);
      response.json = async () => {
        const value = await json();
        consumed.resolve();
        return value;
      };
    }
    return response;
  };
  submit(dom, accountUrl);
  await started.promise;
  submit(dom, 'https://github.com/workshop/alpha');
  await until(() => !document.getElementById('filter-controls')!.hidden);
  release.resolve();
  await consumed.promise;
  await delay(0); // let the page finish handling the consumed response
  assert.equal(document.getElementById('repositories')!.hidden, true);
  assert.equal(document.getElementById('filter-controls')!.hidden, false);
  assert.match(document.getElementById('status')!.textContent!, /^workshop\/alpha · 2 skills/);
});
