/// <reference lib="dom" />
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { openDirectory } from '../src/local.ts';
import { createWebServer, listen } from '../src/web.ts';

for (const width of [320, 390, 640]) {
  test(`repository status wraps long names without mobile overflow at ${width}px`, async ({ page }) => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-mobile-'));
    const server = createWebServer(openDirectory);
    try {
      for (const name of ['control', 'x'.repeat(100)]) {
        const skill = join(root, name, '.agents/skills/a');
        mkdirSync(skill, { recursive: true });
        writeFileSync(join(skill, 'SKILL.md'), '---\nname: control\ndescription: Synthetic control\n---\nCONTROL MARKER');
      }
      await page.setViewportSize({ width, height: 600 });
      await page.goto(await listen(server, 0, '127.0.0.1'));
      for (const name of ['control', 'x'.repeat(100)]) {
        const directory = join(root, name);
        await page.locator('#repo').fill(directory);
        const response = page.waitForResponse((response) =>
          new URL(response.url()).pathname === '/api/scan' &&
          new URL(response.url()).searchParams.get('repo') === directory);
        await page.getByRole('button', { name: 'Scan', exact: true }).click();
        expect((await response).status()).toBe(200);
        await expect(page.locator('#status strong')).toHaveText(name);
        await expect(page.locator('#counts')).toHaveText('1 of 1 skills');
        await expect(page.locator('#skill pre')).toContainText('CONTROL MARKER');
        const layout = await page.evaluate(() => ({
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          statusWidth: document.querySelector('#status')!.getBoundingClientRect().width,
        }));
        expect(layout.viewport).toBe(width);
        expect(layout.documentWidth).toBeLessThanOrEqual(width);
        expect(layout.statusWidth).toBeLessThanOrEqual(width);
        if (name !== 'control') {
          const text = await page.locator('#status strong').evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return Array.from(range.getClientRects(), (rect) => ({
              top: rect.top, left: rect.left, right: rect.right,
            }));
          });
          expect(new Set(text.map((rect) => rect.top)).size).toBeGreaterThan(1);
          for (const rect of text) {
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      rmSync(root, { recursive: true, force: true });
    }
  });
}
