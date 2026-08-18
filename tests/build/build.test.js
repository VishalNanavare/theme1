import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fg from 'fast-glob';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
let html;

beforeAll(async () => {
  await rm(path.join(rootDir, 'dist'), { recursive: true, force: true });
  execFileSync('npm', ['run', 'build'], { cwd: rootDir, stdio: 'pipe', shell: process.platform === 'win32' });
  html = await readFile(path.join(rootDir, 'dist/index.html'), 'utf8');
}, 180_000);

describe('vite build', () => {
  it('emits index.html at the top level of dist', () => {
    expect(existsSync(path.join(rootDir, 'dist/index.html'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'dist/.gen'))).toBe(false);
  });

  it('rewrites the scss link to a hashed css asset', () => {
    expect(html).not.toContain('.scss');
    expect(html).toMatch(/<link[^>]+href="\/assets\/[^"]+\.css"/);
  });

  it('rewrites the js entry to a hashed module asset', () => {
    expect(html).toMatch(/<script[^>]+type="module"[^>]+src="\/assets\/[^"]+\.js"/);
  });

  it('emits no source .njk files', async () => {
    const leaked = await fg('**/*.njk', { cwd: path.join(rootDir, 'dist') });
    expect(leaked).toEqual([]);
  });

  it('produces css that contains the smoke rule', async () => {
    const [cssFile] = await fg('assets/*.css', { cwd: path.join(rootDir, 'dist'), absolute: true });
    const css = await readFile(cssFile, 'utf8');
    expect(css).toContain('.t-smoke');
  });
});
