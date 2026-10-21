/// <reference lib="dom" />
// The demo in .agents/skills/process-tracks/sample_demo.ts as tests: spec/web.md's filtering and
// GitHub accounts, in Chromium, on the fixture organization SkillAtlasDemo answered from a recording.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { openGitHub } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { createWebServer, listen } from '../src/web.ts';

const FIXTURE = fileURLToPath(new URL('../fixture', import.meta.url));
const ORG = 'SkillAtlasDemo';
const SHA = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';
const PATHS = ['.github/skills/code-style/SKILL.md', '.claude/skills/commits/SKILL.md', '.agents/skills/release-checklist/SKILL.md', 'agent/skills/commits/SKILL.md'];

/** What GitHub answers for SkillAtlasDemo: agent-skills with ./fixture's skills, empty, and unavailable (404). */
function recording(): Recording {
  const recorded: Recording = {};
  const answer = (url: string, body: unknown, status = 200) => (recorded[url] = { status, body });
  answer(`https://api.github.com/users/${ORG}`, { login: ORG, type: 'Organization' });
  answer(`https://api.github.com/orgs/${ORG}/repos?type=all&sort=full_name&per_page=100&page=1`, ['unavailable', 'agent-skills', 'empty'].map((name) => ({ full_name: `${ORG}/${name}` })));
  for (const name of ['agent-skills', 'empty']) {
    const id = `${ORG}/${name}`;
    answer(`https://api.github.com/repos/${id}`, { full_name: id, default_branch: 'main' });
    answer(`https://api.github.com/repos/${id}/commits/main`, { sha: SHA });
    answer(`https://api.github.com/repos/${id}/git/trees/${SHA}?recursive=1`, { truncated: false, tree: (name === 'empty' ? [] : PATHS).map((path) => ({ path, type: 'blob', mode: '100644' })) });
    if (name === 'agent-skills') for (const path of PATHS) answer(`https://raw.githubusercontent.com/${id}/${SHA}/${path}`, readFileSync(`${FIXTURE}/${path}`, 'utf8'));
  }
  answer(`https://api.github.com/repos/${ORG}/unavailable`, { message: 'Not Found' }, 404);
  return recorded;
}

/** The demo's caption banner and visible cursor, so the videos read like it. */
function overlay() {
  addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'demo-caption';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#142235;color:white;padding:17px 28px;font:19px system-ui;box-sizing:border-box;min-height:76px;pointer-events:none;box-shadow:0 -1px 6px #0002';
    document.body.append(banner);
    const cursor = document.createElement('div');
    cursor.style.cssText = 'position:fixed;z-index:100000;width:16px;height:16px;border:2px solid #2367df;border-radius:50%;background:#2367df33;pointer-events:none;left:-30px;top:-30px;transform:translate(-50%,-50%)';
    document.body.append(cursor);
    addEventListener('mousemove', (e) => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
  });
}

type Demo = {
  caption: (text: string) => Promise<void>;
  click: (locator: Locator) => Promise<void>;
  /** A named screenshot next to the test's video, the caret hidden and animations stopped. */
  shot: (name: string) => Promise<void>;
  scan: (repo: string) => Promise<void>;
};

const test = base.extend<{ demo: Demo }, { base: string }>({
  // The web view, with GitHub answering from the recording; scans take 500 ms, as in the demo.
  base: [async ({}, use) => {
    const github = replay(recording());
    const server: Server = createWebServer(async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return openGitHub(input, { fetch: github });
    });
    await use(await listen(server, 0, '127.0.0.1'));
    server.close();
  }, { scope: 'worker' }],
  demo: async ({ page, base }, use, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(overlay);
    await page.goto(base);
    await use({
      caption: (text) => page.locator('#demo-caption').evaluate((el, text) => { el.textContent = text; }, text),
      async click(locator) {
        const box = (await locator.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
        await locator.click();
      },
      async shot(name) {
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', caret: 'hide' });
      },
      async scan(repo) {
        await page.locator('#repo').fill(repo);
        await this.click(page.getByRole('button', { name: 'Scan', exact: true }));
      },
    });
    expect(errors).toEqual([]);
  },
});

const filter = (page: Page) => page.locator('#filter');
const counts = (page: Page) => page.locator('#counts');
const selected = (page: Page) => page.locator('#skill h2');

