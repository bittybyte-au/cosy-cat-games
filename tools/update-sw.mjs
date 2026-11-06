#!/usr/bin/env node
/* Refreshes the file list in sw.js: every file the site needs offline, each with a short hash of its contents.
   Run it before every commit that changes site files:   node tools/update-sw.mjs
   Devices then download only the files whose hash changed (not the whole site), and new files are picked up
   automatically, so there is no list to keep by hand and no VERSION to bump. */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (p) => createHash('sha1').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 10);
const files = {};
const add = (url, file) => { files[url] = hash(file || url.slice(2)); };

function walk(dir, ok) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = dir ? dir + '/' + name : name;
    if (name.startsWith('.')) continue;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel, ok));
    else if (ok(rel)) out.push(rel);
  }
  return out;
}

// pages: the site root, the top-level pages and every game, each by its folder URL and its index.html
add('./', 'index.html'); add('./index.html');
for (const page of ['play', 'about', 'faq', 'feedback']) if (existsSync(join(ROOT, page, 'index.html'))) { add('./' + page + '/', page + '/index.html'); add('./' + page + '/index.html'); }
add('./manifest.webmanifest');
for (const f of walk('shared', (p) => /\.(js|css)$/.test(p))) add('./' + f);
for (const f of walk('fonts', (p) => /\.(css|woff2)$/.test(p))) add('./' + f);
for (const f of walk('icons', (p) => /\.(svg|png)$/.test(p))) add('./' + f);
for (const f of walk('games', (p) => /\.(js|css|html|svg|png|webp|jpg)$/.test(p))) {
  if (f.endsWith('/index.html')) add('./' + f.slice(0, -'index.html'.length), f);
  add('./' + f);
}

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const all = createHash('sha1').update(JSON.stringify(files)).digest('hex').slice(0, 10);
const lines = Object.keys(files).map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(files[k]));
const block = '/* FILES:start (written by tools/update-sw.mjs, do not edit by hand) */\nconst VERSION = \'ccg-' + all + '\';\nconst FILES = {\n' + lines.join(',\n') + '\n};\n/* FILES:end */';
const next = sw.replace(/\/\* FILES:start[\s\S]*?\/\* FILES:end \*\//, block);
if (next === sw && !sw.includes('FILES:start')) { console.error('sw.js has no FILES:start ... FILES:end block'); process.exit(1); }
if (next !== sw) { writeFileSync(join(ROOT, 'sw.js'), next); console.log('sw.js updated: ' + Object.keys(files).length + ' files, version ccg-' + all); }
else console.log('sw.js already up to date (' + Object.keys(files).length + ' files)');
