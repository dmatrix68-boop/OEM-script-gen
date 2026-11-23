#!/usr/bin/env node
/*  Abgleich mit dem Antwortdatei-Generator von Christoph Schneegans
    (https://github.com/cschneegans/unattend-generator, MIT-Lizenz).

      node tools/sync-schneegans.js <Klon> [--report bericht.md] [--resources] [--write]

    <Klon>        lokaler Klon des Repositorys (git clone ...)
    --report F    Bericht als Markdown nach F schreiben (sonst Konsole)
    --resources   js/ug/resources.js aus resource/ neu erzeugen
    --write       vendor/schneegans/UPSTREAM.json auf den Stand des Klons
                  setzen - erst NACH Durchsicht und Uebernahme der Aenderungen

    Exitcode: 0 = keine Aenderungen, 3 = Aenderungen seit dem Port-Stand,
    sonst Fehler.

    vendor/schneegans/UPSTREAM.json haelt fest, auf welchem Commit der Port
    beruht, je Datei die Git-Blob-Kennung und wohin sie portiert ist. So zeigt
    der Bericht fuer jede geaenderte Datei das betroffene JS-Modul. Ressourcen
    (JSON-Daten, Skripte) werden nicht von Hand portiert, sondern mit
    --resources uebernommen - geaenderte Skripte erscheinen im Bericht trotzdem
    im Wortlaut, weil sie auf den Zielrechnern als SYSTEM laufen.  */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const upstreamFile = path.join(root, 'vendor', 'schneegans', 'UPSTREAM.json');
const resourcesFile = path.join(root, 'js', 'ug', 'resources.js');

const args = process.argv.slice(2);
const clone = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--report');
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;
if (!clone || !fs.existsSync(path.join(clone, 'Main.cs'))) {
  console.error('Aufruf: node tools/sync-schneegans.js <Klon von cschneegans/unattend-generator> [--report F] [--resources] [--write]');
  process.exit(2);
}

/* Ressourcen, die der Port braucht. .xsd (Schema-Pruefung) laeuft im Browser nicht. */
const RESOURCE_EXT = /\.(json|ps1|xml|vbs)$/i;

function git(...a) { return execFileSync('git', ['-C', clone, ...a], { encoding: 'utf8' }).trim(); }

/* Git-Blob-Kennungen aus dem Commit selbst (git ls-tree) - unabhaengig davon,
   mit welchen Zeilenenden der Klon ausgecheckt ist. */
function trackedFiles() {
  const out = git('ls-tree', '-r', 'HEAD');
  const map = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/);
    if (!m) continue;
    const p = m[2];
    if (/\.cs$/.test(p) || /^resource\//.test(p)) map[p] = m[1];
  }
  return map;
}

function loadUpstream() {
  try { return JSON.parse(fs.readFileSync(upstreamFile, 'utf8')); }
  catch (e) { return { repo: 'https://github.com/cschneegans/unattend-generator', commit: null, files: {} }; }
}

