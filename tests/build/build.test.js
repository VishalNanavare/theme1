import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fg from 'fast-glob';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Windows cannot CreateProcess a .cmd/.bat file directly — that is an OS
 * limitation, not a Node one, and it holds even for a fully-resolved
 * npm.cmd path (verified: execFileSync('<abs path to npm.cmd>', ...)
 * throws EINVAL regardless). The previous fix for that was `shell: true`,
 * which works but makes node emit a DEP0190 deprecation warning on every
 * run because an args array is combined with a shell.
 *
 * Invoking cmd.exe itself as the file (with /d /s /c and the real command
 * as further argv entries) sidesteps both problems: it never sets the
 * `shell` option, so DEP0190 does not fire, and cmd.exe — not Windows'
 * CreateProcess — is what parses the .cmd shim, so it works.
 */
const [command, prefixArgs] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'npm']] : ['npm', []];

let outDir;
let html;

beforeAll(async () => {
  // Build into a scratch directory rather than the shared dist/. Vitest runs
  // test files in parallel, and from Phase 02 onward other suites read dist/
  // directly — the very reason CI runs `npm run build` before `npm test`.
  // Deleting and rebuilding the shared dist/ here would race with, and could
  // invalidate, whatever else is reading it concurrently.
  outDir = await mkdtemp(path.join(tmpdir(), 'theme1-build-test-'));
  execFileSync(command, [...prefixArgs, 'run', 'build', '--', '--outDir', outDir, '--emptyOutDir'], {
    cwd: rootDir,
    stdio: 'pipe',
  });
  html = await readFile(path.join(outDir, 'index.html'), 'utf8');
}, 180_000);

afterAll(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true });
});

describe('vite build', () => {
  it('emits index.html at the top level of the build output', async () => {
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true);
    expect(await fg('**/*.html', { cwd: outDir })).toEqual(['index.html']);
  });

  it('rewrites the scss link to a hashed css asset', () => {
    expect(html).not.toContain('.scss');
    expect(html).toMatch(/<link[^>]+href="\/assets\/[^"]+\.css"/);
  });

  it('rewrites the js entry to a hashed module asset', () => {
    expect(html).toMatch(/<script[^>]+type="module"[^>]+src="\/assets\/[^"]+\.js"/);
  });

  it('emits no source .njk files', async () => {
    const leaked = await fg('**/*.njk', { cwd: outDir });
    expect(leaked).toEqual([]);
  });

  it('produces css that contains the smoke rule', async () => {
    const [cssFile] = await fg('assets/*.css', { cwd: outDir, absolute: true });
    const css = await readFile(cssFile, 'utf8');
    expect(css).toContain('.t-smoke');
  });
});
