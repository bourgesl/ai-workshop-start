---
name: process track (record video)
description: process the video record
---

### Installation

```bash
# In your video project
npm init -y
npm install -D playwright @playwright/test
npx playwright install chromium
```

## Scenario to be recorded

```typescript 
import { chromium as playwright } from 'playwright';
import chromium from '@sparticuz/chromium';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createWebServer, listen } from '/workspaces/ai-workshop-start/src/web.ts';
import { openGitHub } from '/workspaces/ai-workshop-start/src/core/github.ts';
import { replay } from '/workspaces/ai-workshop-start/src/core/replay.ts';

const root = '/workspaces/ai-workshop-start';
const artifacts = process.env.AIR_ARTIFACTS_DIR;
const output = `${artifacts}/skill-atlas-demo`;
mkdirSync(output, { recursive: true });
const org = 'SkillAtlasDemo';
const sha = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';
const paths = ['.github/skills/code-style/SKILL.md', '.claude/skills/commits/SKILL.md', '.agents/skills/release-checklist/SKILL.md', 'agent/skills/commits/SKILL.md'];
const recording = {};
const answer = (url, body, status = 200) => recording[url] = { status, body };
answer(`https://api.github.com/users/${org}`, { login: org, type: 'Organization' });
answer(`https://api.github.com/orgs/${org}/repos?type=all&sort=full_name&per_page=100&page=1`, ['unavailable', 'agent-skills', 'empty'].map(name => ({ full_name: `${org}/${name}` })));
for (const name of ['agent-skills', 'empty']) {
const id = `${org}/${name}`;
answer(`https://api.github.com/repos/${id}`, { full_name: id, default_branch: 'main' });
answer(`https://api.github.com/repos/${id}/commits/main`, { sha });
answer(`https://api.github.com/repos/${id}/git/trees/${sha}?recursive=1`, { truncated: false, tree: (name === 'empty' ? [] : paths).map(path => ({ path, type: 'blob', mode: '100644' })) });
if (name === 'agent-skills') for (const path of paths) answer(`https://raw.githubusercontent.com/${id}/${sha}/${path}`, readFileSync(`${root}/fixture/${path}`, 'utf8'));
}
answer(`https://api.github.com/repos/${org}/unavailable`, { message: 'Not Found' }, 404);
const github = replay(recording);
const server = createWebServer(async input => {
await new Promise(resolve => setTimeout(resolve, 500));
return openGitHub(input, { fetch: github });
});
const base = await listen(server, 0, '127.0.0.1');
let browser;
try {
browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'light', recordVideo: { dir: output, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
addEventListener('DOMContentLoaded', () => {
const banner = document.createElement('div');
banner.id = 'demo-caption';
banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#142235;color:white;padding:17px 28px;font:19px system-ui;box-sizing:border-box;min-height:76px;pointer-events:none;box-shadow:0 -1px 6px #0002';
document.body.append(banner);
const cursor = document.createElement('div');
cursor.style.cssText = 'position:fixed;z-index:100000;width:16px;height:16px;border:2px solid #2367df;border-radius:50%;background:#2367df33;pointer-events:none;left:-30px;top:-30px;transform:translate(-50%,-50%)';
document.body.append(cursor);
addEventListener('mousemove', e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
});
});
const caption = text => page.locator('#demo-caption').evaluate((el, text) => { el.textContent = text; }, text);
const pause = ms => page.waitForTimeout(ms);
const click = async locator => { const box = await locator.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 }); await pause(250); await locator.click(); };
await page.goto(base);
await caption('Skill Atlas · Filters and organization scans | Fixture organization');
await pause(1600);
await click(page.locator('#repo'));
await page.locator('#repo').pressSequentially(`https://github.com/${org}/agent-skills`, { delay: 28 });
await click(page.getByRole('button', { name: 'Scan', exact: true }));
await page.locator('#filter-controls').waitFor({ state: 'visible' });
assert.equal(await page.locator('#counts').textContent(), '3 of 3 skills');
await caption('Scan a repository to browse its skills and original SKILL.md content.');
await pause(2500);
await caption('Filter names as you type. Matching ignores letter case.');
await click(page.locator('#filter'));
await page.locator('#filter').pressSequentially('COM', { delay: 250 });
assert.equal(await page.locator('#counts').textContent(), '1 of 3 skills');
assert.equal(await page.locator('#skill h2').textContent(), 'commits');
await pause(2800);
await caption('No matches: the filter turns red and the detail view clears.');
await page.locator('#filter').fill('no-such-skill');
assert.equal(await page.locator('#filter').getAttribute('aria-invalid'), 'true');
await pause(2800);
await caption('Clear the filter to restore all skills. Scan warnings stay visible.');
await page.locator('#filter').fill('');
await click(page.locator('#skills button').filter({ hasText: 'commits' }));
assert.equal(await page.locator('#counts').textContent(), '3 of 3 skills');
assert.ok(await page.locator('#warnings').isVisible());
await pause(2800);
await caption('Scan an organization URL to discover skills across its repositories.');
await click(page.locator('#repo'));
await page.locator('#repo').fill(`https://github.com/${org}`);
await pause(1000);
await click(page.getByRole('button', { name: 'Scan', exact: true }));
await page.locator('#repositories').waitFor({ state: 'visible' });
assert.match(await page.locator('#status').textContent(), /3 repositories · 3 skills · incomplete scan/);
assert.equal(await page.locator('#repositories li').count(), 3);
assert.equal(await page.locator('#filter-controls').isVisible(), false);
await caption('Organization totals and sorted repositories include zero-skill repositories.');
await pause(4000);
await caption('A failed repository is marked explicitly; successful results remain available.');
await page.screenshot({ path: `${output}/organization.png` });
await pause(4000);
await caption('Open a repository from the organization summary to explore its skills.');
await click(page.getByRole('link', { name: `${org}/agent-skills`, exact: true }));
await page.locator('#filter-controls').waitFor({ state: 'visible' });
await caption('Repository links reopen the full scan, including the filter and skill details.');
await click(page.locator('#filter'));
await page.locator('#filter').pressSequentially('style', { delay: 180 });
assert.equal(await page.locator('#counts').textContent(), '1 of 3 skills');
assert.equal(await page.locator('#skill h2').textContent(), 'code-style');
assert.ok((await page.locator('#skill .meta a').getAttribute('href')).includes(`/blob/${sha}/`));
await page.mouse.move(1130, 580, { steps: 12 });
await pause(3500);
await page.screenshot({ path: `${output}/filter.png` });
assert.deepEqual(errors, []);
const video = page.video();
await context.close();
const videoPath = await video.path();
writeFileSync(`${output}/video-path.txt`, videoPath);
console.log(`Recorded: ${videoPath}`);
} finally {
await browser?.close();
server.close();
}
```

1. Run the given scenario to capture the video and screenshots in docs/demo/test/.
2. Keep the video and png file.
3. If files are present in docs/demo/ref/, compare screenshot files pixel by pixel to detect any difference (count != 0); else skip
4. If screenshots are not the same, report failures in summary 