/* Text einer Ressource: ohne BOM, Zeilenenden vereinheitlicht */
function readText(p) {
  return fs.readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function writeResources(commit) {
  const dir = path.join(clone, 'resource');
  const names = fs.readdirSync(dir).filter((n) => RESOURCE_EXT.test(n)).sort();
  let s = '/* Automatisch erzeugt von tools/sync-schneegans.js - nicht von Hand aendern.\n' +
    '   Quelle: https://github.com/cschneegans/unattend-generator/tree/' + commit + '/resource\n' +
    '   Copyright (c) Christoph Schneegans, MIT-Lizenz (vendor/schneegans/LICENSE.txt). */\n' +
    '(function (global) {\n  \'use strict\';\n  global.UGResources = {\n';
  names.forEach((n, i) => {
    const text = readText(path.join(dir, n));
    const value = /\.json$/i.test(n) ? JSON.stringify(JSON.parse(text)) : JSON.stringify(text);
    s += '    ' + JSON.stringify(n) + ': ' + value + (i < names.length - 1 ? ',' : '') + '\n';
  });
  s += '  };\n  global.UGPort = ' + JSON.stringify({ commit, date: git('log', '-1', '--format=%cI', commit) }) + ';\n';
  s += '})(typeof window !== \'undefined\' ? window : globalThis);\n';
  fs.mkdirSync(path.dirname(resourcesFile), { recursive: true });
  fs.writeFileSync(resourcesFile, s);
  return names.length;
}

const head = git('rev-parse', 'HEAD');
const headDate = git('log', '-1', '--format=%cI');
const up = loadUpstream();
const now = trackedFiles();

const changed = [], added = [], removed = [];
for (const [p, sha] of Object.entries(now)) {
  const known = up.files[p];
  if (!known) added.push(p);
  else if (known.blob !== sha) changed.push(p);
}
for (const p of Object.keys(up.files)) if (!now[p]) removed.push(p);

const portOf = (p) => (up.files[p] && up.files[p].port) || (/^resource\//.test(p) ? 'js/ug/resources.js (automatisch)' : 'nicht portiert');
const statusOf = (p) => (up.files[p] && up.files[p].status) || (/^resource\//.test(p) ? 'automatisch' : 'offen');

let report = '';
const line = (s) => { report += (s || '') + '\n'; };
line('# Schneegans-Generator: Abgleich');
line();
line('- Port-Stand: ' + (up.commit ? '`' + up.commit.slice(0, 12) + '` (' + (up.date || '?') + ')' : 'keiner'));
line('- Upstream:   `' + head.slice(0, 12) + '` (' + headDate + ')');
line();
if (up.commit && up.commit !== head) {
  let log = '';
  try { log = git('log', '--format=%h %cs %s', up.commit + '..' + head); } catch (e) { log = '(Port-Commit im Klon nicht gefunden - Klon zu flach?)'; }
  line('## Commits seit dem Port-Stand');
  line();
  log.split('\n').filter(Boolean).forEach((l) => line('- ' + l));
  line();
}
if (!changed.length && !added.length && !removed.length) {
  line('Keine Aenderungen an Quelltext oder Ressourcen.');
} else {
  line('## Betroffene Dateien');
  line();
  line('| Datei | Art | Port | Status |');
  line('|---|---|---|---|');
  changed.forEach((p) => line('| `' + p + '` | geaendert | ' + portOf(p) + ' | ' + statusOf(p) + ' |'));
  added.forEach((p) => line('| `' + p + '` | neu | ' + portOf(p) + ' | ' + statusOf(p) + ' |'));
  removed.forEach((p) => line('| `' + p + '` | entfernt | ' + portOf(p) + ' | ' + statusOf(p) + ' |'));
  line();
  if (up.commit) {
    line('Diff: ' + (up.repo || 'https://github.com/cschneegans/unattend-generator') + '/compare/' + up.commit.slice(0, 12) + '...' + head.slice(0, 12));
    line();
  }
  /* Skripte laufen auf den Zielrechnern - Aenderungen im Wortlaut zeigen */
  const scripts = changed.concat(added).filter((p) => /^resource\/.*\.(ps1|vbs|cmd)$/i.test(p));
  for (const p of scripts) {
    line('### ' + p);
    line();
    line('```diff');
    try {
      line(up.commit && !added.includes(p) ? git('diff', up.commit, head, '--', p) : readText(path.join(clone, p)));
    } catch (e) { line('(Diff nicht verfuegbar)'); }
    line('```');
    line();
  }
}

if (reportPath) fs.writeFileSync(reportPath, report); else process.stdout.write(report);

if (args.includes('--resources')) {
  const n = writeResources(head);
  console.error('resources.js: ' + n + ' Ressourcen geschrieben.');
}

if (args.includes('--write')) {
  const files = {};
  for (const [p, sha] of Object.entries(now)) {
    const old = up.files[p] || {};
    files[p] = { blob: sha, port: old.port || portOf(p), status: old.status || statusOf(p) };
  }
  const out = { repo: up.repo || 'https://github.com/cschneegans/unattend-generator', commit: head, date: headDate, files };
  fs.mkdirSync(path.dirname(upstreamFile), { recursive: true });
  fs.writeFileSync(upstreamFile, JSON.stringify(out, null, 2) + '\n');
  console.error('UPSTREAM.json auf ' + head.slice(0, 12) + ' gesetzt.');
}

process.exit(changed.length || added.length || removed.length ? 3 : 0);
