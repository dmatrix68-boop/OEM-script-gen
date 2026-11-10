#!/usr/bin/env node
/*  Schnuert das Release-Paket: dist/OEM-Script-Generator-<tag>.zip

      node tools/build-release.js v1.00

    Das Paket enthaelt die lauffaehige Oberflaeche, die Beispieldateien, die
    Pruefwerkzeuge und die Lizenz - aber keine Screenshots. In beiden READMEs
    werden die eingebetteten Bilder (![..](docs/screenshots/..)) deshalb durch
    Links auf das Repository ersetzt, festgenagelt auf den Tag des Releases.
    So bleibt das Paket klein, und die Links zeigen auf genau die Bilder, die
    zu dieser Version gehoeren.

    Braucht das zip-Programm (auf den GitHub-Runnern vorhanden). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const tag = process.argv[2];
if (!tag || !/^v\d+(\.\d+)*$/.test(tag)) {
  console.error('Aufruf: node tools/build-release.js v1.00');
  process.exit(2);
}
const repo = process.env.GITHUB_REPOSITORY || 'dmatrix68-boop/OEM-script-gen';

/* Tag und Versionsnummer der Oberflaeche muessen zusammenpassen. */
const verSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'version.js'), 'utf8');
const verMatch = verSrc.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!verMatch || 'v' + verMatch[1] !== tag) {
  console.error('Tag ' + tag + ' passt nicht zu js/version.js (' + (verMatch ? 'v' + verMatch[1] : 'keine Version') + ').');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const name = 'OEM-Script-Generator-' + tag;
const dist = path.join(root, 'dist');
const stage = path.join(dist, name);

const INCLUDE = ['index.html', 'css', 'js', 'samples', 'tools', 'LICENSE', 'README.md', 'README.en.md'];
const READMES = new Set(['README.md', 'README.en.md']);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const IMG = /!\[([^\]]*)\]\((docs\/screenshots\/[^)\s]+)\)/g;

function linkScreenshots(md, file) {
  let count = 0;
  const out = md.replace(IMG, (m, alt, rel) => {
    count++;
    return '[Screenshot: ' + alt + '](https://github.com/' + repo + '/blob/' + tag + '/' + rel + ')';
  });
  /* Nichts darf mehr auf eine Bilddatei im Paket verweisen. */
  if (/\]\(docs\//.test(out) || /!\[[^\]]*\]\(/.test(out)) {
    throw new Error(file + ': nach dem Umschreiben verweist noch etwas auf eine lokale Bilddatei.');
  }
  return { out, count };
}

for (const entry of INCLUDE) {
  const src = path.join(root, entry);
  const dst = path.join(stage, entry);
  if (READMES.has(entry)) {
    const { out, count } = linkScreenshots(fs.readFileSync(src, 'utf8'), entry);
    fs.writeFileSync(dst, out);
    console.log(entry + ': ' + count + ' Screenshots als Link');
  } else {
    fs.cpSync(src, dst, { recursive: true });
  }
}

const zipFile = path.join(dist, name + '.zip');
execFileSync('zip', ['-r', '-X', '-q', zipFile, name], { cwd: dist, stdio: 'inherit' });
console.log('Paket: ' + path.relative(root, zipFile) + ' (' + Math.round(fs.statSync(zipFile).size / 1024) + ' KB)');
