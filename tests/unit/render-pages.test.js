import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderAll, loadData } from '../../scripts/render-pages.mjs';

let dir;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'theme1-render-'));
  await mkdir(path.join(dir, 'src/pages'), { recursive: true });
  await mkdir(path.join(dir, 'src/layouts'), { recursive: true });
  await mkdir(path.join(dir, 'src/data'), { recursive: true });
  await writeFile(
    path.join(dir, 'src/layouts/base.njk'),
    '<!doctype html><title>{{ title }}</title><body>{% block content %}{% endblock %}</body>',
  );
  await writeFile(
    path.join(dir, 'src/pages/index.njk'),
    '{% extends "layouts/base.njk" %}{% set title = site.name %}{% block content %}<h1>{{ site.name }}</h1>{% endblock %}',
  );
  await writeFile(path.join(dir, 'src/data/site.json'), JSON.stringify({ name: 'theme1' }));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadData', () => {
  it('keys each JSON file by its basename', async () => {
    const data = await loadData(path.join(dir, 'src/data'));
    expect(data).toEqual({ site: { name: 'theme1' } });
  });

  it('returns an empty object when the directory is absent', async () => {
    expect(await loadData(path.join(dir, 'nope'))).toEqual({});
  });
});

describe('renderAll', () => {
  it('renders every page to flat HTML in the output directory', async () => {
    const written = await renderAll({ root: dir });
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(path.join(dir, 'src/index.html'));

    const html = await readFile(written[0], 'utf8');
    expect(html).toContain('<h1>theme1</h1>');
    expect(html).toContain('<title>theme1</title>');
  });

  it('escapes interpolated data by default', async () => {
    await writeFile(path.join(dir, 'src/data/site.json'), JSON.stringify({ name: '<script>x</script>' }));
    const [out] = await renderAll({ root: dir });
    const html = await readFile(out, 'utf8');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('throws with the page name when a template fails', async () => {
    await writeFile(path.join(dir, 'src/pages/broken.njk'), '{% extends "layouts/missing.njk" %}');
    await expect(renderAll({ root: dir })).rejects.toThrow(/broken\.njk/);
  });

  it('fails loudly, naming the file, when a template is nested in a subdirectory', async () => {
    await mkdir(path.join(dir, 'src/pages/apps'), { recursive: true });
    await writeFile(path.join(dir, 'src/pages/apps/email.njk'), '{% extends "layouts/base.njk" %}');

    await expect(renderAll({ root: dir })).rejects.toThrow(/apps[/\\]email\.njk/);
    await expect(renderAll({ root: dir })).rejects.toThrow(/flat by design/);
  });

  it('skips rewriting output that is already byte-identical, to avoid needless watcher churn', async () => {
    const [out] = await renderAll({ root: dir });

    // Make a second write fail loudly instead of silently — if renderAll
    // tries to rewrite unchanged output, this proves it by throwing.
    await chmod(out, 0o444);
    try {
      const [outAgain] = await renderAll({ root: dir });
      expect(outAgain).toBe(out);
    } finally {
      await chmod(out, 0o666);
    }
  });

  it('does rewrite output when the rendered content changes', async () => {
    const [out] = await renderAll({ root: dir });
    const first = await readFile(out, 'utf8');

    await writeFile(path.join(dir, 'src/data/site.json'), JSON.stringify({ name: 'changed' }));
    await renderAll({ root: dir });
    const second = await readFile(out, 'utf8');

    expect(second).not.toBe(first);
    expect(second).toContain('changed');
  });
});