test('compact skill rows retain descriptions and show keyboard focus and selection', async ({ page, demo }) => {
  await demo.scan(`https://github.com/${ORG}/agent-skills`);
  const buttons = page.locator('#skills button');
  await expect(buttons).toHaveCount(3);
  for (const button of await buttons.all()) {
    expect((await button.boundingBox())!.height).toBeLessThanOrEqual(52);
  }
  const description = buttons.nth(1).locator('.description');
  const text = 'Write commit messages the way this repository does. Use for every commit.';
  await expect(description).toHaveText(text);
  await expect(description).toHaveAttribute('title', text);
  await expect(buttons.nth(1)).toHaveAccessibleName(`commits ${text}`);
  expect(await description.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  await filter(page).focus();
  await page.keyboard.press('Tab');
  await expect(buttons.nth(0)).toBeFocused();
  await expect(buttons.nth(0)).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(selected(page)).toHaveText('commits');
  await expect(buttons.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(buttons.nth(1)).toHaveCSS('border-left-color', 'rgb(68, 136, 255)');
  await expect(buttons.nth(0)).toHaveAttribute('aria-current', 'false');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(selected(page)).toHaveText('release-checklist');
  await demo.shot('compact-list');
});

test('mobile skill list wraps long names and scrolls above the details without page overflow', async ({ page, demo }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  const longName = 'long-skill-name-'.repeat(8);
  await page.route('**/api/scan?*', async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    result.skills[0].name = longName;
    result.skills = Array.from({ length: 20 }, (_, index) => ({
      ...result.skills[index % 3], id: `skill-${index}`,
    }));
    await route.fulfill({ response, json: result });
  });
  await demo.scan(`https://github.com/${ORG}/agent-skills`);
  await expect(page.locator('#skills button')).toHaveCount(20);
  const list = page.locator('#skills');
  const bounds = (await list.boundingBox())!;
  expect(bounds.height).toBeLessThanOrEqual(290);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const name = list.locator('.name').first();
  await expect(name).toHaveText(longName);
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const detail = (await page.locator('#skill').boundingBox())!;
  expect(detail.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await list.locator('button').nth(19).click();
  await expect(selected(page)).toHaveText('commits');
  await demo.shot('mobile-list');
});

test('repository scan lists its skills; the filter matches names ignoring letter case', async ({ page, demo }) => {
  await demo.caption('Skill Atlas · Filters and organization scans | Fixture organization');
  await demo.click(page.locator('#repo'));
  await page.locator('#repo').pressSequentially(`https://github.com/${ORG}/agent-skills`);
  await demo.click(page.getByRole('button', { name: 'Scan', exact: true }));
  await expect(page.locator('#filter-controls')).toBeVisible();
  await expect(counts(page)).toHaveText('3 of 3 skills');
  await expect(page.locator('#skills .name')).toHaveText(['code-style', 'commits', 'release-checklist']);
  await demo.caption('Scan a repository to browse its skills and original SKILL.md content.');
  await demo.shot('repository');

  await demo.caption('Filter names as you type. Matching ignores letter case.');
  await demo.click(filter(page));
  await filter(page).pressSequentially('COM');
  await expect(counts(page)).toHaveText('1 of 3 skills');
  await expect(selected(page)).toHaveText('commits');
  await demo.shot('filter-case');
});

test('no matches: the filter turns red and the detail view clears; clearing restores every skill and warnings stay', async ({ page, demo }) => {
  await demo.scan(`https://github.com/${ORG}/agent-skills`);
  await expect(counts(page)).toHaveText('3 of 3 skills');

  await demo.caption('No matches: the filter turns red and the detail view clears.');
  await filter(page).fill('no-such-skill');
  await expect(filter(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(filter(page)).toHaveCSS('border-top-color', 'rgb(221, 51, 51)');
  await expect(counts(page)).toHaveText('0 of 3 skills');
  await expect(page.locator('#skill')).toBeEmpty();
  await demo.shot('no-match');

  await demo.caption('Clear the filter to restore all skills. Scan warnings stay visible.');
  await filter(page).fill('');
  await expect(filter(page)).toHaveAttribute('aria-invalid', 'false');
  await demo.click(page.locator('#skills button').filter({ hasText: 'commits' }));
  await expect(counts(page)).toHaveText('3 of 3 skills');
  await expect(selected(page)).toHaveText('commits');
  await expect(page.locator('#warnings')).toBeVisible();
  await demo.shot('cleared');
});

test('organization scan: totals, sorted repositories including zero skills, the failed one marked', async ({ page, demo }) => {
  await demo.scan(`https://github.com/${ORG}/agent-skills`);
  await expect(page.locator('#filter-controls')).toBeVisible();

  await demo.caption('Scan an organization URL to discover skills across its repositories.');
  await demo.scan(`https://github.com/${ORG}`);
  await expect(page.locator('#repositories')).toBeVisible();
  await expect(page.locator('#status')).toContainText('3 repositories · 3 skills · incomplete scan');
  await expect(page.locator('#repositories li')).toHaveCount(3);
  await expect(page.locator('#repositories li a')).toHaveText([`${ORG}/agent-skills`, `${ORG}/empty`, `${ORG}/unavailable`]);
  await expect(page.locator('#filter-controls')).toBeHidden();
  await demo.caption('A failed repository is marked explicitly; successful results remain available.');
  await demo.shot('organization');
});

test('a repository link from the organization reopens its full scan, filter and pinned links', async ({ page, demo }) => {
  await demo.scan(`https://github.com/${ORG}`);
  await expect(page.locator('#repositories')).toBeVisible();

  await demo.caption('Open a repository from the organization summary to explore its skills.');
  await demo.click(page.getByRole('link', { name: `${ORG}/agent-skills`, exact: true }));
  await expect(page.locator('#filter-controls')).toBeVisible();
  await expect(page.locator('#repositories')).toBeHidden();

  await demo.caption('Repository links reopen the full scan, including the filter and skill details.');
  await demo.click(filter(page));
  await filter(page).pressSequentially('style');
  await expect(counts(page)).toHaveText('1 of 3 skills');
  await expect(selected(page)).toHaveText('code-style');
  await expect(page.locator('#skill .meta a')).toHaveAttribute('href', new RegExp(`/blob/${SHA}/`));
  await page.mouse.move(1130, 580, { steps: 12 });
  await demo.shot('filter');
});
